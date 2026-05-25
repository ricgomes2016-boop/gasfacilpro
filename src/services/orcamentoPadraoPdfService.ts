import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { assinarPdfRemoto } from "./digitalSignature/signPdfClient";
import { toast } from "sonner";

export interface PadraoItem {
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

export interface PadraoPdfData {
  numero?: number | string | null;
  data_emissao?: string | null;
  validade?: string | null;
  cliente_nome?: string | null;
  cliente_telefone?: string | null;
  cliente_endereco?: string | null;
  cliente_cidade?: string | null;
  cliente_cnpj?: string | null;
  itens: PadraoItem[];
  desconto?: number;
  valor_total?: number;
  observacoes?: string | null;
  empresa_id?: string | null;
  unidade_id?: string | null;
  /** Se true, envia o PDF para a edge function `assinar-pdf` (PAdES com e-CNPJ) */
  assinar?: boolean;
}

const fmtBR = (d?: string | null) => {
  if (!d) return "—";
  const s = String(d);
  const part = s.includes("T") ? s.split("T")[0] : s;
  const [y, m, day] = part.split("-");
  if (!y || !m || !day) return s;
  return `${day}/${m}/${y}`;
};

const fmtMoney = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function fetchFornecedor(empresa_id?: string | null, unidade_id?: string | null) {
  let empresa: any = null;
  let unidade: any = null;
  if (empresa_id) {
    const { data } = await supabase.from("empresas").select("*").eq("id", empresa_id).maybeSingle();
    empresa = data;
  }
  if (unidade_id) {
    const { data } = await supabase.from("unidades").select("*").eq("id", unidade_id).maybeSingle();
    unidade = data;
  }
  const pick = (...vals: any[]) =>
    vals.find((v) => v !== null && v !== undefined && String(v).trim() !== "") || "";
  return {
    razao_social: pick(unidade?.razao_social, unidade?.nome_fantasia, unidade?.nome, empresa?.razao_social, empresa?.nome),
    nome_fantasia: pick(unidade?.nome_fantasia, unidade?.nome, empresa?.nome_fantasia, empresa?.nome),
    cnpj: pick(unidade?.cnpj, empresa?.cnpj),
    ie: pick(unidade?.inscricao_estadual, empresa?.inscricao_estadual),
    endereco: [
      pick(unidade?.endereco, empresa?.endereco),
      pick(unidade?.numero, empresa?.numero),
      pick(unidade?.bairro, empresa?.bairro),
    ].filter(Boolean).join(", "),
    cidade: pick(unidade?.cidade, empresa?.cidade),
    uf: pick(unidade?.estado, empresa?.estado),
    cep: pick(unidade?.cep, empresa?.cep),
    telefone: pick(unidade?.telefone, empresa?.telefone),
    email: pick(unidade?.email, empresa?.email),
  };
}

export async function gerarOrcamentoPadraoPdf(d: PadraoPdfData): Promise<jsPDF> {
  const f = await fetchFornecedor(d.empresa_id, d.unidade_id);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 14;

  // Cabeçalho fornecedor
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(String(f.nome_fantasia || f.razao_social || "").toUpperCase(), W / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (f.razao_social && f.razao_social !== f.nome_fantasia) {
    doc.text(String(f.razao_social).toUpperCase(), W / 2, y, { align: "center" });
    y += 4;
  }
  const linha1 = [f.cnpj && `CNPJ: ${f.cnpj}`, f.ie && `IE: ${f.ie}`].filter(Boolean).join("   ");
  if (linha1) { doc.text(linha1, W / 2, y, { align: "center" }); y += 4; }
  const enderecoCompleto = [
    f.endereco,
    f.cidade && `${f.cidade}${f.uf ? " - " + f.uf : ""}`,
    f.cep && `CEP ${f.cep}`,
  ].filter(Boolean).join(" • ");
  if (enderecoCompleto) { doc.text(enderecoCompleto, W / 2, y, { align: "center" }); y += 4; }
  const contato = [f.telefone && `Tel: ${f.telefone}`, f.email && `E-mail: ${f.email}`].filter(Boolean).join("   ");
  if (contato) { doc.text(contato, W / 2, y, { align: "center" }); y += 4; }

  y += 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(14, y, W - 14, y);
  y += 6;

  // Título orçamento
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const titulo = `ORÇAMENTO Nº ${d.numero ?? "—"}`;
  doc.text(titulo, 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const direita = `Emissão: ${fmtBR(d.data_emissao)}    Validade: ${fmtBR(d.validade)}`;
  doc.text(direita, W - 14, y, { align: "right" });
  y += 6;

  // Cliente
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  const cliBoxY = y;
  const linhasCli: string[] = [];
  linhasCli.push(`Cliente: ${(d.cliente_nome || "—").toUpperCase()}`);
  if (d.cliente_cnpj) linhasCli.push(`CNPJ/CPF: ${d.cliente_cnpj}`);
  if (d.cliente_telefone) linhasCli.push(`Telefone: ${d.cliente_telefone}`);
  const endCli = [d.cliente_endereco, d.cliente_cidade].filter(Boolean).join(" - ");
  if (endCli) linhasCli.push(`Endereço: ${endCli}`);
  const cliBoxH = 4 + linhasCli.length * 4.5;
  doc.rect(14, cliBoxY, W - 28, cliBoxH);
  doc.setFontSize(9);
  let cy = cliBoxY + 5;
  for (const ln of linhasCli) {
    doc.text(ln, 16, cy);
    cy += 4.5;
  }
  y = cliBoxY + cliBoxH + 4;

  // Tabela de itens
  const rows = d.itens.map((it, idx) => [
    String(idx + 1).padStart(2, "0"),
    it.descricao || "",
    String(it.quantidade ?? ""),
    it.preco_unitario ? `R$ ${fmtMoney(it.preco_unitario)}` : "",
    it.subtotal ? `R$ ${fmtMoney(it.subtotal)}` : "",
  ]);
  while (rows.length < 3) rows.push(["", "", "", "", ""]);

  const subtotalItens = d.itens.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
  const descontoVal = Number(d.desconto || 0);
  const totalFinal = Number(d.valor_total ?? subtotalItens - descontoVal);

  autoTable(doc, {
    startY: y,
    head: [["#", "Descrição do Produto/Serviço", "Qtd.", "Valor Unitário", "Valor Total"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0] },
    headStyles: { fillColor: [224, 224, 224], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 95 },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 35, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // Totais
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const totRightX = W - 14;
  doc.text(`Subtotal: R$ ${fmtMoney(subtotalItens)}`, totRightX, y, { align: "right" });
  y += 5;
  if (descontoVal > 0) {
    doc.text(`Desconto: R$ ${fmtMoney(descontoVal)}`, totRightX, y, { align: "right" });
    y += 5;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`TOTAL: R$ ${fmtMoney(totalFinal)}`, totRightX, y, { align: "right" });
  y += 8;

  // Observações
  const obsText = (d.observacoes || "").trim();
  if (obsText) {
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Observações:", 14, y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const obsLines = doc.splitTextToSize(obsText, W - 28);
    for (const ln of obsLines) {
      if (y > pageH - 60) { doc.addPage(); y = 15; }
      doc.text(ln, 14, y);
      y += 4;
    }
    y += 4;
  } else {
    y += 4;
  }

  // Data por extenso
  const hoje = new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataExt = `${f.cidade || "____________"}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(dataExt, 14, y);
  y += 14;

  // Quadro assinatura digital (com marca d'água da inicial dentro)
  const sigBoxW_mm = 140;
  const sigBoxH_mm = 32;
  const sigBoxX_mm = (W - sigBoxW_mm) / 2;
  const sigBoxY_mm = y;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(sigBoxX_mm, sigBoxY_mm, sigBoxW_mm, sigBoxH_mm);

  const nomeBaseSig = String(f.nome_fantasia || f.razao_social || "").trim();
  const inicialMatchSig = nomeBaseSig.normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[A-Za-z0-9]/);
  const inicialSig = (inicialMatchSig ? inicialMatchSig[0] : "●").toUpperCase();
  {
    const gs: any = (doc as any).GState ? new (doc as any).GState({ opacity: 0.12 }) : null;
    if (gs && (doc as any).setGState) (doc as any).setGState(gs);
    doc.setFont("times", "bold");
    const fs = Math.min(70, sigBoxH_mm * 2);
    doc.setFontSize(fs);
    doc.setTextColor(20, 60, 130);
    doc.text(inicialSig, sigBoxX_mm + sigBoxW_mm / 2, sigBoxY_mm + sigBoxH_mm / 2, { align: "center", baseline: "middle" } as any);
    if (gs && (doc as any).setGState) {
      const gs2: any = new (doc as any).GState({ opacity: 1 });
      (doc as any).setGState(gs2);
    }
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
  }

  // Linha de assinatura dentro do quadro, próxima à base
  const sigLineY_mm = sigBoxY_mm + sigBoxH_mm - 6;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(sigBoxX_mm + 10, sigLineY_mm, sigBoxX_mm + sigBoxW_mm - 10, sigLineY_mm);

  y = sigBoxY_mm + sigBoxH_mm + 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("ASSINATURA (fornecedor)", W / 2, y, { align: "center" });
  y += 10;

  // Carimbo simples da unidade
  doc.setTextColor(20, 60, 130);
  doc.setDrawColor(20, 60, 130);
  doc.setLineWidth(0.5);
  const boxW = Math.min(110, W - 40);
  const boxX = (W - boxW) / 2;
  const inset = 6;
  const innerW = boxW - inset;
  const razao = String(f.razao_social || "").toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const razaoLines = doc.splitTextToSize(razao, innerW);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const bodyLinhas: string[] = [];
  if (f.cnpj) bodyLinhas.push(`CNPJ: ${f.cnpj}`);
  if (f.telefone) bodyLinhas.push(`Tel.: ${f.telefone}`);
  const endC = [
    f.endereco,
    f.cidade && `${f.cidade}${f.uf ? " - " + f.uf : ""}`,
    f.cep && `CEP ${f.cep}`,
  ].filter(Boolean).join(" - ");
  if (endC) for (const p of doc.splitTextToSize(endC, innerW) as string[]) bodyLinhas.push(p);

  const titleH = 4.4, lineH = 3.6, padTop = 3, padBottom = 3, gap = 1;
  const boxH = padTop + razaoLines.length * titleH + gap + bodyLinhas.length * lineH + padBottom;
  doc.rect(boxX, y, boxW, boxH);
  let ccy = y + padTop + titleH - 0.8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  for (const r of razaoLines) { doc.text(r, boxX + boxW / 2, ccy, { align: "center" }); ccy += titleH; }
  ccy += gap;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (const l of bodyLinhas) { doc.text(l, boxX + boxW / 2, ccy, { align: "center" }); ccy += lineH; }
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  // Metadados para assinatura
  (doc as any).__sigLineY_mm = sigLineY_mm;
  (doc as any).__pageH_mm = doc.internal.pageSize.getHeight();
  (doc as any).__pageW_mm = W;
  return doc;
}

export async function imprimirOrcamentoPadrao(d: PadraoPdfData) {
  const doc = await gerarOrcamentoPadraoPdf(d);
  let bytes = new Uint8Array(doc.output("arraybuffer"));

  if (d.assinar && d.unidade_id) {
    const t = toast.loading("Assinando PDF com e-CNPJ...");
    const PT_PER_MM = 2.83465;
    const sigLineY_mm = (doc as any).__sigLineY_mm as number;
    const pageH_mm = (doc as any).__pageH_mm as number;
    const pageW_mm = (doc as any).__pageW_mm as number;
    const boxW_mm = 140;
    const boxH_mm = 18;
    const boxX_mm = (pageW_mm - boxW_mm) / 2;
    const visivel = {
      x: boxX_mm * PT_PER_MM,
      y: (pageH_mm - sigLineY_mm) * PT_PER_MM,
      largura: boxW_mm * PT_PER_MM,
      altura: boxH_mm * PT_PER_MM,
    };
    const res = await assinarPdfRemoto(bytes, {
      unidadeId: d.unidade_id,
      motivo: `Orçamento ${d.numero ?? ""}`.trim(),
      local: "Brasil",
      visivel,
    });
    toast.dismiss(t);
    if (res.ok) {
      bytes = new Uint8Array(res.pdf);
      toast.success(`Assinado por ${res.titular || "certificado e-CNPJ"}`);
    } else {
      toast.error(`Não foi possível assinar: ${res.mensagem || res.motivo || "erro desconhecido"}`);
    }
  }

  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url);
  if (w) {
    w.onload = () => {
      try { w.focus(); w.print(); } catch {}
    };
  }
}

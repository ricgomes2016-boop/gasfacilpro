import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { assinarPdfRemoto } from "./digitalSignature/signPdfClient";
import { toast } from "sonner";

export interface FundeparItem {
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

export type CarimboTamanho = "compacto" | "padrao" | "pequeno";

export interface FundeparPdfData {
  numero?: number | string | null;
  municipio?: string | null;
  nre?: string | null;
  estabelecimento?: string | null;
  cnpj_escola?: string | null;
  forma_pagamento?: string | null;
  validade_inicio?: string | null;
  validade?: string | null;
  itens: FundeparItem[];
  observacoes?: string | null;
  empresa_id?: string | null;
  unidade_id?: string | null;
  carimbo_tamanho?: CarimboTamanho;
  /** Se true, envia o PDF para a edge function `assinar-pdf` (PAdES com e-CNPJ) */
  assinar?: boolean;
}

const fmtBR = (d?: string | null) => {
  if (!d) return "____/____/______";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
};

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const pick = (...vals: any[]) => vals.find((v) => v !== null && v !== undefined && String(v).trim() !== "") || "";
  // Quando há unidade selecionada, priorizar SEMPRE seus dados.
  // Só cair para a empresa quando a unidade não fornecer aquele campo específico.
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

export async function gerarFundeparPdf(d: FundeparPdfData): Promise<jsPDF> {
  const f = await fetchFornecedor(d.empresa_id, d.unidade_id);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 12;

  // Cabeçalho institucional
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("ESTADO DO PARANÁ", W / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(10);
  doc.text("Instituto Paranaense de Desenvolvimento Educacional", W / 2, y, { align: "center" });
  y += 7;
  const ano = new Date().getFullYear();
  doc.setFontSize(13);
  doc.text(`Pesquisa de Preço ${ano}`, W / 2, y, { align: "center" });
  y += 8;

  // Mun / NRE / Estabelecimento
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const linhaCab = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 14, y);
    const lw = doc.getTextWidth(label);
    doc.setFont("helvetica", "normal");
    doc.text(value || "", 14 + lw + 2, y);
    y += 5;
  };
  linhaCab("Mun:", (d.municipio || "").toUpperCase());
  linhaCab("NRE:", (d.nre || "").toUpperCase());
  linhaCab("Estabelecimento:", (d.estabelecimento || "").toUpperCase());
  if (d.cnpj_escola) linhaCab("CNPJ da Escola:", d.cnpj_escola);
  y += 1;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(14, y, W - 14, y);
  y += 3;

  // Dados do fornecedor
  const fornLine = (label: string, value: string, label2?: string, value2?: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 14, y);
    const w1 = doc.getTextWidth(label);
    doc.setFont("helvetica", "normal");
    doc.text(value || "", 14 + w1 + 2, y);
    if (label2) {
      doc.setFont("helvetica", "bold");
      doc.text(label2, 110, y);
      const w2 = doc.getTextWidth(label2);
      doc.setFont("helvetica", "normal");
      doc.text(value2 || "", 110 + w2 + 2, y);
    }
    y += 5;
  };
  fornLine("RAZÃO SOCIAL:", String(f.razao_social).toUpperCase());
  fornLine("NOME FANTASIA:", String(f.nome_fantasia).toUpperCase());
  fornLine("CNPJ:", String(f.cnpj), "INSCRIÇÃO ESTADUAL:", String(f.ie));
  fornLine(
    "ENDEREÇO:",
    String(f.endereco).toUpperCase(),
  );
  fornLine("CIDADE:", String(f.cidade).toUpperCase(), "UF:", String(f.uf).toUpperCase());
  fornLine("FONE:", String(f.telefone), "E-MAIL:", String(f.email));
  fornLine("FORMA DE PAGAMENTO:", (d.forma_pagamento || "À VISTA").toUpperCase());
  fornLine(
    "PERÍODO DA VALIDADE DA PROPOSTA:",
    `DE: ${fmtBR(d.validade_inicio)} ATÉ ${fmtBR(d.validade)}`,
  );
  y += 2;

  // Título tabela
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Orçamentos de Itens – GÁS ENGARRAFADO", W / 2, y, { align: "center" });
  y += 4;

  // Tabela de itens
  const rows = d.itens.map((it, idx) => [
    String(idx + 1).padStart(2, "0"),
    it.descricao || "",
    String(it.quantidade ?? ""),
    it.preco_unitario ? `R$ ${fmtMoney(it.preco_unitario)}` : "",
    it.subtotal ? `R$ ${fmtMoney(it.subtotal)}` : "",
  ]);
  // garante ao menos 4 linhas
  while (rows.length < 4) rows.push(["", "", "", "", ""]);

  const total = d.itens.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);

  autoTable(doc, {
    startY: y,
    head: [["", "Descrição do Produto/Serviço", "Quant.", "Valor Unitário", "Valor Total"]],
    body: rows,
    foot: [["", "", "", "Valor Total", total ? `R$ ${fmtMoney(total)}` : "R$"]],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0] },
    headStyles: { fillColor: [224, 224, 224], textColor: [0, 0, 0], fontStyle: "bold" },
    footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 90 },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 35, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

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
      if (y > pageH - 20) {
        doc.addPage();
        y = 15;
      }
      doc.text(ln, 14, y);
      y += 4;
    }
    y += 4;
  } else {
    y += 4;
  }



  // Data
  const hoje = new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataExt = `${f.cidade || "____________"}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(dataExt, 14, y);
  y += 18;

  // Quadro da Assinatura Digital (mesma dimensão da aparência PAdES) com marca d'água da inicial
  const sigBoxW_mm = 140;
  const sigBoxH_mm = 18;
  const sigBoxX_mm = (W - sigBoxW_mm) / 2;
  const sigBoxY_mm = y;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(sigBoxX_mm, sigBoxY_mm, sigBoxW_mm, sigBoxH_mm);

  // Marca d'água estilo Adobe: inicial da unidade/empresa
  const nomeBaseSig = String(f.nome_fantasia || f.razao_social || "").trim();
  const inicialMatchSig = nomeBaseSig.normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[A-Za-z0-9]/);
  const inicialSig = (inicialMatchSig ? inicialMatchSig[0] : "●").toUpperCase();
  {
    const gs: any = (doc as any).GState ? new (doc as any).GState({ opacity: 0.12 }) : null;
    if (gs && (doc as any).setGState) (doc as any).setGState(gs);
    doc.setFont("times", "bold");
    const fs = Math.max(36, Math.min(80, sigBoxH_mm * 2.6));
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

  y = sigBoxY_mm + sigBoxH_mm;
  // Linha de assinatura
  doc.line(50, y, W - 50, y);
  const sigLineY_mm = y;
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("ASSINATURA (fornecedor)", W / 2, y, { align: "center" });
  y += 14;

  // Carimbo do fornecedor (caixa azul) — centralizado e equilibrado
  doc.setTextColor(20, 60, 130);
  doc.setDrawColor(20, 60, 130);
  doc.setLineWidth(0.6);

  // Monta linhas
  const razao = String(f.razao_social || "").toUpperCase();
  const linhasCarimbo: string[] = [];
  if (f.cnpj) linhasCarimbo.push(`CNPJ: ${f.cnpj}`);
  if (f.telefone) linhasCarimbo.push(`Cel.: ${f.telefone}`);
  const endLinha = [
    f.endereco,
    f.cidade && `${f.cidade}${f.uf ? " - " + f.uf : ""}`,
    f.cep && `CEP ${f.cep}`,
  ].filter(Boolean).join(" - ");
  if (endLinha) linhasCarimbo.push(endLinha);

  // Presets de tamanho do carimbo
  const presets = {
    padrao:   { boxW: 110, titleFs: 9, bodyFs: 8, lineH: 3.6, titleH: 4.4, padTop: 3, padBottom: 3, gap: 1,   inset: 6 },
    compacto: { boxW: 95,  titleFs: 8.5, bodyFs: 7.5, lineH: 3.3, titleH: 4.0, padTop: 2.5, padBottom: 2.5, gap: 0.8, inset: 5 },
    pequeno:  { boxW: 75,  titleFs: 7.5, bodyFs: 6.5, lineH: 2.8, titleH: 3.6, padTop: 2, padBottom: 2, gap: 0.5, inset: 4 },
  } as const;
  const ps = presets[d.carimbo_tamanho || "padrao"];

  const boxW = Math.min(ps.boxW, W - 40);
  const boxX = (W - boxW) / 2;
  const innerW = boxW - ps.inset;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(ps.titleFs);
  const razaoLines = doc.splitTextToSize(razao, innerW);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(ps.bodyFs);
  const bodyLines: string[] = [];
  for (const l of linhasCarimbo) {
    const parts = doc.splitTextToSize(l, innerW);
    for (const p of parts) bodyLines.push(p);
  }

  const { lineH, titleH, padTop, padBottom, gap } = ps;
  const boxH = padTop + razaoLines.length * titleH + gap + bodyLines.length * lineH + padBottom;

  doc.rect(boxX, y, boxW, boxH);

  let cy = y + padTop + titleH - 0.8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(ps.titleFs);
  for (const r of razaoLines) {
    doc.text(r, boxX + boxW / 2, cy, { align: "center" });
    cy += titleH;
  }
  cy += gap;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(ps.bodyFs);
  for (const l of bodyLines) {
    doc.text(l, boxX + boxW / 2, cy, { align: "center" });
    cy += lineH;
  }

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);




  // Anexa metadados para uso ao assinar (posição da linha de assinatura em mm)
  (doc as any).__sigLineY_mm = sigLineY_mm;
  (doc as any).__pageH_mm = doc.internal.pageSize.getHeight();
  (doc as any).__pageW_mm = W;
  return doc;
}

export async function imprimirFundepar(d: FundeparPdfData) {
  const doc = await gerarFundeparPdf(d);

  let bytes = new Uint8Array(doc.output("arraybuffer"));

  if (d.assinar && d.unidade_id) {
    const t = toast.loading("Assinando PDF com e-CNPJ...");

    // Calcula a caixa da aparência visível (acima da linha de assinatura, em pontos PDF)
    const PT_PER_MM = 2.83465;
    const sigLineY_mm = (doc as any).__sigLineY_mm as number;
    const pageH_mm = (doc as any).__pageH_mm as number;
    const pageW_mm = (doc as any).__pageW_mm as number;
    const boxW_mm = 140;
    const boxH_mm = 18;
    const boxX_mm = (pageW_mm - boxW_mm) / 2;
    const visivel = {
      x: boxX_mm * PT_PER_MM,
      // y é o canto inferior em pts (origem inferior-esquerda do PDF)
      y: (pageH_mm - sigLineY_mm) * PT_PER_MM,
      largura: boxW_mm * PT_PER_MM,
      altura: boxH_mm * PT_PER_MM,
    };

    const res = await assinarPdfRemoto(bytes, {
      unidadeId: d.unidade_id,
      motivo: "Orçamento Fundepar",
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
      try {
        w.focus();
        w.print();
      } catch {}
    };
  }
}

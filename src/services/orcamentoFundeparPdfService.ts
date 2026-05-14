import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

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
  y += 2;

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

  y = (doc as any).lastAutoTable.finalY + 10;

  // Data
  const hoje = new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataExt = `${f.cidade || "____________"}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(dataExt, 14, y);
  y += 18;

  // Linha de assinatura
  doc.line(50, y, W - 50, y);
  y += 5;
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

  // Quebra a linha de endereço se exceder a largura
  const boxW = Math.min(85, W - 40);
  const boxX = (W - boxW) / 2;
  const innerW = boxW - 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const razaoLines = doc.splitTextToSize(razao, innerW);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const bodyLines: string[] = [];
  for (const l of linhasCarimbo) {
    const parts = doc.splitTextToSize(l, innerW);
    for (const p of parts) bodyLines.push(p);
  }

  const lineH = 3.0;
  const titleH = 3.8;
  const padTop = 2;
  const padBottom = 2;
  const gap = 0.5;
  const boxH = padTop + razaoLines.length * titleH + gap + bodyLines.length * lineH + padBottom;

  doc.rect(boxX, y, boxW, boxH);

  let cy = y + padTop + titleH - 0.8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  for (const r of razaoLines) {
    doc.text(r, boxX + boxW / 2, cy, { align: "center" });
    cy += titleH;
  }
  cy += gap;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  for (const l of bodyLines) {
    doc.text(l, boxX + boxW / 2, cy, { align: "center" });
    cy += lineH;
  }

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  return doc;
}

export async function imprimirFundepar(d: FundeparPdfData) {
  const doc = await gerarFundeparPdf(d);
  const blob = doc.output("blob");
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

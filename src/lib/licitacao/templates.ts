import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface EmpresaInfo {
  razao_social: string;
  cnpj: string;
  inscricao_estadual?: string | null;
  endereco: string;
  bairro?: string | null;
  cidade: string;
  estado: string;
  cep?: string | null;
  telefone?: string | null;
  email?: string | null;
}

export interface LicitacaoHeader {
  numero_pregao: string;
  modalidade: string; // "presencial" | "eletronico"
  orgao: string;
  data_pregao: string; // ISO yyyy-mm-dd
  cidade_assinatura?: string;
}

export interface Representante {
  nome: string;
  cargo?: string;
  cpf: string;
  rg: string;
  endereco?: string;
  telefone?: string;
  celular?: string;
}

export interface ContaBancaria {
  banco: string;
  agencia: string;
  conta: string;
}

export interface ItemProposta {
  item: number;
  especificacao: string;
  quantidade: number;
  unidade: string;
  valor_unit: number;
}

export interface DadosAnexos {
  porte?: "ME" | "EPP";
  representante?: Representante;
  banco?: ContaBancaria;
  validade_proposta_dias?: number;
  itens?: ItemProposta[];
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function formatDataExtenso(iso: string, cidade: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${cidade}, em ${d} de ${MESES[m - 1]} de ${y}.`;
}

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function modalidadeLabel(m: string): string {
  return m === "eletronico" ? "ELETRÔNICA" : "PRESENCIAL";
}

function header(doc: jsPDF, title: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, 105, 25, { align: "center" });
  doc.setLineWidth(0.3);
  doc.line(20, 28, 190, 28);
}

function footerAssinatura(doc: jsPDF, y: number, empresa: EmpresaInfo, rep: Representante) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const lineY = y + 15;
  doc.line(60, lineY, 150, lineY);
  doc.setFont("helvetica", "bold");
  doc.text(empresa.razao_social.toUpperCase(), 105, lineY + 6, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(rep.nome.toUpperCase(), 105, lineY + 12, { align: "center" });
  doc.text(`RG: ${rep.rg}`, 105, lineY + 18, { align: "center" });
}

function empresaIdentLine(empresa: EmpresaInfo): string {
  const endParts = [
    empresa.endereco,
    empresa.bairro,
    `${empresa.cidade} - ${empresa.estado}`,
    empresa.cep ? `CEP: ${empresa.cep}` : null,
  ].filter(Boolean).join(", ");
  return `${empresa.razao_social}, CNPJ/MF ${empresa.cnpj}, sediada ${endParts}`;
}

// ---------- ANEXO 05 — Cumprimento dos Requisitos ----------
export function renderAnexo05(empresa: EmpresaInfo, lic: LicitacaoHeader, rep: Representante): jsPDF {
  const doc = new jsPDF();
  header(doc, "ANEXO 05");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("DECLARAÇÃO DE CUMPRIMENTO DOS REQUISITOS DO EDITAL", 105, 42, { align: "center" });
  doc.text(`PREGÃO ${modalidadeLabel(lic.modalidade)} Nº ${lic.numero_pregao}`, 105, 52, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const txt = `${empresaIdentLine(empresa)} declara, sob as penas da Lei, que cumpre plenamente os requisitos de habilitação.`;
  const lines = doc.splitTextToSize(txt, 170);
  doc.text(lines, 20, 70);

  const y = 70 + lines.length * 6 + 10;
  doc.text(formatDataExtenso(lic.data_pregao, lic.cidade_assinatura || empresa.cidade), 20, y);
  footerAssinatura(doc, y, empresa, rep);
  return doc;
}

// ---------- ANEXO 06 — ME/EPP ----------
export function renderAnexo06(
  empresa: EmpresaInfo,
  lic: LicitacaoHeader,
  rep: Representante,
  porte: "ME" | "EPP"
): jsPDF {
  const doc = new jsPDF();
  header(doc, "ANEXO 06");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("DECLARAÇÃO DE MICRO EMPRESA OU EMPRESA DE PEQUENO PORTE", 105, 42, { align: "center" });
  doc.text(`PREGÃO Nº ${lic.numero_pregao} – FORMA ${modalidadeLabel(lic.modalidade)}`, 105, 52, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const porteTxt = porte === "ME" ? "MICRO EMPRESA" : "EMPRESA DE PEQUENO PORTE";
  const txt = `A empresa ${empresa.razao_social}, Inscrita no CNPJ sob o nº ${empresa.cnpj}, sediada ${empresa.endereco}, ${empresa.cidade} - ${empresa.estado}, CEP: ${empresa.cep || ""} declara, sob as penas da Lei, que se trata de ${porteTxt}, de acordo com a receita bruta anual, podendo receber o tratamento previsto na Lei Complementar nº 123, de 14 de dezembro de 2006 e suas alterações Lei Complementar nº 147, de 07 de agosto de 2014, com relação ao Processo Licitatório, estando ciente da responsabilidade administrativa, civil e penal.`;
  const lines = doc.splitTextToSize(txt, 170);
  doc.text(lines, 20, 70);

  const y = 70 + lines.length * 6 + 10;
  doc.text(formatDataExtenso(lic.data_pregao, lic.cidade_assinatura || empresa.cidade), 20, y);
  footerAssinatura(doc, y, empresa, rep);
  return doc;
}

// ---------- ANEXO 11 — Informações Contratuais ----------
export function renderAnexo11(
  empresa: EmpresaInfo,
  lic: LicitacaoHeader,
  rep: Representante,
  banco: ContaBancaria
): jsPDF {
  const doc = new jsPDF();
  header(doc, "DECLARAÇÃO DE INFORMAÇÕES CONTRATUAIS");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const txt = `A ${empresaIdentLine(empresa)}. Declara que o Sr(a). ${rep.nome}, ${rep.cargo || "representante"}, CPF: ${rep.cpf}, ${rep.endereco ? "Residente na " + rep.endereco + ", " : ""}telefone: ${rep.telefone || ""}${rep.celular ? " e Celular: " + rep.celular : ""}, possui poderes para assinar o instrumento contratual e a conta bancária para operações referentes ao contrato, CONTA CORRENTE Nº: ${banco.conta}, Agência: ${banco.agencia}, ${banco.banco}.`;
  const lines = doc.splitTextToSize(txt, 170);
  doc.text(lines, 20, 50);

  const y = 50 + lines.length * 6 + 10;
  doc.text(formatDataExtenso(lic.data_pregao, lic.cidade_assinatura || empresa.cidade), 20, y);
  footerAssinatura(doc, y, empresa, rep);
  return doc;
}

// ---------- ANEXO 10 — Carta-Proposta ----------
export function renderCartaProposta(
  empresa: EmpresaInfo,
  lic: LicitacaoHeader,
  rep: Representante,
  banco: ContaBancaria,
  itens: ItemProposta[],
  validadeDias: number
): jsPDF {
  const doc = new jsPDF();
  header(doc, "ANEXO 10 — CARTA-PROPOSTA PARA FORNECIMENTO");

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Ao ${lic.orgao}.`, 20, 40);
  doc.text("Prezados Senhores,", 20, 50);
  doc.setFont("helvetica", "bold");
  doc.text(`Ref.: PREGÃO Nº ${lic.numero_pregao} – FORMA ${modalidadeLabel(lic.modalidade)} - Carta-Proposta de Fornecimento.`, 20, 60, { maxWidth: 170 });

  doc.setFont("helvetica", "bold");
  doc.text("1 - IDENTIFICAÇÃO DO CONCORRENTE", 20, 78);
  doc.setFont("helvetica", "normal");
  const ident = [
    `Razão Social: ${empresa.razao_social}`,
    `CNPJ: ${empresa.cnpj}${empresa.inscricao_estadual ? "  /  Inscrição Estadual: " + empresa.inscricao_estadual : ""}`,
    `Representante e Cargo: ${rep.nome} - ${rep.cargo || "Proprietário"}`,
    `Carteira de Identidade: ${rep.rg}  /  CPF: ${rep.cpf}`,
    `Endereço: ${empresa.endereco}, ${empresa.cidade} - ${empresa.estado}`,
    `Fone: ${empresa.telefone || ""}`,
    `E-mail: ${empresa.email || ""}`,
    `${banco.banco}: Agência: ${banco.agencia} e C/C: ${banco.conta}`,
  ];
  ident.forEach((l, i) => doc.text("• " + l, 22, 86 + i * 6));

  let y = 86 + ident.length * 6 + 8;
  doc.setFont("helvetica", "bold");
  doc.text("2 — DO OBJETO E PREÇOS:", 20, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  const t1 = doc.splitTextToSize("2.1 - Apresentamos nossa proposta para fornecimento do objeto abaixo discriminado, conforme Anexo 01, que integra o instrumento convocatório da licitação em epígrafe.", 170);
  doc.text(t1, 20, y);
  y += t1.length * 5 + 4;
  const t2 = doc.splitTextToSize("2.2 — Declaramos que o preço proposto contempla todas as despesas necessárias para o fornecimento dos itens, tais como encargos, obrigações sociais, impostos, taxas e fretes referentes ao fornecimento do objeto deste edital.", 170);
  doc.text(t2, 20, y);
  y += t2.length * 5 + 4;

  autoTable(doc, {
    startY: y,
    head: [["Item", "Especificação", "Qtd", "Un", "V. Unit", "V. Total"]],
    body: itens.map((it) => [
      String(it.item),
      it.especificacao,
      String(it.quantidade),
      it.unidade,
      brl(it.valor_unit),
      brl(it.quantidade * it.valor_unit),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [60, 60, 60] },
  });

  let yEnd = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.text(`3 - Validade da proposta: ${validadeDias} (${validadeDias === 60 ? "sessenta" : validadeDias}) dias, a partir da data de abertura do pregão.`, 20, yEnd, { maxWidth: 170 });
  yEnd += 14;
  doc.setFont("helvetica", "normal");
  doc.text(formatDataExtenso(lic.data_pregao, lic.cidade_assinatura || empresa.cidade), 20, yEnd);
  footerAssinatura(doc, yEnd, empresa, rep);
  return doc;
}

// ---------- Proposta de Preço ----------
export function renderPropostaPreco(
  empresa: EmpresaInfo,
  lic: LicitacaoHeader,
  rep: Representante,
  itens: ItemProposta[]
): jsPDF {
  const doc = new jsPDF();
  header(doc, "PROPOSTA DE PREÇO");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`PREGÃO Nº ${lic.numero_pregao} – ${modalidadeLabel(lic.modalidade)}`, 105, 38, { align: "center" });
  doc.text(`Órgão: ${lic.orgao}`, 105, 46, { align: "center" });

  doc.setFont("helvetica", "normal");
  const t1 = doc.splitTextToSize("1.1 – OBJETO: Registrar preços conforme objeto descrito no edital.", 170);
  doc.text(t1, 20, 58);

  autoTable(doc, {
    startY: 70,
    head: [["Item", "Especificação", "Qtd", "Un", "V. Unit", "V. Total"]],
    body: itens.map((it) => [
      String(it.item),
      it.especificacao,
      String(it.quantidade),
      it.unidade,
      brl(it.valor_unit),
      brl(it.quantidade * it.valor_unit),
    ]),
    foot: [["", "", "", "", "Total", brl(itens.reduce((s, it) => s + it.quantidade * it.valor_unit, 0))]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [60, 60, 60] },
    footStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: "bold" },
  });

  let y = (doc as any).lastAutoTable.finalY + 16;
  doc.text(formatDataExtenso(lic.data_pregao, lic.cidade_assinatura || empresa.cidade), 20, y);
  footerAssinatura(doc, y, empresa, rep);
  return doc;
}

// ---------- Etiqueta de Envelope ----------
export function renderEtiquetaEnvelope(
  empresa: EmpresaInfo,
  lic: LicitacaoHeader,
  envelopeNumero: 1 | 2,
  titulo: string
): jsPDF {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`ENVELOPE Nº ${envelopeNumero}`, 105, 40, { align: "center" });
  doc.text(titulo.toUpperCase(), 105, 52, { align: "center" });

  doc.setFontSize(13);
  doc.text(lic.orgao.toUpperCase(), 105, 75, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(`PREGÃO Nº ${lic.numero_pregao} – ${modalidadeLabel(lic.modalidade)}`, 105, 85, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("PROPONENTE:", 30, 120);
  doc.setFont("helvetica", "normal");
  doc.text(empresa.razao_social, 30, 128);
  doc.text(`CNPJ: ${empresa.cnpj}`, 30, 135);
  doc.text(`${empresa.endereco}, ${empresa.cidade} - ${empresa.estado}`, 30, 142);
  return doc;
}

export const ITENS_PADRAO: ItemProposta[] = [
  { item: 1, especificacao: "Água mineral 20 litros", quantidade: 1000, unidade: "UN", valor_unit: 12 },
  { item: 2, especificacao: "Cota p/ Água Mineral 20 litros (galão)", quantidade: 400, unidade: "GL", valor_unit: 22 },
  { item: 3, especificacao: "Cota p/ P-13 (botijão)", quantidade: 300, unidade: "UN", valor_unit: 110 },
  { item: 4, especificacao: "Gás P-13 acondicionado em botijão c/ 13 quilos", quantidade: 1875, unidade: "UN", valor_unit: 92 },
  { item: 5, especificacao: "Gás P-13 acondicionado em botijão c/ 13 quilos", quantidade: 625, unidade: "UN", valor_unit: 92 },
  { item: 6, especificacao: "Gás P-45 acondicionado em cilindro c/ 45 quilos", quantidade: 375, unidade: "UN", valor_unit: 346 },
  { item: 7, especificacao: "Gás P-45 acondicionado em cilindro c/ 45 quilos", quantidade: 125, unidade: "UN", valor_unit: 346 },
  { item: 8, especificacao: "Mangueira p/ P-13 com certificado INMETRO", quantidade: 150, unidade: "UN", valor_unit: 25 },
  { item: 9, especificacao: "Mangueira p/ P-45 com certificado INMETRO", quantidade: 100, unidade: "UN", valor_unit: 55 },
  { item: 10, especificacao: "Registro p/ P-13 com certificado INMETRO", quantidade: 100, unidade: "UN", valor_unit: 40 },
  { item: 11, especificacao: "Registro p/ P-45 com certificado INMETRO", quantidade: 100, unidade: "UN", valor_unit: 55 },
];

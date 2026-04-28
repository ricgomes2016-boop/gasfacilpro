import jsPDF from "jspdf";
import type { Unidade } from "@/contexts/UnidadeContext";

export const DECLARACAO_VARIAVEIS = [
  "{{nome_unidade}}",
  "{{tipo_unidade}}",
  "{{cnpj}}",
  "{{endereco}}",
  "{{bairro}}",
  "{{cidade}}",
  "{{estado}}",
  "{{cep}}",
  "{{telefone}}",
  "{{email}}",
  "{{data_atual}}",
] as const;

export const MODELO_DECLARACAO_PADRAO = `Declaramos para os devidos fins que a unidade {{nome_unidade}}, inscrita no CNPJ {{cnpj}}, localizada em {{endereco}}, {{bairro}}, {{cidade}}/{{estado}}, CEP {{cep}}, encontra-se vinculada à nossa operação como {{tipo_unidade}}.

Por ser verdade, firmamos a presente declaração.

{{cidade}}/{{estado}}, {{data_atual}}.`;

const hojeExtenso = () => new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
}).format(new Date());

const valor = (value?: string | null) => value?.trim() || "Não informado";

export function renderDeclaracaoTexto(template: string, unidade: Unidade): string {
  const dados: Record<string, string> = {
    "{{nome_unidade}}": valor(unidade.nome),
    "{{tipo_unidade}}": unidade.tipo === "matriz" ? "Matriz" : "Filial",
    "{{cnpj}}": valor(unidade.cnpj),
    "{{endereco}}": valor(unidade.endereco),
    "{{bairro}}": valor(unidade.bairro),
    "{{cidade}}": valor(unidade.cidade),
    "{{estado}}": valor(unidade.estado),
    "{{cep}}": valor(unidade.cep),
    "{{telefone}}": valor(unidade.telefone),
    "{{email}}": valor(unidade.email),
    "{{data_atual}}": hojeExtenso(),
  };

  return Object.entries(dados).reduce(
    (texto, [chave, substituto]) => texto.split(chave).join(substituto),
    template
  );
}

function addHeader(doc: jsPDF, unidade: Unidade, titulo: string) {
  const pageWidth = 210;
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(valor(unidade.nome).toUpperCase(), pageWidth / 2, y, { align: "center" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const detalhes = [
    unidade.tipo === "matriz" ? "Matriz" : "Filial",
    unidade.cnpj ? `CNPJ: ${unidade.cnpj}` : null,
    unidade.telefone ? `Tel: ${unidade.telefone}` : null,
  ].filter(Boolean).join(" · ");
  if (detalhes) {
    doc.text(detalhes, pageWidth / 2, y, { align: "center" });
    y += 5;
  }

  const endereco = [unidade.endereco, unidade.bairro, unidade.cidade && unidade.estado ? `${unidade.cidade}/${unidade.estado}` : unidade.cidade, unidade.cep]
    .filter(Boolean)
    .join(" - ");
  if (endereco) {
    doc.text(endereco, pageWidth / 2, y, { align: "center" });
    y += 5;
  }

  if (unidade.email) {
    doc.text(unidade.email, pageWidth / 2, y, { align: "center" });
    y += 5;
  }

  y += 4;
  doc.setLineWidth(0.4);
  doc.line(18, y, pageWidth - 18, y);
  y += 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(titulo.toUpperCase(), pageWidth / 2, y, { align: "center" });
  return y + 16;
}

function addSignature(doc: jsPDF, unidade: Unidade, y: number) {
  const pageWidth = 210;
  const lineY = Math.max(y + 26, 245);
  doc.setLineWidth(0.3);
  doc.line(55, lineY, pageWidth - 55, lineY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(valor(unidade.nome), pageWidth / 2, lineY + 6, { align: "center" });
  if (unidade.cnpj) doc.text(`CNPJ: ${unidade.cnpj}`, pageWidth / 2, lineY + 12, { align: "center" });
}

export function gerarDeclaracoesPdf(unidades: Unidade[], titulo: string, template: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const marginX = 22;
  const maxWidth = 166;

  unidades.forEach((unidade, index) => {
    if (index > 0) doc.addPage();
    let y = addHeader(doc, unidade, titulo);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setLineHeightFactor(1.6);

    const texto = renderDeclaracaoTexto(template, unidade);
    texto.split("\n").forEach((paragrafo) => {
      if (!paragrafo.trim()) {
        y += 7;
        return;
      }
      const linhas = doc.splitTextToSize(paragrafo.trim(), maxWidth);
      doc.text(linhas, marginX, y, { align: "justify", maxWidth });
      y += linhas.length * 7 + 5;
    });

    addSignature(doc, unidade, y);
  });

  const data = new Date().toLocaleDateString("pt-BR").replace(/\D/g, "");
  doc.save(`declaracoes-unidades-${data}.pdf`);
}

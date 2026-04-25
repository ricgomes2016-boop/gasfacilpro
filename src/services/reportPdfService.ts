import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const formatCurrency = (value: number): string =>
  Math.abs(Number.isFinite(value) ? value : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatSignedCurrency = (value: number): string =>
  value < 0 ? `(${formatCurrency(value)})` : formatCurrency(value);

interface ExportOptions {
  title: string;
  subtitle?: string;
  periodo?: string;
}

/** Gera um PDF A4 landscape com título e período */
function createBasePdf(options: ExportOptions): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(options.title, 14, 15);
  if (options.subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(options.subtitle, 14, 22);
  }
  if (options.periodo) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Período: ${options.periodo}`, 14, options.subtitle ? 28 : 22);
    doc.setTextColor(0, 0, 0);
  }
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 14, doc.internal.pageSize.height - 7);
  doc.setTextColor(0, 0, 0);
  return doc;
}

// ========= DRE =========
interface DRELine {
  categoria: string;
  valores: number[];
  tipo: string;
}

export function exportDREtoPdf(dre: DRELine[], meses: string[], periodo: string) {
  const doc = createBasePdf({ title: "DRE - Demonstrativo de Resultados", periodo });

  const head = [["Descrição", ...meses, "Total"]];
  const body = dre.map(item => {
    const total = item.valores.reduce((s, v) => s + v, 0);
    return [
      item.categoria,
      ...item.valores.map(formatSignedCurrency),
      formatSignedCurrency(total),
    ];
  });

  autoTable(doc, {
    startY: 33,
    head,
    body,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [41, 98, 89], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 58 },
      ...Object.fromEntries(Array.from({ length: meses.length + 1 }, (_, i) => [i + 1, { halign: "right" }])),
    },
    didParseCell: (data: any) => {
      if (data.section === "body") {
        const row = dre[data.row.index];
        if (row?.tipo === "subtotal") {
          data.cell.styles.fillColor = [240, 240, 240];
          data.cell.styles.fontStyle = "bold";
        }
        if (row?.tipo === "resultado") {
          data.cell.styles.fillColor = [230, 245, 235];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fontSize = 10;
        }
        // Red for negative values
        if (data.column.index > 0) {
          const val = row?.valores[data.column.index - 1] ?? 0;
          const total = row?.valores.reduce((s: number, v: number) => s + v, 0) ?? 0;
          const isTotal = data.column.index === dre[0].valores.length + 1;
          if ((isTotal && total < 0) || (!isTotal && val < 0)) {
            data.cell.styles.textColor = [200, 50, 50];
          }
        }
      }
    },
  });

  doc.save(`DRE_${periodo.replace(/\s/g, "_")}.pdf`);
}

// ========= RO =========
interface CustoGrupo {
  label: string;
  total: number;
  items: { nome: string; valor: number }[];
}

interface CanalVenda {
  canal: string;
  qtde: number;
  totalRS: number;
  margemRS: number;
}

export function exportROtoPdf(
  receitaBruta: number,
  custoMatPrima: number,
  lucroBruto: number,
  lucroLiquido: number,
  totalCustos: number,
  custosAgrupados: CustoGrupo[],
  canais: CanalVenda[],
  mesLabel: string,
) {
  const doc = createBasePdf({ title: "Resultado Operacional", periodo: mesLabel });

  // KPIs
  let y = 33;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const kpis = [
    { label: "Receita Bruta", value: formatCurrency(receitaBruta) },
    { label: "Lucro Bruto", value: formatCurrency(lucroBruto) },
    { label: "Resultado", value: formatCurrency(lucroLiquido) },
    { label: "Custos Totais", value: formatCurrency(totalCustos) },
  ];
  kpis.forEach((kpi, i) => {
    const x = 14 + i * 68;
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(x, y, 62, 16, 2, 2, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(kpi.label, x + 4, y + 6);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(kpi.value, x + 4, y + 13);
  });

  y += 22;

  // DRE table
  const dreBody: string[][] = [
    ["Receita Bruta", formatCurrency(receitaBruta)],
    ["(-) Custo Mat. Prima", formatCurrency(-custoMatPrima)],
    ["= Lucro Bruto", formatCurrency(lucroBruto)],
    ...custosAgrupados.map(g => [`(-) ${g.label}`, formatCurrency(-g.total)]),
    ["RESULTADO", formatCurrency(lucroLiquido)],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Descrição", "Valor (R$)"]],
    body: dreBody,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [41, 98, 89], textColor: 255 },
    columnStyles: { 1: { halign: "right" } },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.row.index === dreBody.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = lucroLiquido >= 0 ? [230, 245, 235] : [255, 230, 230];
      }
    },
  });

  // Canais table on same page if space
  const lastY = (doc as any).lastAutoTable?.finalY || y + 60;
  if (canais.length > 0) {
    autoTable(doc, {
      startY: lastY + 8,
      head: [["Canal", "Qtde", "Total R$", "Margem R$"]],
      body: canais.map(c => [c.canal, String(c.qtde), formatCurrency(c.totalRS), formatCurrency(c.margemRS)]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [41, 98, 89], textColor: 255 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
  }

  doc.save(`Resultado_Operacional_${mesLabel.replace(/\s/g, "_")}.pdf`);
}

// ========= PE =========
interface CustoFixoItem {
  descricao: string;
  valor: number;
}

export function exportPEtoPdf(
  peUnidades: number,
  peReais: number,
  margemContribuicao: number,
  margemPercentual: number,
  totalCustosFixos: number,
  precoVendaUnit: number,
  custoVariavelUnit: number,
  custosFixos: CustoFixoItem[],
  vendasMesAtual: number,
) {
  const doc = createBasePdf({ title: "Ponto de Equilíbrio", subtitle: "Análise de Break-Even" });

  let y = 33;

  // KPIs
  doc.setFontSize(10);
  const kpis = [
    { label: "PE Unidades", value: `${peUnidades} un./mês` },
    { label: "PE Faturamento", value: formatCurrency(peReais) },
    { label: "Margem Contrib.", value: `${formatCurrency(margemContribuicao)} (${margemPercentual.toFixed(1)}%)` },
    { label: "Custos Fixos", value: formatCurrency(totalCustosFixos) },
  ];
  kpis.forEach((kpi, i) => {
    const x = 14 + i * 68;
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(x, y, 62, 16, 2, 2, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(kpi.label, x + 4, y + 6);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(kpi.value, x + 4, y + 13);
  });

  y += 22;

  // Parâmetros
  autoTable(doc, {
    startY: y,
    head: [["Parâmetro", "Valor"]],
    body: [
      ["Preço de Venda Unitário", formatCurrency(precoVendaUnit)],
      ["Custo Variável Unitário", formatCurrency(custoVariavelUnit)],
      ["Margem de Contribuição", `${formatCurrency(margemContribuicao)} (${margemPercentual.toFixed(1)}%)`],
      ["Vendas Mês Atual", `${vendasMesAtual} unidades`],
      ["Status", vendasMesAtual >= peUnidades ? "✓ PE Atingido" : `Faltam ${peUnidades - vendasMesAtual} un.`],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [41, 98, 89], textColor: 255 },
    columnStyles: { 1: { halign: "right" } },
  });

  const lastY = (doc as any).lastAutoTable?.finalY || y + 40;

  // Custos fixos
  autoTable(doc, {
    startY: lastY + 8,
    head: [["Descrição", "Valor (R$)"]],
    body: [
      ...custosFixos.map(c => [c.descricao, formatCurrency(c.valor)]),
      ["TOTAL", formatCurrency(totalCustosFixos)],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [41, 98, 89], textColor: 255 },
    columnStyles: { 1: { halign: "right" } },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.row.index === custosFixos.length) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [240, 240, 240];
      }
    },
  });

  doc.save("Ponto_de_Equilibrio.pdf");
}

/** Abre a janela de impressão do navegador para a área visível */
export function handlePrint() {
  window.print();
}

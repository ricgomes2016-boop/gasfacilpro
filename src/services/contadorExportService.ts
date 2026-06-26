import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export interface ExportColumn {
  header: string;
  key: string;
  align?: "left" | "right" | "center";
  format?: (value: any, row: any) => string;
}

export interface ExportTotal {
  label: string;
  value: string;
}

export interface ExportPDFOptions {
  titulo: string;
  empresa: string;
  escopo: string;
  periodoLabel: string;
  colunas: ExportColumn[];
  linhas: any[];
  totais?: ExportTotal[];
  groupBy?: string;
  filename: string;
}

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export function buildFilename(
  empresa: string,
  relatorio: string,
  escopo: string,
  periodoLabel: string,
  ext: "csv" | "pdf"
): string {
  return `${slugify(empresa)}_${slugify(relatorio)}_${slugify(escopo)}_${slugify(periodoLabel)}.${ext}`;
}

/* ---------------- CSV ---------------- */

function escapeCsv(value: any): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportarCSV(
  colunas: ExportColumn[],
  linhas: any[],
  filename: string,
  totais?: ExportTotal[]
) {
  const sep = ";";
  const header = colunas.map((c) => escapeCsv(c.header)).join(sep);
  const rows = linhas.map((row) =>
    colunas
      .map((c) => {
        const raw = row[c.key];
        const v = c.format ? c.format(raw, row) : raw;
        return escapeCsv(v);
      })
      .join(sep)
  );
  let content = [header, ...rows].join("\r\n");
  if (totais && totais.length > 0) {
    content += "\r\n\r\n";
    content += totais.map((t) => `${escapeCsv(t.label)}${sep}${escapeCsv(t.value)}`).join("\r\n");
  }
  // BOM UTF-8 para Excel BR
  const blob = new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------- PDF ---------------- */

export function exportarPDF(opts: ExportPDFOptions) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(opts.titulo, 14, 14);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);
  doc.text(`Empresa: ${opts.empresa}`, 14, 20);
  doc.text(`Escopo: ${opts.escopo}`, 14, 25);
  doc.text(`Período: ${opts.periodoLabel}`, 14, 30);
  const geradoEm = `Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`;
  doc.text(geradoEm, pageWidth - 14 - doc.getTextWidth(geradoEm), 20);

  doc.setTextColor(0, 0, 0);

  const head = [opts.colunas.map((c) => c.header)];

  // Optional grouping
  let startY = 36;
  if (opts.groupBy) {
    const groups: Record<string, any[]> = {};
    opts.linhas.forEach((row) => {
      const k = String(row[opts.groupBy!] ?? "—");
      if (!groups[k]) groups[k] = [];
      groups[k].push(row);
    });
    Object.entries(groups).forEach(([groupKey, rows]) => {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text(`▸ ${groupKey} (${rows.length})`, 14, startY);
      startY += 4;
      const body = rows.map((row) =>
        opts.colunas.map((c) => {
          const raw = row[c.key];
          return c.format ? c.format(raw, row) : raw == null ? "" : String(raw);
        })
      );
      autoTable(doc, {
        startY,
        head,
        body,
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [40, 60, 80], textColor: 255 },
        columnStyles: opts.colunas.reduce((acc: any, c, i) => {
          if (c.align) acc[i] = { halign: c.align };
          return acc;
        }, {}),
        margin: { left: 14, right: 14 },
      });
      startY = (doc as any).lastAutoTable.finalY + 6;
    });
  } else {
    const body = opts.linhas.map((row) =>
      opts.colunas.map((c) => {
        const raw = row[c.key];
        return c.format ? c.format(raw, row) : raw == null ? "" : String(raw);
      })
    );
    autoTable(doc, {
      startY,
      head,
      body,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [40, 60, 80], textColor: 255 },
      columnStyles: opts.colunas.reduce((acc: any, c, i) => {
        if (c.align) acc[i] = { halign: c.align };
        return acc;
      }, {}),
      margin: { left: 14, right: 14 },
    });
    startY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Totals
  if (opts.totais && opts.totais.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    opts.totais.forEach((t, i) => {
      doc.text(`${t.label}: ${t.value}`, 14, startY + i * 5);
    });
  }

  // Footer page numbers
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - 14,
      doc.internal.pageSize.getHeight() - 8,
      { align: "right" }
    );
  }

  doc.save(opts.filename);
}

export const fmt = {
  brl: fmtBRL,
  date: (d: string | Date | null | undefined) => {
    if (!d) return "";
    try {
      return format(new Date(d), "dd/MM/yyyy");
    } catch {
      return String(d);
    }
  },
};

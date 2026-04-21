import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import {
  exportarCSV,
  exportarPDF,
  buildFilename,
  ExportColumn,
  ExportTotal,
} from "@/services/contadorExportService";

interface Props {
  relatorio: string; // "despesas", "extratos", "xmls", "consolidado"
  titulo: string;
  empresa: string;
  escopo: string; // "Todas as lojas — 7 unidades" ou "Matriz"
  periodoLabel: string;
  colunas: ExportColumn[];
  linhas: any[];
  totais?: ExportTotal[];
  groupByPDF?: string;
  disabled?: boolean;
}

export function BotaoExportar({
  relatorio,
  titulo,
  empresa,
  escopo,
  periodoLabel,
  colunas,
  linhas,
  totais,
  groupByPDF,
  disabled,
}: Props) {
  const handleCSV = () => {
    const filename = buildFilename(empresa, relatorio, escopo, periodoLabel, "csv");
    exportarCSV(colunas, linhas, filename, totais);
  };

  const handlePDF = () => {
    const filename = buildFilename(empresa, relatorio, escopo, periodoLabel, "pdf");
    exportarPDF({
      titulo,
      empresa,
      escopo,
      periodoLabel,
      colunas,
      linhas,
      totais,
      groupBy: groupByPDF,
      filename,
    });
  };

  const isEmpty = !linhas || linhas.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled || isEmpty}
          className="border-[hsl(220,15%,22%)] text-[hsl(0,0%,90%)] hover:bg-[hsl(220,18%,15%)]"
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
        <DropdownMenuItem onClick={handleCSV} className="text-[hsl(0,0%,90%)] cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 mr-2 text-[hsl(150,60%,55%)]" />
          Baixar CSV (Excel)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePDF} className="text-[hsl(0,0%,90%)] cursor-pointer">
          <FileText className="h-4 w-4 mr-2 text-[hsl(0,75%,65%)]" />
          Baixar PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

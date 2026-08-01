import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Download, FileSpreadsheet, Loader2, RefreshCw, Store } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { EstoquePageHeader } from "@/components/estoque/EstoquePageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Unidade, useUnidade } from "@/contexts/UnidadeContext";

type GrupoProduto = "P13" | "P20" | "P45" | "Agua";
type TipoEstoque = "cheio" | "vazio";

interface ProdutoConferencia {
  id: string;
  nome: string;
  estoque: number | null;
  tipo_botijao: string | null;
  categoria: string | null;
  unidade_id: string | null;
}

type TotaisProduto = Record<GrupoProduto, Record<TipoEstoque, number>>;

interface LinhaConferencia {
  unidade: Unidade;
  totais: TotaisProduto;
  totalGeral: number;
}

const grupos: { key: GrupoProduto; label: string; tone: string; mobileTone: string }[] = [
  { key: "P13", label: "P13", tone: "bg-[#e66f2f] text-white", mobileTone: "border-[#e66f2f]/30 bg-[#fff4ed]" },
  { key: "P20", label: "P20", tone: "bg-[#e66f2f] text-white", mobileTone: "border-[#e66f2f]/30 bg-[#fff4ed]" },
  { key: "P45", label: "P45", tone: "bg-[#e66f2f] text-white", mobileTone: "border-[#e66f2f]/30 bg-[#fff4ed]" },
  { key: "Agua", label: "Água", tone: "bg-[#198fbe] text-white", mobileTone: "border-[#198fbe]/30 bg-[#eef9fd]" },
];

const criarTotaisZerados = (): TotaisProduto => ({
  P13: { cheio: 0, vazio: 0 },
  P20: { cheio: 0, vazio: 0 },
  P45: { cheio: 0, vazio: 0 },
  Agua: { cheio: 0, vazio: 0 },
});

const normalizar = (texto: string | null | undefined) =>
  (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const identificarGrupo = (produto: ProdutoConferencia): GrupoProduto | null => {
  const alvo = `${produto.nome} ${produto.categoria || ""}`;
  const texto = normalizar(alvo);

  if (texto.includes("agua") || /\b20\s*l\b/.test(texto) || texto.includes("galao")) return "Agua";
  if (/\bp\s*45\b/.test(texto) || /\b45\s*kg\b/.test(texto) || texto.includes("p45")) return "P45";
  if (/\bp\s*20\b/.test(texto) || /\b20\s*kg\b/.test(texto) || texto.includes("p20")) return "P20";
  if (/\bp\s*13\b/.test(texto) || /\b13\s*kg\b/.test(texto) || texto.includes("p13")) return "P13";

  return null;
};

const identificarTipo = (produto: ProdutoConferencia): TipoEstoque => {
  const texto = normalizar(`${produto.tipo_botijao || ""} ${produto.nome}`);
  return texto.includes("vazio") || texto.includes("vasilhame") ? "vazio" : "cheio";
};

const formatarDataBR = (data: string) =>
  format(parseISO(`${data}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });

const nomeArquivoSeguro = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

export default function ConferenciaEstoque() {
  const { toast } = useToast();
  const { unidades, unidadeAtual, loading: unidadesLoading } = useUnidade();
  const [dataConferencia, setDataConferencia] = useState(format(new Date(), "yyyy-MM-dd"));
  const [lojaFiltro, setLojaFiltro] = useState("todas");
  const [produtos, setProdutos] = useState<ProdutoConferencia[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const lojasVisiveis = useMemo(() => {
    if (lojaFiltro === "todas") return unidades;
    return unidades.filter((unidade) => unidade.id === lojaFiltro);
  }, [lojaFiltro, unidades]);

  const escopoLabel = lojaFiltro === "todas"
    ? "Todas as lojas"
    : lojasVisiveis[0]?.nome || unidadeAtual?.nome || "Loja selecionada";

  const carregarProdutos = async () => {
    if (unidadesLoading) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from("produtos")
        .select("id, nome, estoque, tipo_botijao, categoria, unidade_id")
        .eq("ativo", true)
        .order("nome");

      if (lojaFiltro !== "todas") {
        query = query.eq("unidade_id", lojaFiltro);
      } else if (unidades.length > 0) {
        query = query.in("unidade_id", unidades.map((unidade) => unidade.id));
      }

      const { data, error } = await query;

      if (error) throw error;
      setProdutos((data || []) as ProdutoConferencia[]);
    } catch (error) {
      console.error("Erro ao carregar conferencia de estoque:", error);
      toast({
        title: "Erro ao carregar estoque",
        description: "Nao foi possivel buscar os produtos para conferencia.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarProdutos();
  }, [lojaFiltro, unidadesLoading, unidades.length]);

  const linhas = useMemo<LinhaConferencia[]>(() => {
    return lojasVisiveis.map((unidade) => {
      const totais = criarTotaisZerados();

      produtos
        .filter((produto) => produto.unidade_id === unidade.id)
        .forEach((produto) => {
          const grupo = identificarGrupo(produto);
          if (!grupo) return;

          const tipo = identificarTipo(produto);
          totais[grupo][tipo] += Number(produto.estoque || 0);
        });

      const totalGeral = grupos.reduce(
        (acc, grupo) => acc + totais[grupo.key].cheio + totais[grupo.key].vazio,
        0
      );

      return { unidade, totais, totalGeral };
    });
  }, [lojasVisiveis, produtos]);

  const resumo = useMemo(() => {
    return linhas.reduce(
      (acc, linha) => {
        grupos.forEach((grupo) => {
          acc.cheios += linha.totais[grupo.key].cheio;
          acc.vazios += linha.totais[grupo.key].vazio;
        });
        acc.total += linha.totalGeral;
        return acc;
      },
      { cheios: 0, vazios: 0, total: 0 }
    );
  }, [linhas]);

  const montarLinhasExportacao = () =>
    linhas.map((linha) => [
      linha.unidade.nome,
      linha.totais.P13.cheio,
      linha.totais.P13.vazio,
      linha.totais.P20.cheio,
      linha.totais.P20.vazio,
      linha.totais.P45.cheio,
      linha.totais.P45.vazio,
      linha.totais.Agua.cheio,
      linha.totais.Agua.vazio,
    ]);

  const exportarExcel = () => {
    if (linhas.length === 0) {
      toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      return;
    }

    const aoa = [
      [`Conferencia de Estoque - ${formatarDataBR(dataConferencia)}`],
      [`Escopo: ${escopoLabel}`],
      ["Lojas", "P13", "", "P20", "", "P45", "", "Agua", ""],
      ["", "Cheio", "Vazio", "Cheio", "Vazio", "Cheio", "Vazio", "Cheio", "Vazio"],
      ...montarLinhasExportacao(),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
      { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
      { s: { r: 2, c: 3 }, e: { r: 2, c: 4 } },
      { s: { r: 2, c: 5 }, e: { r: 2, c: 6 } },
      { s: { r: 2, c: 7 }, e: { r: 2, c: 8 } },
    ];
    ws["!cols"] = [
      { wch: 22 },
      { wch: 9 },
      { wch: 9 },
      { wch: 9 },
      { wch: 9 },
      { wch: 9 },
      { wch: 9 },
      { wch: 9 },
      { wch: 9 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Conferencia");
    XLSX.writeFile(
      wb,
      `conferencia-estoque-${dataConferencia}-${nomeArquivoSeguro(escopoLabel)}.xlsx`
    );
  };

  const exportarPDF = () => {
    if (linhas.length === 0) {
      toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(15);
    doc.text("Conferencia de Estoque", 14, 16);
    doc.setFontSize(10);
    doc.text(`Data: ${formatarDataBR(dataConferencia)} | Escopo: ${escopoLabel}`, 14, 23);

    autoTable(doc, {
      startY: 30,
      head: [
        ["Lojas", "P13", "", "P20", "", "P45", "", "Agua", ""],
        ["", "Cheio", "Vazio", "Cheio", "Vazio", "Cheio", "Vazio", "Cheio", "Vazio"],
      ],
      body: montarLinhasExportacao(),
      theme: "grid",
      styles: {
        halign: "center",
        valign: "middle",
        fontSize: 10,
        cellPadding: 2,
        lineColor: [30, 41, 59],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { halign: "left", fontStyle: "bold", cellWidth: 42 },
      },
      headStyles: {
        fillColor: [17, 24, 39],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    doc.save(`conferencia-estoque-${dataConferencia}-${nomeArquivoSeguro(escopoLabel)}.pdf`);
  };

  return (
    <MainLayout>
      <Header title="Conferência de Estoque" subtitle="Gestão de Estoque" />
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 p-3 sm:p-6">
        <EstoquePageHeader
          title="Conferência diária"
          description="Fechamento visual de cheios e vazios por loja, no mesmo formato usado na conferência física."
          actions={
            <>
              <Button variant="outline" size="sm" className="h-10 gap-2" onClick={carregarProdutos} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Atualizar
              </Button>
              <Button variant="outline" size="sm" className="h-10 gap-2" onClick={exportarPDF}>
                <Download className="h-4 w-4" />
                PDF
              </Button>
              <Button size="sm" className="h-10 gap-2" onClick={exportarExcel}>
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
            </>
          }
        />

        <Card className="border-border/70 shadow-[0_12px_36px_rgba(15,23,42,0.07)]">
          <CardContent className="p-4">
            <div className="grid gap-3 md:grid-cols-[180px_1fr_1fr_auto] md:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Data da conferência
                </Label>
                <Input
                  type="date"
                  value={dataConferencia}
                  onChange={(event) => setDataConferencia(event.target.value)}
                  className="h-10 rounded-lg"
                />
              </div>

              <div className="space-y-1.5 md:max-w-[320px]">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Loja
                </Label>
                <Select value={lojaFiltro} onValueChange={setLojaFiltro}>
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue placeholder="Selecione a loja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as lojas juntas</SelectItem>
                    {unidades.map((unidade) => (
                      <SelectItem key={unidade.id} value={unidade.id}>
                        {unidade.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">Cheios</p>
                  <p className="text-xl font-bold text-slate-950">{resumo.cheios}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">Vazios</p>
                  <p className="text-xl font-bold text-slate-950">{resumo.vazios}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">Total</p>
                  <p className="text-xl font-bold text-slate-950">{resumo.total}</p>
                </div>
              </div>

              <div className="hidden items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 md:flex">
                <Store className="h-4 w-4" />
                {escopoLabel}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hidden overflow-hidden border-slate-300 shadow-[0_14px_40px_rgba(15,23,42,0.08)] md:block">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse bg-white text-sm">
                <thead>
                  <tr>
                    <th
                      colSpan={9}
                      className="border border-slate-900 bg-white px-3 py-1.5 text-center text-lg font-black text-slate-950"
                    >
                      {formatarDataBR(dataConferencia)}
                    </th>
                  </tr>
                  <tr>
                    <th
                      rowSpan={2}
                      className="w-[210px] border border-slate-900 bg-slate-800 px-3 py-3 text-center text-base font-black text-white"
                    >
                      Lojas
                    </th>
                    {grupos.map((grupo) => (
                      <th key={grupo.key} colSpan={2} className={`border border-slate-900 px-3 py-1.5 text-base font-black ${grupo.tone}`}>
                        {grupo.label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {grupos.flatMap((grupo) => [
                      <th key={`${grupo.key}-cheio`} className="border border-slate-900 bg-slate-200 px-3 py-1.5 font-black text-slate-950">
                        Cheio
                      </th>,
                      <th key={`${grupo.key}-vazio`} className="border border-slate-900 bg-slate-200 px-3 py-1.5 font-black text-slate-950">
                        Vazio
                      </th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {isLoading || unidadesLoading ? (
                    <tr>
                      <td colSpan={9} className="border border-slate-300 px-3 py-10 text-center text-muted-foreground">
                        Carregando conferência...
                      </td>
                    </tr>
                  ) : linhas.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="border border-slate-300 px-3 py-10 text-center text-muted-foreground">
                        Nenhuma loja encontrada para o filtro selecionado.
                      </td>
                    </tr>
                  ) : (
                    linhas.map((linha) => (
                      <tr key={linha.unidade.id} className="hover:bg-blue-50/40">
                        <td className="border border-slate-900 bg-slate-100 px-2 py-1.5 font-black text-slate-950">
                          {linha.unidade.nome}
                        </td>
                        {grupos.flatMap((grupo) => [
                          <td key={`${linha.unidade.id}-${grupo.key}-cheio`} className="border border-slate-900 px-3 py-1.5 text-center font-black text-blue-700">
                            {linha.totais[grupo.key].cheio || ""}
                          </td>,
                          <td key={`${linha.unidade.id}-${grupo.key}-vazio`} className="border border-slate-900 px-3 py-1.5 text-center font-black text-blue-700">
                            {linha.totais[grupo.key].vazio || ""}
                          </td>,
                        ])}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:hidden">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {formatarDataBR(dataConferencia)}
              </p>
              <p className="text-base font-bold text-slate-950">{escopoLabel}</p>
            </div>
            <CalendarDays className="h-5 w-5 text-blue-600" />
          </div>

          {isLoading || unidadesLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Carregando conferência...
              </CardContent>
            </Card>
          ) : linhas.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma loja encontrada para o filtro selecionado.
              </CardContent>
            </Card>
          ) : (
            linhas.map((linha) => (
              <Card key={linha.unidade.id} className="overflow-hidden border-slate-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="border-b border-slate-200 bg-slate-900 px-4 py-3">
                    <p className="text-base font-black text-white">{linha.unidade.nome}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-3">
                    {grupos.map((grupo) => (
                      <div key={grupo.key} className={`rounded-lg border p-3 ${grupo.mobileTone}`}>
                        <p className="mb-2 text-sm font-black text-slate-950">{grupo.label}</p>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="rounded-md bg-white px-2 py-2 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase text-slate-500">Cheio</p>
                            <p className="text-lg font-black text-blue-700">{linha.totais[grupo.key].cheio}</p>
                          </div>
                          <div className="rounded-md bg-white px-2 py-2 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase text-slate-500">Vazio</p>
                            <p className="text-lg font-black text-blue-700">{linha.totais[grupo.key].vazio}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}

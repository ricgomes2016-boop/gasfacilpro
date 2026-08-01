import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Download, FileSpreadsheet, Loader2, RefreshCw, Save, Store } from "lucide-react";
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
import { useAuth } from "@/contexts/AuthContext";
import { Unidade, useUnidade } from "@/contexts/UnidadeContext";
import { useToast } from "@/hooks/use-toast";

type GrupoProduto = "P13" | "P20" | "P45" | "Agua";
type TipoEstoque = "cheio" | "vazio";
type ValoresConferencia = Record<string, Record<GrupoProduto, Record<TipoEstoque, number>>>;
type ModoPersistencia = "banco" | "local";

interface RegistroConferencia {
  unidade_id: string;
  produto_grupo: GrupoProduto;
  tipo_estoque: TipoEstoque;
  quantidade: number;
}

interface LinhaConferencia {
  unidade: Unidade;
  totais: Record<GrupoProduto, Record<TipoEstoque, number>>;
  totalGeral: number;
}

const grupos: { key: GrupoProduto; label: string; tone: string; mobileTone: string }[] = [
  { key: "P13", label: "P13", tone: "bg-[#e66f2f] text-white", mobileTone: "border-[#e66f2f]/30 bg-[#fff4ed]" },
  { key: "P20", label: "P20", tone: "bg-[#e66f2f] text-white", mobileTone: "border-[#e66f2f]/30 bg-[#fff4ed]" },
  { key: "P45", label: "P45", tone: "bg-[#e66f2f] text-white", mobileTone: "border-[#e66f2f]/30 bg-[#fff4ed]" },
  { key: "Agua", label: "Agua", tone: "bg-[#198fbe] text-white", mobileTone: "border-[#198fbe]/30 bg-[#eef9fd]" },
];

const criarTotaisZerados = () => ({
  P13: { cheio: 0, vazio: 0 },
  P20: { cheio: 0, vazio: 0 },
  P45: { cheio: 0, vazio: 0 },
  Agua: { cheio: 0, vazio: 0 },
});

const formatarDataBR = (data: string) =>
  format(parseISO(`${data}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });

const nomeArquivoSeguro = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const criarValoresVazios = (lojas: Unidade[]): ValoresConferencia =>
  lojas.reduce((acc, loja) => {
    acc[loja.id] = criarTotaisZerados();
    return acc;
  }, {} as ValoresConferencia);

export default function ConferenciaEstoque() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { unidades, unidadeAtual, loading: unidadesLoading } = useUnidade();
  const [dataConferencia, setDataConferencia] = useState(format(new Date(), "yyyy-MM-dd"));
  const [lojaFiltro, setLojaFiltro] = useState("todas");
  const [valores, setValores] = useState<ValoresConferencia>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modoPersistencia, setModoPersistencia] = useState<ModoPersistencia>("banco");

  const lojasVisiveis = useMemo(() => {
    if (lojaFiltro === "todas") return unidades;
    return unidades.filter((unidade) => unidade.id === lojaFiltro);
  }, [lojaFiltro, unidades]);

  const escopoLabel = lojaFiltro === "todas"
    ? "Todas as lojas"
    : lojasVisiveis[0]?.nome || unidadeAtual?.nome || "Loja selecionada";

  const getLocalStorageKey = () =>
    `gasfacil:estoque-conferencia:${dataConferencia}:${lojaFiltro}`;

  const carregarConferenciaLocal = (base: ValoresConferencia) => {
    try {
      const salvo = localStorage.getItem(getLocalStorageKey());
      return salvo ? { ...base, ...JSON.parse(salvo) } : base;
    } catch {
      return base;
    }
  };

  const salvarConferenciaLocal = (dados: ValoresConferencia) => {
    localStorage.setItem(getLocalStorageKey(), JSON.stringify(dados));
  };

  const carregarConferencia = async () => {
    if (unidadesLoading) return;

    const base = criarValoresVazios(unidades);
    setIsLoading(true);

    try {
      let query = (supabase as any)
        .from("estoque_conferencias")
        .select("unidade_id, produto_grupo, tipo_estoque, quantidade")
        .eq("data_conferencia", dataConferencia);

      if (lojaFiltro !== "todas") {
        query = query.eq("unidade_id", lojaFiltro);
      } else if (unidades.length > 0) {
        query = query.in("unidade_id", unidades.map((unidade) => unidade.id));
      }

      const { data, error } = await query;
      if (error) throw error;

      (data || []).forEach((registro: RegistroConferencia) => {
        if (!base[registro.unidade_id]) base[registro.unidade_id] = criarTotaisZerados();
        base[registro.unidade_id][registro.produto_grupo][registro.tipo_estoque] = Number(registro.quantidade || 0);
      });

      setValores(base);
      setModoPersistencia("banco");
    } catch (error) {
      console.error("Erro ao carregar conferencia manual:", error);
      setModoPersistencia("local");
      setValores(carregarConferenciaLocal(base));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarConferencia();
  }, [dataConferencia, lojaFiltro, unidadesLoading, unidades.length]);

  const atualizarValor = (unidadeId: string, grupo: GrupoProduto, tipo: TipoEstoque, value: string) => {
    const quantidade = Math.max(0, Number(value || 0));

    setValores((prev) => {
      const next = { ...prev };
      next[unidadeId] = next[unidadeId] || criarTotaisZerados();
      next[unidadeId] = {
        ...next[unidadeId],
        [grupo]: {
          ...next[unidadeId][grupo],
          [tipo]: Number.isFinite(quantidade) ? quantidade : 0,
        },
      };
      return next;
    });
  };

  const linhas = useMemo<LinhaConferencia[]>(() => {
    return lojasVisiveis.map((unidade) => {
      const totais = valores[unidade.id] || criarTotaisZerados();
      const totalGeral = grupos.reduce(
        (acc, grupo) => acc + totais[grupo.key].cheio + totais[grupo.key].vazio,
        0
      );

      return { unidade, totais, totalGeral };
    });
  }, [lojasVisiveis, valores]);

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

  const salvarConferencia = async () => {
    if (linhas.length === 0) {
      toast({ title: "Nenhuma loja para salvar", variant: "destructive" });
      return;
    }

    const registros = linhas.flatMap((linha) =>
      grupos.flatMap((grupo) => [
        {
          data_conferencia: dataConferencia,
          unidade_id: linha.unidade.id,
          produto_grupo: grupo.key,
          tipo_estoque: "cheio",
          quantidade: linha.totais[grupo.key].cheio || 0,
          conferido_por: user?.id || null,
        },
        {
          data_conferencia: dataConferencia,
          unidade_id: linha.unidade.id,
          produto_grupo: grupo.key,
          tipo_estoque: "vazio",
          quantidade: linha.totais[grupo.key].vazio || 0,
          conferido_por: user?.id || null,
        },
      ])
    );

    setIsSaving(true);
    try {
      if (modoPersistencia === "local") {
        salvarConferenciaLocal(valores);
        toast({
          title: "Conferência salva localmente",
          description: "Assim que a tabela estiver publicada no Lovable, o salvamento irá para o Supabase.",
        });
        return;
      }

      const { error } = await (supabase as any)
        .from("estoque_conferencias")
        .upsert(registros, {
          onConflict: "data_conferencia,unidade_id,produto_grupo,tipo_estoque",
        });

      if (error) throw error;
      toast({ title: "Conferência salva", description: `${escopoLabel} - ${formatarDataBR(dataConferencia)}` });
    } catch (error) {
      console.error("Erro ao salvar conferencia manual:", error);
      setModoPersistencia("local");
      salvarConferenciaLocal(valores);
      toast({
        title: "Conferência salva localmente",
        description: "O Supabase do Lovable ainda não aceitou a tabela; mantive os dados neste navegador.",
      });
    } finally {
      setIsSaving(false);
    }
  };

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
    ws["!cols"] = [{ wch: 22 }, ...Array.from({ length: 8 }, () => ({ wch: 9 }))];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Conferencia");
    XLSX.writeFile(wb, `conferencia-estoque-${dataConferencia}-${nomeArquivoSeguro(escopoLabel)}.xlsx`);
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
      columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 42 } },
      headStyles: {
        fillColor: [17, 24, 39],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`conferencia-estoque-${dataConferencia}-${nomeArquivoSeguro(escopoLabel)}.pdf`);
  };

  return (
    <MainLayout>
      <Header title="Conferência de Estoque" subtitle="Gestão de Estoque" />
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 p-3 sm:p-6">
        <EstoquePageHeader
          title="Conferência diária manual"
          description="Digite os valores conferidos fisicamente por loja. A exportação usa exatamente os números informados."
          actions={
            <>
              <Button variant="outline" size="sm" className="h-10 gap-2" onClick={carregarConferencia} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Atualizar
              </Button>
              <Button size="sm" className="h-10 gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={salvarConferencia} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
              <Button variant="outline" size="sm" className="h-10 gap-2" onClick={exportarPDF}>
                <Download className="h-4 w-4" />
                PDF
              </Button>
              <Button variant="outline" size="sm" className="h-10 gap-2" onClick={exportarExcel}>
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
                {modoPersistencia === "local" ? "Modo local" : escopoLabel}
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
                    <th colSpan={9} className="border border-slate-900 bg-white px-3 py-1.5 text-center text-lg font-black text-slate-950">
                      {formatarDataBR(dataConferencia)}
                    </th>
                  </tr>
                  <tr>
                    <th rowSpan={2} className="w-[210px] border border-slate-900 bg-slate-800 px-3 py-3 text-center text-base font-black text-white">
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
                          <td key={`${linha.unidade.id}-${grupo.key}-cheio`} className="border border-slate-900 p-0">
                            <Input
                              type="number"
                              min="0"
                              inputMode="numeric"
                              value={linha.totais[grupo.key].cheio || ""}
                              onChange={(event) => atualizarValor(linha.unidade.id, grupo.key, "cheio", event.target.value)}
                              className="h-10 rounded-none border-0 text-center text-base font-black text-blue-700 shadow-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            />
                          </td>,
                          <td key={`${linha.unidade.id}-${grupo.key}-vazio`} className="border border-slate-900 p-0">
                            <Input
                              type="number"
                              min="0"
                              inputMode="numeric"
                              value={linha.totais[grupo.key].vazio || ""}
                              onChange={(event) => atualizarValor(linha.unidade.id, grupo.key, "vazio", event.target.value)}
                              className="h-10 rounded-none border-0 text-center text-base font-black text-blue-700 shadow-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            />
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
                  <div className="grid grid-cols-1 gap-2 p-3 xs:grid-cols-2">
                    {grupos.map((grupo) => (
                      <div key={grupo.key} className={`rounded-lg border p-3 ${grupo.mobileTone}`}>
                        <p className="mb-2 text-sm font-black text-slate-950">{grupo.label}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1 rounded-md bg-white px-2 py-2 shadow-sm">
                            <Label className="text-[11px] font-semibold uppercase text-slate-500">Cheio</Label>
                            <Input
                              type="number"
                              min="0"
                              inputMode="numeric"
                              value={linha.totais[grupo.key].cheio || ""}
                              onChange={(event) => atualizarValor(linha.unidade.id, grupo.key, "cheio", event.target.value)}
                              className="h-9 rounded-md text-center text-lg font-black text-blue-700"
                            />
                          </div>
                          <div className="space-y-1 rounded-md bg-white px-2 py-2 shadow-sm">
                            <Label className="text-[11px] font-semibold uppercase text-slate-500">Vazio</Label>
                            <Input
                              type="number"
                              min="0"
                              inputMode="numeric"
                              value={linha.totais[grupo.key].vazio || ""}
                              onChange={(event) => atualizarValor(linha.unidade.id, grupo.key, "vazio", event.target.value)}
                              className="h-9 rounded-md text-center text-lg font-black text-blue-700"
                            />
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

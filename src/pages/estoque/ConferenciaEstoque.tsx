import { useEffect, useMemo, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Download, FileSpreadsheet, Loader2, RefreshCw, Save, Store, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { calcularFluxoConferencia } from "@/lib/estoque/conferenciaFluxo";
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

interface MovTransferencia {
  id: string;
  unidade_id: string;
  unidade_destino_id: string | null;
  produto_grupo: GrupoProduto;
  quantidade: number;
}

const colunasFluxo = [
  { key: "ini", label: "Inicial", bg: "bg-slate-100" },
  { key: "ent", label: "Entrada", bg: "bg-emerald-100" },
  { key: "tra", label: "Transf.", bg: "bg-purple-100" },
  { key: "che", label: "Cheio", bg: "bg-amber-100" },
  { key: "vaz", label: "Vazio", bg: "bg-slate-200" },
  { key: "tot", label: "Total", bg: "bg-slate-300" },
  { key: "ven", label: "Venda", bg: "bg-emerald-200" },
];

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
  const [saldoAnterior, setSaldoAnterior] = useState<Record<string, Partial<Record<GrupoProduto, number>>>>({});
  const [entradas, setEntradas] = useState<Record<string, Partial<Record<GrupoProduto, number>>>>({});
  const [transferencias, setTransferencias] = useState<MovTransferencia[]>([]);
  const [dialogTransf, setDialogTransf] = useState<{ unidadeId: string; grupo: GrupoProduto } | null>(null);
  const [transfDestino, setTransfDestino] = useState("nenhum");
  const [transfQtd, setTransfQtd] = useState("");
  const todasLojas = unidades;
  const dataAnterior = format(subDays(parseISO(`${dataConferencia}T12:00:00`), 1), "yyyy-MM-dd");

  const atualizarEntrada = (unidadeId: string, grupo: GrupoProduto, value: string) => {
    const q = Math.max(0, Math.floor(Number(value || 0)));
    setEntradas((prev) => ({ ...prev, [unidadeId]: { ...(prev[unidadeId] || {}), [grupo]: Number.isFinite(q) ? q : 0 } }));
  };

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

      const ids = unidades.map((u) => u.id);
      const [{ data: prev }, { data: movs }] = await Promise.all([
        (supabase as any)
          .from("estoque_conferencias")
          .select("unidade_id, produto_grupo, quantidade")
          .eq("data_conferencia", dataAnterior)
          .eq("tipo_estoque", "cheio")
          .in("unidade_id", ids),
        (supabase as any)
          .from("estoque_conferencia_movimentos")
          .select("id, unidade_id, unidade_destino_id, produto_grupo, quantidade, tipo")
          .eq("data_conferencia", dataConferencia),
      ]);
      const saldo: Record<string, Partial<Record<GrupoProduto, number>>> = {};
      (prev || []).forEach((r: any) => {
        saldo[r.unidade_id] = saldo[r.unidade_id] || {};
        saldo[r.unidade_id][r.produto_grupo as GrupoProduto] = Number(r.quantidade || 0);
      });
      const ent: Record<string, Partial<Record<GrupoProduto, number>>> = {};
      const trs: MovTransferencia[] = [];
      (movs || []).forEach((m: any) => {
        if (m.tipo === "entrada_manual") {
          ent[m.unidade_id] = ent[m.unidade_id] || {};
          ent[m.unidade_id][m.produto_grupo as GrupoProduto] = Number(m.quantidade || 0);
        } else {
          trs.push(m);
        }
      });
      setSaldoAnterior(saldo);
      setEntradas(ent);
      setTransferencias(trs);
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

  const entradaRecebida = (unidadeId: string, grupo: GrupoProduto) =>
    transferencias
      .filter((t) => t.unidade_destino_id === unidadeId && t.produto_grupo === grupo)
      .reduce((acc, t) => acc + Number(t.quantidade || 0), 0);

  const fluxo = (unidadeId: string, grupo: GrupoProduto) =>
    calcularFluxoConferencia({
      saldoInicial: saldoAnterior[unidadeId]?.[grupo] || 0,
      entrada: (entradas[unidadeId]?.[grupo] || 0) + entradaRecebida(unidadeId, grupo),
      transferencia: transferencias
        .filter((t) => t.unidade_id === unidadeId && t.produto_grupo === grupo)
        .reduce((acc, t) => acc + Number(t.quantidade || 0), 0),
      cheio: valores[unidadeId]?.[grupo]?.cheio || 0,
    });

  const resumo = useMemo(() => {
    const porGrupo = grupos.reduce((acc, g) => {
      acc[g.key] = { inicial: 0, entrada: 0, transf: 0, cheio: 0, vazio: 0, venda: 0 };
      return acc;
    }, {} as Record<GrupoProduto, { inicial: number; entrada: number; transf: number; cheio: number; vazio: number; venda: number }>);
    const acc = { inicial: 0, cheios: 0, vazios: 0, total: 0, venda: 0, porGrupo };
    linhas.forEach((linha) => {
      grupos.forEach((grupo) => {
        const f = fluxo(linha.unidade.id, grupo.key);
        const pg = porGrupo[grupo.key];
        pg.inicial += f.saldoInicial;
        pg.entrada += f.entrada;
        pg.transf += f.transferencia;
        pg.cheio += linha.totais[grupo.key].cheio;
        pg.vazio += linha.totais[grupo.key].vazio;
        pg.venda += f.vendaEsperada;
        acc.inicial += f.saldoInicial;
        acc.cheios += linha.totais[grupo.key].cheio;
        acc.vazios += linha.totais[grupo.key].vazio;
        acc.venda += f.vendaEsperada;
      });
      acc.total += linha.totalGeral;
    });
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, saldoAnterior, entradas, transferencias]);

  const nomeLoja = (id: string | null) => todasLojas.find((u) => u.id === id)?.nome || "Loja";

  const transferenciasDoDialog = useMemo(
    () =>
      dialogTransf
        ? transferencias.filter((t) => t.unidade_id === dialogTransf.unidadeId && t.produto_grupo === dialogTransf.grupo)
        : [],
    [dialogTransf, transferencias]
  );

  const abrirTransferencia = (unidadeId: string, grupo: GrupoProduto) => {
    setTransfDestino("nenhum");
    setTransfQtd("");
    setDialogTransf({ unidadeId, grupo });
  };

  const registrarTransferencia = async () => {
    if (!dialogTransf) return;
    const qtd = Math.floor(Number(transfQtd || 0));
    if (transfDestino === "nenhum" || qtd <= 0) {
      toast({ title: "Escolha a loja e a quantidade", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    const { data, error } = await (supabase as any)
      .from("estoque_conferencia_movimentos")
      .insert({
        data_conferencia: dataConferencia,
        unidade_id: dialogTransf.unidadeId,
        produto_grupo: dialogTransf.grupo,
        tipo: "transferencia",
        quantidade: qtd,
        unidade_destino_id: transfDestino,
        criado_por: user?.id || null,
      })
      .select("id, unidade_id, unidade_destino_id, produto_grupo, quantidade")
      .single();
    setIsSaving(false);
    if (error) {
      console.error(error);
      toast({ title: "Não foi possível registrar a transferência", variant: "destructive" });
      return;
    }
    setTransferencias((prev) => [...prev, data]);
    toast({ title: "Transferência registrada", description: `${qtd} ${dialogTransf.grupo} para ${nomeLoja(transfDestino)}` });
    setDialogTransf(null);
  };

  const excluirTransferencia = async (id: string) => {
    const { error } = await (supabase as any).from("estoque_conferencia_movimentos").delete().eq("id", id);
    if (error) {
      toast({ title: "Não foi possível excluir", variant: "destructive" });
      return;
    }
    setTransferencias((prev) => prev.filter((t) => t.id !== id));
  };

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

      const lojaIds = linhas.map((l) => l.unidade.id);
      const { error: delErr } = await (supabase as any)
        .from("estoque_conferencia_movimentos")
        .delete()
        .eq("data_conferencia", dataConferencia)
        .eq("tipo", "entrada_manual")
        .in("unidade_id", lojaIds);
      if (delErr) throw delErr;
      const entradasRegistros = lojaIds.flatMap((uid) =>
        grupos
          .filter((g) => (entradas[uid]?.[g.key] || 0) > 0)
          .map((g) => ({
            data_conferencia: dataConferencia,
            unidade_id: uid,
            produto_grupo: g.key,
            tipo: "entrada_manual",
            quantidade: entradas[uid][g.key],
            criado_por: user?.id || null,
          }))
      );
      if (entradasRegistros.length > 0) {
        const { error: insErr } = await (supabase as any).from("estoque_conferencia_movimentos").insert(entradasRegistros);
        if (insErr) throw insErr;
      }
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

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase text-slate-500">
                  Conferência do dia {formatarDataBR(dataConferencia)} · saldo inicial de {formatarDataBR(dataAnterior)}
                </p>
                <div className="grid grid-cols-1 gap-2 xs:grid-cols-2 lg:grid-cols-4">
                  {([
                    { label: "Saldo inicial", total: resumo.inicial, valor: (k: GrupoProduto) => resumo.porGrupo[k].inicial },
                    { label: "Cheios (contagem)", total: resumo.cheios, valor: (k: GrupoProduto) => resumo.porGrupo[k].cheio },
                    { label: "Vazios", total: resumo.vazios, valor: (k: GrupoProduto) => resumo.porGrupo[k].vazio },
                    { label: "Venda esperada", total: resumo.venda, valor: (k: GrupoProduto) => resumo.porGrupo[k].venda },
                  ]).map((card) => (
                    <div key={card.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase text-slate-500">{card.label}</p>
                      <p className="text-xl font-bold text-slate-950">{card.total}</p>
                      <p className="text-xs font-semibold text-slate-600">
                        {grupos.map((g) => `${card.valor(g.key)} ${g.label}`).join(" · ")}
                      </p>
                    </div>
                  ))}
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
              <table className="w-full min-w-[1600px] border-collapse bg-white text-sm">
                <thead>
                  <tr>
                    <th colSpan={29} className="border border-slate-900 bg-white px-3 py-1.5 text-center text-lg font-black text-slate-950">
                      Conferência do dia {formatarDataBR(dataConferencia)} — saldo inicial = contagem de {formatarDataBR(dataAnterior)}
                    </th>
                  </tr>
                  <tr>
                    <th rowSpan={2} className="sticky left-0 z-20 min-w-[180px] border border-slate-900 bg-slate-800 px-3 py-3 text-center text-base font-black text-white">
                      Lojas
                    </th>
                    {grupos.map((grupo) => (
                      <th key={grupo.key} colSpan={7} className={`border border-slate-900 px-3 py-1.5 text-base font-black ${grupo.tone}`}>
                        {grupo.label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {grupos.flatMap((grupo) =>
                      colunasFluxo.map((col) => (
                        <th key={`${grupo.key}-${col.key}`} className={`border border-slate-900 px-1.5 py-1.5 text-xs font-black text-slate-950 ${col.bg}`}>
                          {col.label}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {isLoading || unidadesLoading ? (
                    <tr>
                      <td colSpan={29} className="border border-slate-300 px-3 py-10 text-center text-muted-foreground">
                        Carregando conferência...
                      </td>
                    </tr>
                  ) : linhas.length === 0 ? (
                    <tr>
                      <td colSpan={29} className="border border-slate-300 px-3 py-10 text-center text-muted-foreground">
                        Nenhuma loja encontrada para o filtro selecionado.
                      </td>
                    </tr>
                  ) : (
                    linhas.map((linha) => (
                      <tr key={linha.unidade.id} className="hover:bg-blue-50/40">
                        <th scope="row" className="sticky left-0 z-10 min-w-[180px] max-w-[180px] break-words border border-slate-900 bg-slate-100 px-2 py-1.5 text-left font-black text-slate-950">
                          <span className="block text-[10px] font-semibold uppercase text-slate-600">
                            {linha.unidade.tipo === "matriz" ? "Matriz" : "Filial"}
                          </span>
                          {linha.unidade.nome}
                        </th>
                        {grupos.flatMap((grupo) => {
                          const f = fluxo(linha.unidade.id, grupo.key);
                          const id = `${linha.unidade.id}-${grupo.key}`;
                          const inputCls = "h-10 w-16 rounded-none border-0 text-center text-base font-black shadow-none focus-visible:ring-2 focus-visible:ring-blue-500";
                          return [
                            <td key={`${id}-ini`} className="border border-slate-900 bg-slate-50 px-1 text-center font-bold">{f.saldoInicial}</td>,
                            <td key={`${id}-ent`} className="border border-slate-900 p-0" title={entradaRecebida(linha.unidade.id, grupo.key) ? `+${entradaRecebida(linha.unidade.id, grupo.key)} recebido de lojas` : undefined}>
                              <Input type="number" min="0" inputMode="numeric" value={entradas[linha.unidade.id]?.[grupo.key] || ""}
                                onChange={(e) => atualizarEntrada(linha.unidade.id, grupo.key, e.target.value)} className={`${inputCls} text-emerald-700`} />
                              {entradaRecebida(linha.unidade.id, grupo.key) > 0 && (
                                <span className="block text-center text-[10px] font-bold text-emerald-700">+{entradaRecebida(linha.unidade.id, grupo.key)} transf.</span>
                              )}
                            </td>,
                            <td key={`${id}-tra`} className="border border-slate-900 p-0">
                              <button type="button" onClick={() => abrirTransferencia(linha.unidade.id, grupo.key)}
                                className="h-10 w-full px-1 text-center font-black text-purple-700 underline-offset-2 hover:underline">
                                -{f.transferencia}
                              </button>
                            </td>,
                            <td key={`${id}-che`} className="border border-slate-900 p-0">
                              <Input type="number" min="0" inputMode="numeric" value={linha.totais[grupo.key].cheio || ""}
                                onChange={(e) => atualizarValor(linha.unidade.id, grupo.key, "cheio", e.target.value)} className={`${inputCls} text-blue-700`} />
                            </td>,
                            <td key={`${id}-vaz`} className="border border-slate-900 p-0">
                              <Input type="number" min="0" inputMode="numeric" value={linha.totais[grupo.key].vazio || ""}
                                onChange={(e) => atualizarValor(linha.unidade.id, grupo.key, "vazio", e.target.value)} className={`${inputCls} text-blue-700`} />
                            </td>,
                            <td key={`${id}-tot`} className="border border-slate-900 bg-slate-100 px-1 text-center font-black">
                              {linha.totais[grupo.key].cheio + linha.totais[grupo.key].vazio}
                            </td>,
                            <td key={`${id}-ven`} className="border border-slate-900 bg-emerald-50 px-1 text-center font-black text-emerald-700">{f.vendaEsperada}</td>,
                          ];
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
                {linhas.length > 0 && !isLoading && !unidadesLoading && (
                  <tfoot>
                    <tr>
                      <th scope="row" className="sticky left-0 z-10 border border-slate-900 bg-slate-800 px-2 py-1.5 text-left font-black text-white">
                        Total geral
                      </th>
                      {grupos.flatMap((grupo) => {
                        const g = resumo.porGrupo[grupo.key];
                        return [g.inicial, g.entrada, -g.transf, g.cheio, g.vazio, g.cheio + g.vazio, g.venda].map((v, i) => (
                          <td key={`tot-${grupo.key}-${i}`} className={`border border-slate-900 text-center font-black ${colunasFluxo[i].bg}`}>{v}</td>
                        ));
                      })}
                    </tr>
                  </tfoot>
                )}
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
                  <div className="border-b border-border bg-foreground px-4 py-3 text-background">
                    <p className="break-words text-base font-black">{linha.unidade.nome}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 p-3">
                    {grupos.map((grupo) => {
                      const f = fluxo(linha.unidade.id, grupo.key);
                      const recebida = entradaRecebida(linha.unidade.id, grupo.key);
                      return (
                        <div key={grupo.key} className={`rounded-xl border p-3 ${grupo.mobileTone}`}>
                          <p className="mb-2 text-base font-black text-slate-950">{grupo.label}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-slate-200 bg-white p-2">
                              <p className="text-[11px] font-bold uppercase text-slate-500">1. Saldo inicial</p>
                              <p className="text-right text-2xl font-black text-slate-950">{f.saldoInicial}</p>
                              <p className="text-[11px] text-slate-500">Contagem de {formatarDataBR(dataAnterior)}</p>
                            </div>
                            <div className="rounded-lg border border-emerald-200 bg-white p-2">
                              <p className="text-[11px] font-bold uppercase text-emerald-700">2. Entrada (+)</p>
                              <Input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={entradas[linha.unidade.id]?.[grupo.key] || ""}
                                onChange={(event) => atualizarEntrada(linha.unidade.id, grupo.key, event.target.value)}
                                className="h-9 text-right text-lg font-black text-emerald-700"
                              />
                              {recebida > 0 && <p className="text-[11px] text-emerald-700">+{recebida} recebido de lojas</p>}
                            </div>
                            <div className="rounded-lg border border-blue-200 bg-white p-2">
                              <p className="text-[11px] font-bold uppercase text-blue-700">3. Total inicial (=)</p>
                              <p className="text-right text-2xl font-black text-blue-900">{f.totalInicial}</p>
                              <p className="text-[11px] text-blue-700">Inicial + entrada</p>
                            </div>
                            <div className="rounded-lg border border-amber-200 bg-white p-2">
                              <p className="text-[11px] font-bold uppercase text-amber-700">4. Cheios (-)</p>
                              <Input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={linha.totais[grupo.key].cheio || ""}
                                onChange={(event) => atualizarValor(linha.unidade.id, grupo.key, "cheio", event.target.value)}
                                className="h-9 text-right text-lg font-black text-amber-800"
                              />
                              <p className="text-[11px] text-amber-700">Contagem atual</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => abrirTransferencia(linha.unidade.id, grupo.key)}
                              className="rounded-lg border border-purple-200 bg-white p-2 text-left"
                            >
                              <p className="flex justify-between text-[11px] font-bold uppercase text-purple-700">
                                5. Transf. (-) <span className="underline">Editar</span>
                              </p>
                              <p className="text-right text-2xl font-black text-purple-700">-{f.transferencia}</p>
                              <p className="text-[11px] text-purple-600">Para outras lojas</p>
                            </button>
                            <div className="rounded-lg border border-slate-200 bg-white p-2">
                              <p className="text-[11px] font-bold uppercase text-slate-500">Vazio</p>
                              <Input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={linha.totais[grupo.key].vazio || ""}
                                onChange={(event) => atualizarValor(linha.unidade.id, grupo.key, "vazio", event.target.value)}
                                className="h-9 text-right text-lg font-black text-slate-800"
                              />
                              <p className="text-[11px] text-slate-500">Vasilhames: {linha.totais[grupo.key].cheio + linha.totais[grupo.key].vazio}</p>
                            </div>
                          </div>
                          <div className="mt-2 rounded-xl bg-emerald-600 p-3 text-white">
                            <p className="text-xs font-bold uppercase">6. Venda esperada</p>
                            <p className="text-right text-3xl font-black">{f.vendaEsperada}</p>
                            <p className="text-[11px] opacity-90">Inicial + entrada − transf. − cheios</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={!!dialogTransf} onOpenChange={(open) => !open && setDialogTransf(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Transferência {dialogTransf?.grupo} — {unidades.find((u) => u.id === dialogTransf?.unidadeId)?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Loja de destino</Label>
              <Select value={transfDestino} onValueChange={setTransfDestino}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Escolha a loja" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Escolha a loja</SelectItem>
                  {todasLojas
                    .filter((u) => u.id !== dialogTransf?.unidadeId)
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input type="number" min="1" inputMode="numeric" value={transfQtd} onChange={(e) => setTransfQtd(e.target.value)} className="h-10 text-base" />
            </div>
            {transferenciasDoDialog.length > 0 && (
              <div className="space-y-1 rounded-lg border p-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Já registradas hoje</p>
                {transferenciasDoDialog.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span>{t.quantidade} → {nomeLoja(t.unidade_destino_id)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => excluirTransferencia(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogTransf(null)}>Fechar</Button>
            <Button onClick={registrarTransferencia} disabled={isSaving}>Registrar transferência</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

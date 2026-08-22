import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileDown,
  HelpCircle,
  Info,
  Percent,
  Printer,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { AppPage, KpiCard, KpiRow, SectionCard, EmptyState, KpiSkeletonRow, UiKitSkeleton } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { exportDREtoPdf, handlePrint } from "@/services/reportPdfService";
import { ChartTooltip } from "@/components/dashboard/premium/ChartTooltip";
import { chartAxisTick, chartGridProps, CHART_SEMANTIC, fmtBRLcompact } from "@/components/dashboard/premium/chartTheme";
import { getBrasiliaDate } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";
import { calcularDRE, DRE_LINHAS, type DreGrupo, type DreLancamento, type DreMes } from "@/lib/financeiro/dreCalculo";
import {
  agregarProdutos,
  agruparPorOrigem,
  construirPonte,
  consolidarDre,
  lancamentosParaCsv,
  margemLiquida,
  percentualReceita,
  variacaoPercentual,
  type DreTotais,
} from "@/lib/financeiro/dreView";


interface DRELine {
  categoria: string;
  valores: number[];
  tipo: string;
  indent?: boolean;
  grupo?: DreGrupo;
  ajuda?: string;
}

type PeriodoOpcao = "mes_atual" | "mes_anterior" | "3" | "6" | "12";

const PERIODOS: { value: PeriodoOpcao; label: string; meses: number; offset: number }[] = [
  { value: "mes_atual", label: "Mês atual", meses: 1, offset: 0 },
  { value: "mes_anterior", label: "Mês anterior", meses: 1, offset: 1 },
  { value: "3", label: "Últimos 3 meses", meses: 3, offset: 0 },
  { value: "6", label: "Últimos 6 meses", meses: 6, offset: 0 },
  { value: "12", label: "Últimos 12 meses", meses: 12, offset: 0 },
];

const formatCurrency = (value: number) => {
  const safe = Number.isFinite(value) ? value : 0;
  const f = Math.abs(safe).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return safe < 0 ? `(${f})` : f;
};

const formatPercent = (value: number | null) =>
  value === null ? "—" : `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export default function DRE({ embedded = false }: { embedded?: boolean }) {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<DreMes[]>([]);
  const [dadosAnterior, setDadosAnterior] = useState<DreMes[] | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoOpcao>("mes_atual");
  const [modo, setModo] = useState<"consolidado" | "mensal">("consolidado");
  const [buscaProduto, setBuscaProduto] = useState("");
  const [verTodosProdutos, setVerTodosProdutos] = useState(false);
  const [detalhe, setDetalhe] = useState<
    { chave: string; titulo: string; descricao?: string; lancamentos: DreLancamento[] } | null
  >(null);
  const [buscaDetalhe, setBuscaDetalhe] = useState("");
  const detalheRef = useRef<HTMLDivElement | null>(null);


  const cfg = PERIODOS.find((p) => p.value === periodo) ?? PERIODOS[0];

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    const hoje = getBrasiliaDate();
    const base = new Date(hoje.getFullYear(), hoje.getMonth() - cfg.offset, 1);
    const baseAnterior = new Date(base.getFullYear(), base.getMonth() - cfg.meses, 1);
    try {
      const atual = await calcularDRE(base, cfg.meses, unidadeAtual?.id);
      setDados(atual);
      try {
        const anterior = await calcularDRE(baseAnterior, cfg.meses, unidadeAtual?.id);
        setDadosAnterior(anterior);
      } catch {
        setDadosAnterior(null);
      }
      setAtualizadoEm(new Date());
    } catch (e) {
      setDados([]);
      setDadosAnterior(null);
      setErro(e instanceof Error ? e.message : "Não foi possível carregar a DRE.");
    } finally {
      setLoading(false);
    }
  }, [cfg.meses, cfg.offset, unidadeAtual?.id]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      await carregar();
      if (!ativo) return;
    })();
    return () => {
      ativo = false;
    };
  }, [carregar]);

  useEffect(() => {
    if (cfg.meses === 1) setModo("consolidado");
  }, [cfg.meses]);

  const meses = useMemo(() => dados.map((d) => d.label), [dados]);
  const totais = useMemo<DreTotais>(() => consolidarDre(dados), [dados]);
  const totaisAnterior = useMemo<DreTotais | null>(
    () => (dadosAnterior && dadosAnterior.length > 0 ? consolidarDre(dadosAnterior) : null),
    [dadosAnterior],
  );

  const periodoLabel = meses.length > 0 ? (meses.length === 1 ? meses[0] : `${meses[0]} — ${meses[meses.length - 1]}`) : "Sem período";
  const periodoAnteriorLabel = dadosAnterior && dadosAnterior.length > 0
    ? dadosAnterior.length === 1
      ? dadosAnterior[0].label
      : `${dadosAnterior[0].label} — ${dadosAnterior[dadosAnterior.length - 1].label}`
    : null;

  const dre: DRELine[] = useMemo(
    () =>
      DRE_LINHAS.map((l) => ({
        categoria: l.categoria,
        tipo: l.tipo,
        indent: l.indent,
        grupo: l.grupo,
        ajuda: l.ajuda,
        valores: dados.map((m) => {
          const v = Number(m[l.campo] as number) || 0;
          return l.negativo ? -v : v;
        }),
      })),
    [dados],
  );

  const produtos = useMemo(() => agregarProdutos(dados), [dados]);
  const produtosFiltrados = useMemo(() => {
    const termo = buscaProduto.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter((p) => p.nome.toLowerCase().includes(termo));
  }, [produtos, buscaProduto]);
  const produtosVisiveis = verTodosProdutos ? produtosFiltrados : produtosFiltrados.slice(0, 10);

  const avisos = useMemo(() => Array.from(new Set(dados.flatMap((m) => m.avisos))), [dados]);
  const ponte = useMemo(() => construirPonte(totais), [totais]);
  const ponteMax = useMemo(() => Math.max(...ponte.map((p) => Math.abs(p.valor)), 1), [ponte]);

  const chartData = useMemo(
    () =>
      dados.map((m) => ({
        mes: m.label,
        receita: m.receitaLiquida,
        resultado: m.resultadoLiquido,
        margem: m.receitaLiquida !== 0 ? (m.resultadoLiquido / m.receitaLiquida) * 100 : null,
      })),
    [dados],
  );

  const semDados = !loading && !erro && totais.qtdPedidos === 0 && totais.receitaBruta === 0 && ponte.every((p) => p.valor === 0);

  const abrirDetalhe = (linha: DRELine) => {
    if (!linha.grupo) return;
    setBuscaDetalhe("");
    setDetalhe({
      chave: linha.categoria,
      titulo: linha.categoria.replace("(-) ", ""),
      descricao: `${periodoLabel} · ${linha.ajuda || "Lançamentos que compõem esta linha."}`,
      lancamentos: dados.flatMap((m) => m.detalhes[linha.grupo!] || []),
    });
    requestAnimationFrame(() => {
      const el = detalheRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.focus({ preventScroll: true });
    });
  };

  // Trocar período/unidade invalida o detalhe carregado.
  useEffect(() => {
    setDetalhe(null);
    setBuscaDetalhe("");
  }, [periodo, unidadeAtual?.id]);

  const normalizarTexto = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const detalheFiltrado = useMemo(() => {
    if (!detalhe) return [];
    const termo = normalizarTexto(buscaDetalhe.trim());
    if (!termo) return detalhe.lancamentos;
    return detalhe.lancamentos.filter(
      (l) => normalizarTexto(l.descricao || "").includes(termo) || normalizarTexto(l.origem || "").includes(termo),
    );
  }, [detalhe, buscaDetalhe]);

  const detalheTotal = useMemo(
    () => detalheFiltrado.reduce((s, l) => s + Number(l.valor || 0), 0),
    [detalheFiltrado],
  );
  const detalheOrigens = useMemo(() => agruparPorOrigem(detalheFiltrado), [detalheFiltrado]);

  const exportarDetalheCsv = () => {
    if (!detalhe) return;
    const csv = lancamentosParaCsv(detalheFiltrado);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dre-${normalizarTexto(detalhe.titulo).replace(/[^a-z0-9]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  const kpiTrend = (campo: keyof DreTotais, invertido = false) => {
    if (!totaisAnterior) return undefined;
    const v = variacaoPercentual(totais[campo], totaisAnterior[campo]);
    if (v === null) return undefined;
    return { value: v, label: "vs período anterior", isPositive: invertido ? v <= 0 : v >= 0 };
  };

  const margem = margemLiquida(totais);
  const margemAnterior = totaisAnterior ? margemLiquida(totaisAnterior) : null;

  const mostrarMensal = modo === "mensal" && dados.length > 1;

  /* ------------------------------- Blocos ------------------------------- */

  const comoCalcula = (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" aria-label="Como esta DRE é calculada">
          <HelpCircle className="mr-1.5 h-4 w-4" /> Como é calculada
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] text-[12px] leading-snug">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Competência gerencial por mês</p>
        <ul className="space-y-1.5 text-muted-foreground">
          <li>• Receita: pedidos entregues/finalizados/pagos, pela data de entrega (ou criação). Cancelados nunca entram.</li>
          <li>• CMV: quantidade vendida x custo médio ponderado das compras; sem compras, usa o preço de custo cadastrado.</li>
          <li>• Compra de mercadoria não é despesa: vira estoque e sai como CMV quando vendida.</li>
          <li>• Impostos: apenas lançamentos realmente categorizados, sem percentual estimado.</li>
          <li>• Transferências internas e liquidações de títulos já reconhecidos não duplicam despesas.</li>
          <li>• Fontes: pedidos, pedido_itens, compras, movimentações de caixa e banco, contas a pagar e despesas contábeis.</li>
        </ul>
      </PopoverContent>
    </Popover>
  );

  const acoes = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" className="h-9" onClick={carregar} disabled={loading} aria-label="Atualizar DRE">
        <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-9"
        onClick={() => exportDREtoPdf(dre, meses, periodoLabel)}
        disabled={dados.length === 0}
      >
        <FileDown className="mr-1.5 h-4 w-4" /> Exportar PDF
      </Button>
      <Button variant="outline" size="sm" className="h-9" onClick={handlePrint}>
        <Printer className="mr-1.5 h-4 w-4" /> Imprimir
      </Button>
    </div>
  );

  const filtros = (
    <div className="flex w-full flex-wrap items-center gap-2">
      <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoOpcao)}>
        <SelectTrigger className="h-9 w-full sm:w-52" aria-label="Período da DRE">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIODOS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Badge variant="outline" className="text-xs font-medium">{periodoLabel}</Badge>
      {unidadeAtual?.nome && <Badge variant="secondary" className="text-xs">{unidadeAtual.nome}</Badge>}
      {periodoAnteriorLabel && (
        <span className="text-[11px] text-muted-foreground">Comparando com {periodoAnteriorLabel}</span>
      )}
      {atualizadoEm && (
        <span className="text-[11px] text-muted-foreground">
          Atualizado {atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
      {comoCalcula}
    </div>
  );

  const kpis = (
    <KpiRow columns={5}>
      <KpiCard
        label="Receita Líquida"
        value={formatCurrency(totais.receitaLiquida)}
        icon={TrendingUp}
        tone="info"
        hint={`${totais.qtdPedidos} pedidos${totais.qtdCancelados > 0 ? ` · ${totais.qtdCancelados} cancelados fora` : ""}`}
        trend={kpiTrend("receitaLiquida")}
      />
      <KpiCard label="Lucro Bruto" value={formatCurrency(totais.lucroBruto)} icon={Wallet} tone={totais.lucroBruto >= 0 ? "success" : "destructive"} hint={`${formatPercent(percentualReceita(totais.lucroBruto, totais.receitaLiquida))} da receita líquida`} trend={kpiTrend("lucroBruto")} />
      <KpiCard label="Resultado Operacional" value={formatCurrency(totais.resultadoOperacional)} icon={Wallet} tone={totais.resultadoOperacional >= 0 ? "success" : "destructive"} hint={`${formatPercent(percentualReceita(totais.resultadoOperacional, totais.receitaLiquida))} da receita líquida`} trend={kpiTrend("resultadoOperacional")} />
      <KpiCard label="Resultado Líquido" value={formatCurrency(totais.resultadoLiquido)} icon={Wallet} tone={totais.resultadoLiquido >= 0 ? "success" : "destructive"} trend={kpiTrend("resultadoLiquido")} />
      <KpiCard
        label="Margem Líquida"
        value={formatPercent(margem)}
        icon={Percent}
        tone={margem === null ? "neutral" : margem >= 0 ? "info" : "destructive"}
        hint={margemAnterior !== null ? `Anterior: ${formatPercent(margemAnterior)}` : "Sem base anterior"}
      />
    </KpiRow>
  );

  const qualidade = (
    <SectionCard title="Qualidade dos dados" icon={avisos.length > 0 ? AlertTriangle : CheckCircle2}>
      {avisos.length === 0 ? (
        <p className="flex items-center gap-2 text-[13px] text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          Dados consistentes — nenhum aviso gerado no período.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {avisos.map((a, i) => (
            <li key={i} className="flex gap-2 text-[13px] leading-snug text-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
              <span>{a}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );

  const pontePonto = (
    <SectionCard
      title="Ponte do resultado"
      description="Da receita bruta ao resultado líquido, no período selecionado."
    >
      <ul className="space-y-2">
        {ponte.map((p) => {
          const largura = Math.max((Math.abs(p.valor) / ponteMax) * 100, p.valor === 0 ? 0 : 2);
          const negativo = p.valor < 0;
          const forte = p.tipo === "subtotal" || p.tipo === "resultado";
          return (
            <li key={p.label} className="grid grid-cols-[minmax(96px,150px)_1fr_auto] items-center gap-2 sm:gap-3">
              <span className={`min-w-0 truncate text-[12px] ${forte ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {p.tipo === "reducao" ? `(-) ${p.label}` : p.label}
              </span>
              <span className="h-3 w-full min-w-0 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span
                  className={`block h-full rounded-full ${
                    negativo
                      ? "bg-destructive/70 [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,hsl(var(--card)/0.35)_4px,hsl(var(--card)/0.35)_8px)]"
                      : p.tipo === "resultado"
                        ? "bg-primary"
                        : "bg-success/70"
                  }`}
                  style={{ width: `${largura}%` }}
                />
              </span>
              <span className={`whitespace-nowrap text-right text-[12px] tabular-nums ${forte ? "font-bold" : ""} ${negativo ? "text-destructive" : ""}`}>
                {formatCurrency(p.valor)}
              </span>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );

  const tabelaDre = (
    <SectionCard
      title="DRE Gerencial"
      description="Competência gerencial por mês. Clique numa linha auditável para ver os lançamentos de origem."
      flush
      actions={
        <Tabs value={mostrarMensal ? "mensal" : "consolidado"} onValueChange={(v) => setModo(v as "consolidado" | "mensal")}>
          <TabsList className="h-9">
            <TabsTrigger value="consolidado" className="text-xs">Consolidado</TabsTrigger>
            <TabsTrigger value="mensal" className="text-xs" disabled={dados.length <= 1}>Mensal</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <div className="w-full overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[13px]" style={{ minWidth: mostrarMensal ? 640 + meses.length * 110 : 0 }}>
          <thead className="sticky top-0 z-20">
            <tr className="bg-muted/70">
              <th scope="col" className="sticky left-0 z-30 min-w-[220px] bg-muted px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground shadow-[1px_0_0_hsl(var(--border))]">
                Descrição
              </th>
              {mostrarMensal &&
                meses.map((m) => (
                  <th key={m} scope="col" className="min-w-[110px] whitespace-nowrap bg-muted px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {m}
                  </th>
                ))}
              <th scope="col" className="min-w-[130px] whitespace-nowrap bg-muted px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-foreground">
                {mostrarMensal ? "Total do período" : "Valor"}
              </th>
              <th scope="col" className="min-w-[74px] whitespace-nowrap bg-muted px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                % RL
              </th>
            </tr>
          </thead>
          <tbody>
            {dre.map((item, index) => {
              const total = item.valores.reduce((s, v) => s + v, 0);
              const av = percentualReceita(total, totais.receitaLiquida);
              const isSubtotal = item.tipo === "subtotal";
              const isResultado = item.tipo === "resultado";
              const rowBg = isResultado ? "bg-primary/10" : isSubtotal ? "bg-muted/40" : "bg-card";
              const clicavel = !!item.grupo;

              return (
                <tr
                  key={index}
                  onClick={() => clicavel && abrirDetalhe(item)}
                  onKeyDown={(e) => {
                    if (clicavel && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      abrirDetalhe(item);
                    }
                  }}
                  tabIndex={clicavel ? 0 : undefined}
                  role={clicavel ? "button" : undefined}
                  aria-label={clicavel ? `Ver lançamentos de ${item.categoria}` : undefined}
                  className={`${rowBg} transition-colors ${clicavel ? "cursor-pointer hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary" : ""}`}
                >
                  <th
                    scope="row"
                    className={`sticky left-0 z-10 border-b border-border/50 px-3 py-2.5 text-left font-normal shadow-[1px_0_0_hsl(var(--border))] ${rowBg}`}
                  >
                    <span
                      className={`flex items-center gap-1.5 leading-snug ${item.indent && !isSubtotal ? "pl-3 text-muted-foreground" : ""} ${
                        isSubtotal || isResultado ? "text-[12px] font-bold uppercase tracking-wide" : "font-medium"
                      } ${isResultado ? "text-primary" : ""}`}
                    >
                      {item.categoria}
                      {clicavel && <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />}
                    </span>
                  </th>
                  {mostrarMensal &&
                    item.valores.map((v, i) => (
                      <td
                        key={i}
                        className={`border-b border-border/50 px-3 py-2.5 text-right tabular-nums ${isSubtotal || isResultado ? "font-bold" : ""} ${v < 0 ? "text-destructive" : ""}`}
                      >
                        {formatCurrency(v)}
                      </td>
                    ))}
                  <td
                    className={`border-b border-border/50 bg-muted/15 px-3 py-2.5 text-right font-semibold tabular-nums ${
                      isSubtotal || isResultado ? "font-bold" : ""
                    } ${total < 0 ? "text-destructive" : ""} ${isResultado && total >= 0 ? "text-success" : ""}`}
                  >
                    {formatCurrency(total)}
                  </td>
                  <td className={`border-b border-border/50 px-3 py-2.5 text-right text-xs tabular-nums ${isSubtotal || isResultado ? "font-bold" : "text-muted-foreground"}`}>
                    {formatPercent(av === null ? null : Math.abs(av))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );

  const margemProduto = (
    <SectionCard
      title="Margem por produto"
      description="Receita, CMV e lucro bruto do que foi efetivamente vendido no período."
      flush
      actions={
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={buscaProduto}
            onChange={(e) => setBuscaProduto(e.target.value)}
            placeholder="Buscar produto"
            aria-label="Buscar produto"
            className="h-9 pl-8 text-base sm:text-sm"
          />
        </div>
      }
    >
      {produtosFiltrados.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          {produtos.length === 0 ? "Nenhuma venda registrada no período." : "Nenhum produto corresponde à busca."}
        </p>
      ) : (
        <>
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[680px] text-[13px]">
              <thead className="bg-muted/60">
                <tr>
                  <th scope="col" className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Produto</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Qtd</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Receita</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">CMV</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Custo usado</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Lucro bruto</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Margem</th>
                </tr>
              </thead>
              <tbody>
                {produtosVisiveis.map((p) => (
                  <tr key={p.produto_id} className="border-t border-border/50 odd:bg-muted/15">
                    <td className="px-3 py-2.5 font-medium">
                      {p.nome}
                      {p.semCusto && (
                        <Badge variant="outline" className="ml-2 border-warning/40 text-[10px] text-warning">sem custo</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.quantidade.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(p.receita)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-destructive">{formatCurrency(p.custoTotal)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatCurrency(p.custoUnitario)}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${p.lucroBruto >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(p.lucroBruto)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatPercent(p.margem)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {produtosFiltrados.length > 10 && (
            <div className="border-t border-border/60 px-3 py-2.5">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setVerTodosProdutos((v) => !v)}>
                {verTodosProdutos ? "Ver apenas top 10" : `Ver todos (${produtosFiltrados.length})`}
              </Button>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );

  const evolucao = dados.length > 1 && (
    <SectionCard
      title="Evolução mensal"
      description="Receita líquida e resultado líquido no eixo esquerdo (R$); margem líquida no eixo direito (%)."
    >
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="dreGradReceita" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_SEMANTIC.info} stopOpacity={0.28} />
              <stop offset="95%" stopColor={CHART_SEMANTIC.info} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="dreGradResultado" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_SEMANTIC.success} stopOpacity={0.26} />
              <stop offset="95%" stopColor={CHART_SEMANTIC.success} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...chartGridProps} />
          <XAxis dataKey="mes" tick={chartAxisTick} axisLine={false} tickLine={false} />
          <YAxis yAxisId="valor" tickFormatter={fmtBRLcompact} tick={chartAxisTick} axisLine={false} tickLine={false} />
          <YAxis yAxisId="margem" orientation="right" tickFormatter={(v) => `${Number(v).toFixed(0)}%`} tick={chartAxisTick} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            content={<ChartTooltip formatter={(v, name) => (name === "Margem líquida (%)" ? `${Number(v).toFixed(1)}%` : formatCurrency(Number(v)))} />}
            cursor={{ stroke: "hsl(var(--primary))", strokeDasharray: "3 3" }}
          />
          <ReferenceLine yAxisId="valor" y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
          <Area yAxisId="valor" type="monotone" dataKey="receita" name="Receita líquida (R$)" stroke={CHART_SEMANTIC.info} fill="url(#dreGradReceita)" strokeWidth={2.2} />
          <Area yAxisId="valor" type="monotone" dataKey="resultado" name="Resultado líquido (R$)" stroke={CHART_SEMANTIC.success} fill="url(#dreGradResultado)" strokeWidth={2.2} />
          <Line yAxisId="margem" type="monotone" dataKey="margem" name="Margem líquida (%)" stroke={CHART_SEMANTIC.primary} strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: CHART_SEMANTIC.primary }} connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    </SectionCard>
  );

  /* ------------------------------- Render ------------------------------- */

  let corpo: JSX.Element;
  if (loading) {
    corpo = (
      <div className="space-y-4">
        <KpiSkeletonRow count={5} />
        <UiKitSkeleton className="h-[260px] w-full rounded-card" />
        <UiKitSkeleton className="h-[380px] w-full rounded-card" />
      </div>
    );
  } else if (erro) {
    corpo = (
      <SectionCard title="Não foi possível carregar a DRE">
        <p className="text-[13px] text-muted-foreground">{erro}</p>
        <Button variant="outline" size="sm" className="mt-3 h-9" onClick={carregar}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Tentar novamente
        </Button>
      </SectionCard>
    );
  } else if (semDados) {
    corpo = (
      <EmptyState
        icon={Info}
        title="Sem movimentos no período"
        description="Não há vendas nem despesas registradas para a unidade e o período selecionados."
        action={
          <Button variant="outline" size="sm" className="h-9" onClick={carregar}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Atualizar
          </Button>
        }
      />
    );
  } else {
    corpo = (
      <div className="space-y-4">
        {kpis}
        {qualidade}
        {pontePonto}
        {tabelaDre}
        {margemProduto}
        {evolucao}
      </div>
    );
  }

  const content = (
    <div className="w-full min-w-0 max-w-full space-y-4">
      {filtros}
      {embedded && acoes}
      {corpo}
      <DRELinhaDetalheDialog
        open={!!detalhe}
        onOpenChange={(o) => !o && setDetalhe(null)}
        titulo={detalhe?.titulo || ""}
        descricao={detalhe?.descricao}
        lancamentos={detalhe?.lancamentos || []}
      />
    </div>
  );

  if (embedded) return content;

  return (
    <MainLayout>
      <AppPage
        title="DRE Gerencial"
        description="Resultado por competência, com receita, CMV e despesas reais auditáveis até o lançamento de origem."
        actions={acoes}
      >
        {content}
      </AppPage>
    </MainLayout>
  );
}

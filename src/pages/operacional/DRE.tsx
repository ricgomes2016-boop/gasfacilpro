import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageSectionLoader } from "@/components/ui/page-loader";
import { FileDown, Printer, TrendingUp, TrendingDown, Percent, Wallet, FileBarChart, AlertTriangle, Package, Info } from "lucide-react";
import { exportDREtoPdf, handlePrint } from "@/services/reportPdfService";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Area, AreaChart, Line } from "recharts";
import { getBrasiliaDate } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";
import { DashboardHero } from "@/components/dashboard/premium/DashboardHero";
import { PremiumKpiCard } from "@/components/dashboard/premium/PremiumKpiCard";
import { ChartTooltip } from "@/components/dashboard/premium/ChartTooltip";
import { chartGridProps, chartAxisTick, CHART_SEMANTIC, fmtBRLcompact } from "@/components/dashboard/premium/chartTheme";
import { calcularDRE, DRE_LINHAS, type DreMes, type DreGrupo, type DreLancamento } from "@/lib/financeiro/dreCalculo";
import { DRELinhaDetalheDialog } from "@/components/operacional/DRELinhaDetalheDialog";

interface DRELine {
  categoria: string;
  valores: number[];
  tipo: string;
  indent?: boolean;
  grupo?: DreGrupo;
  ajuda?: string;
}

export default function DRE({ embedded = false }: { embedded?: boolean }) {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<DreMes[]>([]);
  const [mesesVisiveis, setMesesVisiveis] = useState<string[]>([]);
  const [periodoMeses, setPeriodoMeses] = useState("3");
  const [detalhe, setDetalhe] = useState<{ titulo: string; descricao?: string; lancamentos: DreLancamento[] } | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoading(true);
      try {
        const res = await calcularDRE(getBrasiliaDate(), Number(periodoMeses), unidadeAtual?.id);
        if (!ativo) return;
        setDados(res);
        setMesesVisiveis(res.map(m => m.label));
      } catch (e) {
        console.error(e);
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => { ativo = false; };
  }, [unidadeAtual, periodoMeses]);

  const meses = useMemo(() => dados.map(d => d.label), [dados]);

  const mesesData = useMemo(() => {
    const selecionados = mesesVisiveis.length > 0 ? mesesVisiveis : meses;
    return dados.filter(d => selecionados.includes(d.label));
  }, [dados, mesesVisiveis, meses]);

  const mesesExibidos = useMemo(() => mesesData.map(m => m.label), [mesesData]);

  const dre: DRELine[] = useMemo(
    () =>
      DRE_LINHAS.map(cfg => ({
        categoria: cfg.categoria,
        tipo: cfg.tipo,
        indent: cfg.indent,
        grupo: cfg.grupo,
        ajuda: cfg.ajuda,
        valores: mesesData.map(m => {
          const v = Number(m[cfg.campo] as number) || 0;
          return cfg.negativo ? -v : v;
        }),
      })),
    [mesesData]
  );

  const periodoLabel = mesesExibidos.length > 0 ? `${mesesExibidos[0]} — ${mesesExibidos[mesesExibidos.length - 1]}` : "Sem meses";

  const formatCurrency = (value: number) => {
    const safeValue = Number.isFinite(value) ? value : 0;
    const formatted = Math.abs(safeValue).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return safeValue < 0 ? `(${formatted})` : formatted;
  };

  const formatPercent = (value: number) => `${(Number.isFinite(value) ? Math.abs(value) : 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

  const toggleMes = (mes: string) => {
    setMesesVisiveis(prev => {
      const current = prev.length > 0 ? prev : meses;
      if (current.includes(mes)) return current.length === 1 ? current : current.filter(m => m !== mes);
      return meses.filter(m => current.includes(m) || m === mes);
    });
  };

  const abrirDetalhe = (linha: DRELine) => {
    if (!linha.grupo) return;
    const lancamentos = mesesData.flatMap(m => m.detalhes[linha.grupo!] || []);
    setDetalhe({
      titulo: linha.categoria.replace("(-) ", ""),
      descricao: `${periodoLabel} · ${linha.ajuda || "Lançamentos que compõem esta linha."}`,
      lancamentos,
    });
  };

  if (loading) {
    const loader = <PageSectionLoader label="Carregando DRE..." />;
    if (embedded) return loader;
    return (
      <MainLayout>
        <div className="p-3 sm:p-4 md:p-6">
          <DashboardHero eyebrow="Financeiro" icon={FileBarChart} title="DRE" description="Demonstrativo de Resultados do Exercício" />
        </div>
        {loader}
      </MainLayout>
    );
  }

  const totalReceita = mesesData.reduce((s, m) => s + m.receitaBruta, 0);
  const totalCMV = mesesData.reduce((s, m) => s + m.cmv, 0);
  const totalLucro = mesesData.reduce((s, m) => s + m.resultadoLiquido, 0);
  const totalDesp = mesesData.reduce((s, m) => s + m.impostos + m.cmv + m.despPessoal + m.despOperacional + m.despAdministrativa + m.despFinanceira, 0);
  const margemLiquida = totalReceita > 0 ? (totalLucro / totalReceita) * 100 : 0;
  const receitaArr = mesesData.map(m => m.receitaBruta);
  const lucroArr = mesesData.map(m => m.resultadoLiquido);
  const totalCancelados = mesesData.reduce((s, m) => s + m.qtdCancelados, 0);
  const totalPedidos = mesesData.reduce((s, m) => s + m.qtdPedidos, 0);

  // Produtos vendidos consolidados no período
  const produtosPeriodo = (() => {
    const map = new Map<string, { nome: string; quantidade: number; custoUnitario: number; custoTotal: number; receita: number; semCusto: boolean }>();
    mesesData.forEach(m =>
      m.produtos.forEach(p => {
        const atual = map.get(p.produto_id) || { nome: p.nome, quantidade: 0, custoUnitario: p.custoUnitario, custoTotal: 0, receita: 0, semCusto: p.semCusto };
        atual.quantidade += p.quantidade;
        atual.custoTotal += p.custoTotal;
        atual.receita += p.receita;
        map.set(p.produto_id, atual);
      })
    );
    return Array.from(map.values()).sort((a, b) => b.quantidade - a.quantidade);
  })();

  const avisos = Array.from(new Set(mesesData.flatMap(m => m.avisos)));

  const chartData = mesesData.map(m => ({
    mes: m.label,
    receita: m.receitaBruta,
    lucro: m.resultadoLiquido,
    margem: m.receitaBruta > 0 ? (m.resultadoLiquido / m.receitaBruta) * 100 : 0,
  }));

  const variacao = lucroArr.length >= 2 && lucroArr[lucroArr.length - 2] !== 0
    ? ((lucroArr[lucroArr.length - 1] - lucroArr[lucroArr.length - 2]) / Math.abs(lucroArr[lucroArr.length - 2])) * 100
    : 0;

  const content = (
    <div className="space-y-5 w-full min-w-0 max-w-full overflow-hidden">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between w-full min-w-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto min-w-0">
          <Select value={periodoMeses} onValueChange={setPeriodoMeses}>
            <SelectTrigger className="h-10 sm:h-9 min-w-0 flex-1 sm:flex-none sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-xs font-medium max-w-full truncate">{periodoLabel}</Badge>
        </div>
        <div className="w-full min-w-0 sm:max-w-[520px]">
          <div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 px-2.5 text-xs" onClick={() => setMesesVisiveis(meses)}>Todos</Button>
            <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 px-2.5 text-xs" onClick={() => setMesesVisiveis(meses.slice(-3))}>Últimos 3</Button>
            {meses.map(mes => (
              <Button
                key={mes}
                type="button"
                variant={mesesExibidos.includes(mes) ? "default" : "outline"}
                size="sm"
                className="h-8 shrink-0 px-2.5 text-xs"
                onClick={() => toggleMes(mes)}
              >
                {mes}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto">
          <Button variant="outline" size="sm" className="h-10 sm:h-9 min-w-0" onClick={() => exportDREtoPdf(dre, mesesExibidos, periodoLabel)}>
            <FileDown className="h-4 w-4 mr-1.5" /> Exportar PDF
          </Button>
          <Button variant="outline" size="sm" className="h-10 sm:h-9 min-w-0" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 w-full min-w-0">
        <PremiumKpiCard label="Receita Bruta" value={formatCurrency(totalReceita)} icon={TrendingUp} tone="success" sparkline={receitaArr} />
        <PremiumKpiCard label="Custos + Despesas" value={formatCurrency(totalDesp)} icon={TrendingDown} tone="destructive" />
        <PremiumKpiCard
          label="Resultado Líquido"
          value={formatCurrency(totalLucro)}
          icon={Wallet}
          tone={totalLucro >= 0 ? "success" : "destructive"}
          sparkline={lucroArr}
          trend={variacao !== 0 ? { value: variacao, label: "vs mês anterior" } : undefined}
        />
        <PremiumKpiCard label="Margem Líquida" value={`${margemLiquida.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`} icon={Percent} tone={margemLiquida >= 0 ? "info" : "destructive"} />
      </div>

      {/* Resumo do que foi vendido → custo → lucro */}
      <Card className="min-w-0 overflow-hidden border-border/60 bg-card/95 shadow-[var(--elev-2)]">
        <CardHeader className="border-b border-border/60 bg-muted/25 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4 text-primary" /> O que foi vendido no período</CardTitle>
            <span className="text-xs text-muted-foreground">
              {totalPedidos} pedidos considerados{totalCancelados > 0 ? ` · ${totalCancelados} cancelados fora do cálculo` : ""}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {produtosPeriodo.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma venda no período selecionado.</p>
          ) : (
            <div className="max-h-[320px] overflow-auto">
              <table className="w-full min-w-[600px] text-[13px]">
                <thead className="sticky top-0 bg-muted/70">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Produto</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Qtd vendida</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Custo unit.</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Custo total</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Receita</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Margem bruta</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosPeriodo.map((p, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="px-4 py-2.5 font-medium">
                        {p.nome}
                        {p.semCusto && <Badge variant="outline" className="ml-2 border-warning/40 text-[10px] text-warning">sem custo</Badge>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{p.quantidade.toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatCurrency(p.custoUnitario)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-destructive">{formatCurrency(p.custoTotal)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(p.receita)}</td>
                      <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${p.receita - p.custoTotal >= 0 ? "text-success" : "text-destructive"}`}>
                        {formatCurrency(p.receita - p.custoTotal)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-border bg-muted/40">
                    <td className="px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide">Total</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">{produtosPeriodo.reduce((s, p) => s + p.quantidade, 0).toLocaleString("pt-BR")}</td>
                    <td />
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums text-destructive">{formatCurrency(totalCMV)}</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">{formatCurrency(totalReceita)}</td>
                    <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${totalReceita - totalCMV >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(totalReceita - totalCMV)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Avisos */}
      {avisos.length > 0 && (
        <div className="rounded-[var(--radius)] border border-warning/40 bg-warning/10 p-3">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-warning">
            <AlertTriangle className="h-4 w-4" /> Pontos de atenção
          </p>
          <ul className="mt-2 space-y-1">
            {avisos.map((a, i) => (
              <li key={i} className="text-[13px] leading-snug text-foreground">• {a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Gráfico de Evolução */}
      <Card className="min-w-0 overflow-hidden border-border/60 bg-card/95 shadow-[var(--elev-2)]">
        <CardContent className="pt-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold">Evolução Mensal</h3>
            <span className="text-xs text-muted-foreground">{periodoLabel}</span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="dreGradReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_SEMANTIC.success} stopOpacity={0.32} />
                  <stop offset="95%" stopColor={CHART_SEMANTIC.success} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="dreGradLucro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_SEMANTIC.info} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_SEMANTIC.info} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="mes" tick={chartAxisTick} axisLine={false} tickLine={false} />
              <YAxis yAxisId="valor" tickFormatter={fmtBRLcompact} tick={chartAxisTick} axisLine={false} tickLine={false} />
              <YAxis yAxisId="margem" orientation="right" tickFormatter={(v) => `${Number(v).toFixed(0)}%`} tick={chartAxisTick} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<ChartTooltip formatter={(v, name) => name === "Margem %" ? `${Number(v).toFixed(1)}%` : formatCurrency(v)} />} cursor={{ stroke: "hsl(var(--primary))", strokeDasharray: "3 3" }} />
              <ReferenceLine yAxisId="valor" y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Area yAxisId="valor" type="monotone" dataKey="receita" name="Receita" stroke={CHART_SEMANTIC.success} fill="url(#dreGradReceita)" strokeWidth={2.5} />
              <Area yAxisId="valor" type="monotone" dataKey="lucro" name="Resultado" stroke={CHART_SEMANTIC.info} fill="url(#dreGradLucro)" strokeWidth={2.5} />
              <Line yAxisId="margem" type="monotone" dataKey="margem" name="Margem %" stroke={CHART_SEMANTIC.primary} strokeWidth={2.2} dot={{ r: 2.5, strokeWidth: 0, fill: CHART_SEMANTIC.primary }} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela DRE Principal */}
      <Card className="min-w-0 max-w-full overflow-hidden border-border/60 bg-card/95 shadow-[var(--elev-2)]">
        <CardHeader className="border-b border-border/60 bg-muted/25 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Demonstrativo de Resultados</CardTitle>
            <Badge variant="secondary" className="text-xs">{mesesExibidos.length} meses · clique na linha para detalhar</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 min-w-0 max-w-full overflow-hidden">
          <div className="hidden md:block w-full min-w-0 max-w-full max-h-[620px] overflow-auto overscroll-x-contain">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[13px]">
              <thead className="sticky top-0 z-30">
                <tr className="bg-muted/80">
                  <th className="sticky left-0 z-40 w-[300px] min-w-[300px] bg-muted px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground shadow-[1px_0_0_hsl(var(--border))]">
                    Descrição
                  </th>
                  {mesesExibidos.map(m => (
                    <th key={m} className="w-[112px] min-w-[112px] whitespace-nowrap bg-muted px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{m}</th>
                  ))}
                  <th className="w-[132px] min-w-[132px] whitespace-nowrap bg-muted px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-foreground">Acumulado</th>
                  <th className="w-[72px] min-w-[72px] whitespace-nowrap bg-muted px-2.5 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">AV%</th>
                </tr>
              </thead>
              <tbody>
                {dre.map((item, index) => {
                  const total = item.valores.reduce((s, v) => s + v, 0);
                  const av = totalReceita > 0 ? (total / totalReceita) * 100 : 0;
                  const isSubtotal = item.tipo === "subtotal";
                  const isResultado = item.tipo === "resultado";
                  const isNegative = total < 0;
                  const rowBg = isResultado ? "bg-primary/12" : isSubtotal ? "bg-muted/45" : "bg-card";
                  const clicavel = !!item.grupo;

                  return (
                    <tr
                      key={index}
                      onClick={() => clicavel && abrirDetalhe(item)}
                      className={`border-b border-border/50 transition-colors ${rowBg} ${isResultado ? "ring-1 ring-inset ring-primary/25" : ""} ${clicavel ? "cursor-pointer hover:bg-muted/30" : ""}`}
                    >
                      <td className={`sticky left-0 z-10 w-[300px] min-w-[300px] border-b border-border/50 px-4 py-3 shadow-[1px_0_0_hsl(var(--border))] ${rowBg}`}>
                        <span className={`flex items-center gap-1.5 leading-snug ${item.indent && !isSubtotal ? "pl-3 text-muted-foreground" : ""} ${isSubtotal || isResultado ? "text-[12px] font-bold uppercase tracking-wide" : "font-medium"} ${isResultado ? "text-primary" : ""}`}>
                          {item.categoria}
                          {item.ajuda && <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />}
                        </span>
                        {item.ajuda && <span className="mt-0.5 block pl-3 text-[11px] leading-snug text-muted-foreground/80">{item.ajuda}</span>}
                      </td>
                      {item.valores.map((v, i) => (
                        <td key={i} className={`w-[112px] min-w-[112px] border-b border-border/50 px-3 py-3 text-right tabular-nums whitespace-nowrap ${isSubtotal || isResultado ? "font-bold" : "font-medium"} ${v < 0 ? "text-destructive" : ""} ${isResultado && v >= 0 ? "text-success" : ""}`}>
                          {formatCurrency(v)}
                        </td>
                      ))}
                      <td className={`w-[132px] min-w-[132px] border-b border-border/50 bg-muted/20 px-3 py-3 text-right font-bold tabular-nums whitespace-nowrap ${isNegative ? "text-destructive" : ""} ${isResultado && total >= 0 ? "text-success" : ""}`}>
                        {formatCurrency(total)}
                      </td>
                      <td className={`border-b border-border/50 px-2.5 py-3 text-right text-xs tabular-nums ${isSubtotal || isResultado ? "font-bold" : "text-muted-foreground"}`}>
                        {formatPercent(av)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 p-3 md:hidden">
            {dre.map((item, index) => {
              const total = item.valores.reduce((s, v) => s + v, 0);
              const av = totalReceita > 0 ? (total / totalReceita) * 100 : 0;
              const isSubtotal = item.tipo === "subtotal";
              const isResultado = item.tipo === "resultado";
              const isNegative = total < 0;
              const tone = isResultado
                ? "border-primary/35 bg-primary text-primary-foreground shadow-[0_14px_34px_hsl(var(--primary)/0.22)]"
                : isSubtotal
                  ? "border-border/70 bg-muted/55"
                  : "border-border/60 bg-card";

              return (
                <div
                  key={`${item.categoria}-${index}`}
                  onClick={() => item.grupo && abrirDetalhe(item)}
                  className={`rounded-[var(--radius)] border p-3 ${tone} ${item.grupo ? "cursor-pointer active:opacity-80" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`leading-snug ${isSubtotal || isResultado ? "text-[12px] font-bold uppercase tracking-wide" : "text-sm font-semibold"} ${item.indent && !isSubtotal ? "text-muted-foreground" : ""} ${isResultado ? "text-primary-foreground" : ""}`}>
                        {item.categoria}
                      </p>
                      <p className={`mt-1 text-[10px] font-semibold uppercase tracking-wider ${isResultado ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        AV {formatPercent(av)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-[10px] font-semibold uppercase tracking-wider ${isResultado ? "text-primary-foreground/70" : "text-muted-foreground"}`}>Acumulado</p>
                      <p className={`mt-1 text-sm font-bold tabular-nums ${isNegative && !isResultado ? "text-destructive" : ""} ${isResultado && total >= 0 ? "text-primary-foreground" : ""}`}>
                        {formatCurrency(total)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {item.valores.map((v, i) => (
                      <div key={`${item.categoria}-${mesesExibidos[i]}`} className={`rounded-md px-2.5 py-2 ${isResultado ? "bg-white/12" : "bg-muted/35"}`}>
                        <p className={`text-[10px] font-semibold uppercase tracking-wider ${isResultado ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{mesesExibidos[i]}</p>
                        <p className={`mt-0.5 text-sm font-semibold tabular-nums ${v < 0 && !isResultado ? "text-destructive" : ""} ${isResultado ? "text-primary-foreground" : ""}`}>
                          {formatCurrency(v)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Regras de cálculo */}
      <Card className="border-border/60 bg-muted/20">
        <CardContent className="py-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Como esta DRE é calculada</p>
          <ul className="grid gap-1.5 text-[12px] leading-snug text-muted-foreground sm:grid-cols-2">
            <li>• Receita: pedidos entregues/finalizados, pela data de entrega. Cancelados nunca entram.</li>
            <li>• CMV: quantidade vendida x preço de custo do produto. Compras do mês viram estoque, não custo.</li>
            <li>• Cada gasto entra uma única vez: pagamentos de compras e de contas a pagar são liquidação, não despesa.</li>
            <li>• Impostos: apenas os efetivamente lançados — não há percentual estimado.</li>
            <li>• Regime de competência: tudo pela data do fato, nunca pela data do pagamento.</li>
            <li>• Transferências entre caixa e bancos são ignoradas por não alterarem o resultado.</li>
          </ul>
        </CardContent>
      </Card>

      <DRELinhaDetalheDialog
        open={!!detalhe}
        onOpenChange={(o) => !o && setDetalhe(null)}
        titulo={detalhe?.titulo || ""}
        descricao={detalhe?.descricao}
        lancamentos={detalhe?.lancamentos || []}
      />

      {/* Resultado por Mês */}
      <Card className="min-w-0 overflow-hidden shadow-[var(--elev-2)]">
        <CardContent className="pt-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold">Resultado por Mês</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="mes" tick={chartAxisTick} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtBRLcompact} tick={chartAxisTick} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip formatter={(v) => formatCurrency(v)} />} cursor={{ fill: "hsl(var(--primary) / 0.06)" }} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Bar dataKey="lucro" name="Resultado" radius={[6, 6, 0, 0]} barSize={26}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.lucro >= 0 ? CHART_SEMANTIC.success : CHART_SEMANTIC.destructive} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );

  if (embedded) return content;
  return (
    <MainLayout>
      <div className="p-3 sm:p-4 md:p-6 w-full min-w-0 max-w-full overflow-x-hidden space-y-5">
        <DashboardHero
          variant="dark"
          eyebrow="Financeiro"
          icon={FileBarChart}
          title="DRE"
          description="Demonstrativo de Resultados — receita real, custo do que foi vendido e lucro, sem duplicidade."
        />
        {content}
      </div>
    </MainLayout>
  );
}

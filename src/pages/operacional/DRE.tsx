import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageSectionLoader } from "@/components/ui/page-loader";
import { FileDown, Printer, TrendingUp, TrendingDown, Percent, Wallet, FileBarChart } from "lucide-react";
import { exportDREtoPdf, handlePrint } from "@/services/reportPdfService";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Area, AreaChart, Line } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDate } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DashboardHero } from "@/components/dashboard/premium/DashboardHero";
import { PremiumKpiCard } from "@/components/dashboard/premium/PremiumKpiCard";
import { ChartTooltip } from "@/components/dashboard/premium/ChartTooltip";
import { chartGridProps, chartAxisTick, CHART_SEMANTIC, fmtBRLcompact } from "@/components/dashboard/premium/chartTheme";

interface DRELine {
  categoria: string;
  valores: number[];
  tipo: string;
  indent?: boolean;
}

const STATUS_RECEITA_DRE = ["entregue", "finalizado", "pago_cartao"];

export default function DRE({ embedded = false }: { embedded?: boolean }) {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [dre, setDre] = useState<DRELine[]>([]);
  const [meses, setMeses] = useState<string[]>([]);
  const [mesesVisiveis, setMesesVisiveis] = useState<string[]>([]);
  const [periodoMeses, setPeriodoMeses] = useState("3");

  useEffect(() => { fetchData(); }, [unidadeAtual, periodoMeses]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const hoje = getBrasiliaDate();
      const qtdMeses = Number(periodoMeses);
      const nomesMeses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const mesesCalc: string[] = [];
      const receitaBruta: number[] = [];
      const cmv: number[] = [];
      const comprasComprometidas: number[] = [];
      const despOp: number[] = [];
      const despAdmin: number[] = [];
      const despPessoal: number[] = [];
      const despFin: number[] = [];

      for (let i = qtdMeses - 1; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const inicio = startOfMonth(d).toISOString();
        const fim = endOfMonth(d).toISOString();
        const inicioDate = format(d, "yyyy-MM-dd");
        const fimDate = format(endOfMonth(d), "yyyy-MM-dd");
        mesesCalc.push(`${nomesMeses[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`);

        let pq = supabase
          .from("pedidos")
          .select("valor_total")
          .in("status", STATUS_RECEITA_DRE)
          .gte("data_entrega", inicio)
          .lte("data_entrega", fim);
        if (unidadeAtual?.id) pq = pq.eq("unidade_id", unidadeAtual.id);

        let dq = supabase.from("movimentacoes_bancarias").select("valor, categoria").eq("tipo", "saida").gte("data", inicioDate).lte("data", fimDate);
        if (unidadeAtual?.id) dq = dq.eq("unidade_id", unidadeAtual.id);

        // Regime competência: contas_pagar por vencimento (independe do status)
        let cpq = supabase.from("contas_pagar").select("valor, categoria, status").gte("vencimento", inicioDate).lte("vencimento", fimDate);
        if (unidadeAtual?.id) cpq = cpq.eq("unidade_id", unidadeAtual.id);

        // Compras (CMV real) — por data_compra
        let compq = supabase.from("compras").select("valor_total, valor_frete, pago, tipo_produto").gte("data_compra", inicioDate).lte("data_compra", fimDate);
        if (unidadeAtual?.id) compq = compq.eq("unidade_id", unidadeAtual.id);

        // Despesas contábeis registradas
        let dcq = supabase.from("despesas_contabeis").select("valor, categoria").gte("data_vencimento", inicioDate).lte("data_vencimento", fimDate);
        if (unidadeAtual?.id) dcq = dcq.eq("unidade_id", unidadeAtual.id);

        const [
          { data: pedidos },
          { data: despesasBanco },
          { data: contasPagar },
          { data: compras },
          { data: despesasContabeis },
        ] = await Promise.all([pq, dq, cpq, compq, dcq]);

        receitaBruta.push(pedidos?.reduce((s, p) => s + (p.valor_total || 0), 0) || 0);

        // CMV = total das compras do período (regime competência)
        let custoCompras = 0;
        let custoComprometido = 0;
        (compras || []).forEach((c: any) => {
          const val = Number(c.valor_total || 0);
          custoCompras += val;
          if (c.pago === false) custoComprometido += val;
        });
        cmv.push(custoCompras);
        comprasComprometidas.push(custoComprometido);

        // Contas a pagar (excluindo as ligadas a compras — já contadas em CMV)
        // + movimentações bancárias de saída + despesas contábeis
        const todasDespesas = [
          ...(despesasBanco || []).map((d: any) => ({ categoria: d.categoria, valor: Number(d.valor) })),
          ...(contasPagar || [])
            .filter((d: any) => {
              const c = (d.categoria || "").toLowerCase();
              return !(c.includes("compra") || c.includes("mercadoria") || c.includes("estoque"));
            })
            .map((d: any) => ({ categoria: d.categoria, valor: Number(d.valor) })),
          ...(despesasContabeis || []).map((d: any) => ({ categoria: d.categoria, valor: Number(d.valor) })),
        ];

        let op = 0, admin = 0, pessoal = 0, fin = 0;
        todasDespesas.forEach(d => {
          const cat = (d.categoria || "").toLowerCase();
          const val = d.valor || 0;
          if (cat.includes("pessoal") || cat.includes("salário") || cat.includes("salario") || cat.includes("folha") || cat.includes("comiss")) pessoal += val;
          else if (cat.includes("financ") || cat.includes("juros") || cat.includes("tarifa")) fin += val;
          else if (cat.includes("admin") || cat.includes("escrit") || cat.includes("contab")) admin += val;
          else op += val;
        });
        despOp.push(op);
        despAdmin.push(admin);
        despPessoal.push(pessoal);
        despFin.push(fin);
      }

      setMeses(mesesCalc);
      setMesesVisiveis(mesesCalc);

      const deducoes = receitaBruta.map(r => r * 0.05);
      const receitaLiquida = receitaBruta.map((r, i) => r - deducoes[i]);
      const lucroBruto = receitaLiquida.map((r, i) => r - cmv[i]);
      const totalDespOp = lucroBruto.map((_, i) => despOp[i] + despAdmin[i] + despPessoal[i]);
      const lucroOp = lucroBruto.map((r, i) => r - totalDespOp[i]);
      const lucroLiquido = lucroOp.map((r, i) => r - despFin[i]);

      const linhas: DRELine[] = [
        { categoria: "Receita Bruta de Vendas", valores: receitaBruta, tipo: "receita" },
        { categoria: "Deduções sobre Receita", valores: deducoes.map(v => -v), tipo: "deducao", indent: true },
        { categoria: "RECEITA LÍQUIDA", valores: receitaLiquida, tipo: "subtotal" },
        { categoria: "Custo das Mercadorias Vendidas (CMV)", valores: cmv.map(v => -v), tipo: "custo", indent: true },
      ];
      if (comprasComprometidas.some(v => v > 0)) {
        linhas.push({ categoria: "  ⚠ Compras não pagas (comprometido)", valores: comprasComprometidas, tipo: "custo", indent: true });
      }
      linhas.push(
        { categoria: "LUCRO BRUTO", valores: lucroBruto, tipo: "subtotal" },
        { categoria: "Despesas Operacionais", valores: despOp.map(v => -v), tipo: "despesa", indent: true },
        { categoria: "Despesas Administrativas", valores: despAdmin.map(v => -v), tipo: "despesa", indent: true },
        { categoria: "Despesas com Pessoal", valores: despPessoal.map(v => -v), tipo: "despesa", indent: true },
        { categoria: "RESULTADO OPERACIONAL (EBITDA)", valores: lucroOp, tipo: "subtotal" },
        { categoria: "Despesas Financeiras", valores: despFin.map(v => -v), tipo: "despesa", indent: true },
        { categoria: "RESULTADO LÍQUIDO DO EXERCÍCIO", valores: lucroLiquido, tipo: "resultado" },
      );
      setDre(linhas);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const visibleIndexes = useMemo(() => {
    const selected = mesesVisiveis.length > 0 ? mesesVisiveis : meses;
    return meses.map((mes, index) => selected.includes(mes) ? index : -1).filter(index => index >= 0);
  }, [meses, mesesVisiveis]);

  const mesesExibidos = useMemo(() => visibleIndexes.map(index => meses[index]), [meses, visibleIndexes]);

  const dreExibida = useMemo(() => dre.map(item => ({
    ...item,
    valores: visibleIndexes.map(index => item.valores[index] || 0),
  })), [dre, visibleIndexes]);

  const periodoLabel = mesesExibidos.length > 0 ? `${mesesExibidos[0]} — ${mesesExibidos[mesesExibidos.length - 1]}` : "Sem meses";

  const formatCurrency = (value: number) => {
    const safeValue = Number.isFinite(value) ? value : 0;
    const formatted = Math.abs(safeValue).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
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

  const totalReceita = dreExibida.find(d => d.categoria.includes("Receita Bruta"))?.valores.reduce((s, v) => s + v, 0) || 0;
  const totalLucro = dreExibida.find(d => d.tipo === "resultado")?.valores.reduce((s, v) => s + v, 0) || 0;
  const totalDesp = Math.abs(totalReceita - totalLucro);
  const margemLiquida = totalReceita > 0 ? (totalLucro / totalReceita) * 100 : 0;
  const lucroArr = dreExibida.find(d => d.tipo === "resultado")?.valores || [];
  const receitaArr = dreExibida.find(d => d.categoria.includes("Receita Bruta"))?.valores || [];

  // Evolução mensal
  const chartData = mesesExibidos.map((mes, i) => ({
    mes,
    receita: receitaArr[i] || 0,
    lucro: lucroArr[i] || 0,
    margem: receitaArr[i] > 0 ? ((lucroArr[i] || 0) / receitaArr[i]) * 100 : 0,
  }));

  // Variação último mês
  const variacao = lucroArr.length >= 2
    ? lucroArr[lucroArr.length - 2] !== 0
      ? ((lucroArr[lucroArr.length - 1] - lucroArr[lucroArr.length - 2]) / Math.abs(lucroArr[lucroArr.length - 2])) * 100
      : 0
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
          <Badge variant="outline" className="text-xs font-medium max-w-full truncate">
            {periodoLabel}
          </Badge>
        </div>
        <div className="w-full min-w-0 sm:max-w-[520px]">
          <div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 px-2.5 text-xs" onClick={() => setMesesVisiveis(meses)}>
              Todos
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 px-2.5 text-xs" onClick={() => setMesesVisiveis(meses.slice(-3))}>
              Últimos 3
            </Button>
            {meses.map(mes => {
              const active = mesesExibidos.includes(mes);
              return (
                <Button
                  key={mes}
                  type="button"
                  variant={active ? "default" : "outline"}
                  size="sm"
                  className="h-8 shrink-0 px-2.5 text-xs"
                  onClick={() => toggleMes(mes)}
                >
                  {mes}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto">
          <Button variant="outline" size="sm" className="h-10 sm:h-9 min-w-0" onClick={() => exportDREtoPdf(dreExibida, mesesExibidos, periodoLabel)}>
            <FileDown className="h-4 w-4 mr-1.5" /> Exportar PDF
          </Button>
          <Button variant="outline" size="sm" className="h-10 sm:h-9 min-w-0" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 w-full min-w-0">
        <PremiumKpiCard
          label="Receita Bruta"
          value={formatCurrency(totalReceita)}
          icon={TrendingUp}
          tone="success"
          sparkline={receitaArr}
        />
        <PremiumKpiCard
          label="Custos + Despesas"
          value={formatCurrency(totalDesp)}
          icon={TrendingDown}
          tone="destructive"
        />
        <PremiumKpiCard
          label="Resultado Líquido"
          value={formatCurrency(totalLucro)}
          icon={Wallet}
          tone={totalLucro >= 0 ? "success" : "destructive"}
          sparkline={lucroArr}
          trend={variacao !== 0 ? { value: variacao, label: "vs mês anterior" } : undefined}
        />
        <PremiumKpiCard
          label="Margem Líquida"
          value={`${margemLiquida.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
          icon={Percent}
          tone={margemLiquida >= 0 ? "info" : "destructive"}
        />
      </div>

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
            <Badge variant="secondary" className="text-xs">{mesesExibidos.length} meses</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 min-w-0 max-w-full overflow-hidden">
          <div className="hidden md:block w-full min-w-0 max-w-full max-h-[620px] overflow-auto overscroll-x-contain">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[13px]">
              <thead className="sticky top-0 z-30">
                <tr className="bg-muted/80">
                  <th className="sticky left-0 z-40 w-[280px] min-w-[280px] bg-muted px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground shadow-[1px_0_0_hsl(var(--border))]">
                    Descrição
                  </th>
                  {mesesExibidos.map(m => (
                    <th key={m} className="w-[112px] min-w-[112px] whitespace-nowrap bg-muted px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {m}
                    </th>
                  ))}
                  <th className="w-[132px] min-w-[132px] whitespace-nowrap bg-muted px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-foreground">
                    Acumulado
                  </th>
                  <th className="w-[72px] min-w-[72px] whitespace-nowrap bg-muted px-2.5 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    AV%
                  </th>
                </tr>
              </thead>
              <tbody>
                {dreExibida.map((item, index) => {
                  const total = item.valores.reduce((s, v) => s + v, 0);
                  const av = totalReceita > 0 ? (total / totalReceita) * 100 : 0;
                  const isSubtotal = item.tipo === "subtotal";
                  const isResultado = item.tipo === "resultado";
                  const isNegative = total < 0;
                  const rowBg = isResultado ? "bg-primary/12" : isSubtotal ? "bg-muted/45" : "bg-card";

                  return (
                    <tr
                      key={index}
                      className={`border-b border-border/50 transition-colors ${rowBg} ${isResultado ? "ring-1 ring-inset ring-primary/25" : ""} ${!isSubtotal && !isResultado ? "hover:bg-muted/20" : ""}`}
                    >
                      <td className={`sticky left-0 z-10 w-[280px] min-w-[280px] border-b border-border/50 px-4 py-3 shadow-[1px_0_0_hsl(var(--border))] ${rowBg}`}>
                        <span className={`block leading-snug ${item.indent && !isSubtotal ? "pl-3 text-muted-foreground" : ""} ${isSubtotal || isResultado ? "text-[12px] font-bold uppercase tracking-wide" : "font-medium"} ${isResultado ? "text-primary" : ""}`}>
                          {item.categoria}
                        </span>
                      </td>
                      {item.valores.map((v, i) => (
                        <td
                          key={i}
                          className={`w-[112px] min-w-[112px] border-b border-border/50 px-3 py-3 text-right tabular-nums whitespace-nowrap ${isSubtotal || isResultado ? "font-bold" : "font-medium"} ${v < 0 ? "text-destructive" : ""} ${isResultado && v >= 0 ? "text-success" : ""}`}
                        >
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

          <div className="md:hidden w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-max min-w-full border-separate border-spacing-0 text-[12px]">
              <thead className="sticky top-0 z-30">
                <tr>
                  <th className="sticky left-0 z-40 w-[170px] min-w-[170px] bg-card px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground shadow-[2px_0_0_hsl(var(--border))]">
                    DRE
                  </th>
                  {mesesExibidos.map(m => (
                    <th key={m} className="w-[104px] min-w-[104px] bg-muted px-2.5 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {m}
                    </th>
                  ))}
                  <th className="w-[76px] min-w-[76px] bg-muted px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    AV
                  </th>
                  <th className="w-[136px] min-w-[136px] bg-muted px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-foreground">
                    Acum.
                  </th>
                </tr>
              </thead>
              <tbody>
                {dreExibida.map((item, index) => {
                  const total = item.valores.reduce((s, v) => s + v, 0);
                  const av = totalReceita > 0 ? (total / totalReceita) * 100 : 0;
                  const isSubtotal = item.tipo === "subtotal";
                  const isResultado = item.tipo === "resultado";
                  const isNegative = total < 0;
                  const rowBg = isResultado ? "bg-primary/10" : isSubtotal ? "bg-muted/45" : "bg-card";
                  const fixedCellBg = isResultado ? "bg-primary" : isSubtotal ? "bg-muted" : "bg-card";

                  return (
                    <tr key={index} className={`${rowBg} ${isResultado ? "ring-1 ring-inset ring-primary/20" : ""}`}>
                      <td className={`sticky left-0 z-20 w-[170px] min-w-[170px] border-b border-border/50 px-3 py-3 align-middle shadow-[2px_0_0_hsl(var(--border))] ${fixedCellBg}`}>
                        <span className={`block whitespace-normal break-words leading-snug ${item.indent && !isSubtotal ? "pl-2 text-muted-foreground" : ""} ${isSubtotal || isResultado ? "text-[11px] font-bold uppercase" : "text-[12px] font-semibold"} ${isResultado ? "text-primary-foreground" : ""}`}>
                          {item.categoria}
                        </span>
                      </td>
                      {item.valores.map((v, i) => (
                        <td
                          key={`${item.categoria}-${mesesExibidos[i]}`}
                          className={`w-[104px] min-w-[104px] border-b border-border/50 px-2.5 py-3 text-right align-middle text-[12px] tabular-nums whitespace-nowrap ${isSubtotal || isResultado ? "font-bold" : "font-medium"} ${v < 0 ? "text-destructive" : ""} ${isResultado && v >= 0 ? "text-success" : ""}`}
                        >
                          {formatCurrency(v)}
                        </td>
                      ))}
                      <td className={`w-[76px] min-w-[76px] border-b border-border/50 px-3 py-3 text-right align-middle text-[11px] tabular-nums whitespace-nowrap ${isSubtotal || isResultado ? "font-bold" : "text-muted-foreground"}`}>
                        {formatPercent(av)}
                      </td>
                      <td className={`w-[136px] min-w-[136px] border-b border-border/50 bg-muted/20 px-3 py-3 text-right align-middle text-[12px] font-bold tabular-nums whitespace-nowrap ${isNegative ? "text-destructive" : ""} ${isResultado && total >= 0 ? "text-success" : ""}`}>
                        {formatCurrency(total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Margem por Mês - barras */}
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
          description="Demonstrativo de Resultados do Exercício — visão consolidada de receitas, custos e margens."
        />
        {content}
      </div>
    </MainLayout>
  );
}


import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileDown, Printer, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { exportDREtoPdf, handlePrint } from "@/services/reportPdfService";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Area, AreaChart } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDate } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DRELine {
  categoria: string;
  valores: number[];
  tipo: string;
  indent?: boolean;
}

export default function DRE({ embedded = false }: { embedded?: boolean }) {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [dre, setDre] = useState<DRELine[]>([]);
  const [meses, setMeses] = useState<string[]>([]);
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

        let pq = supabase.from("pedidos").select("valor_total").gte("created_at", inicio).lte("created_at", fim).neq("status", "cancelado");
        if (unidadeAtual?.id) pq = pq.eq("unidade_id", unidadeAtual.id);

        let dq = supabase.from("movimentacoes_bancarias").select("valor, categoria").eq("tipo", "saida").gte("data", inicioDate).lte("data", fimDate);
        if (unidadeAtual?.id) dq = dq.eq("unidade_id", unidadeAtual.id);

        let cpq = supabase.from("contas_pagar").select("valor, categoria").eq("status", "pago").gte("vencimento", inicioDate).lte("vencimento", fimDate);
        if (unidadeAtual?.id) cpq = cpq.eq("unidade_id", unidadeAtual.id);

        const [{ data: pedidos }, { data: despesasBanco }, { data: contasPagas }] = await Promise.all([pq, dq, cpq]);

        receitaBruta.push(pedidos?.reduce((s, p) => s + (p.valor_total || 0), 0) || 0);

        const todasDespesas = [
          ...(despesasBanco || []).map(d => ({ categoria: d.categoria, valor: Number(d.valor) })),
          ...(contasPagas || []).map(d => ({ categoria: (d as any).categoria, valor: Number(d.valor) })),
        ];

        let op = 0, admin = 0, pessoal = 0, fin = 0, custo = 0;
        todasDespesas.forEach(d => {
          const cat = (d.categoria || "").toLowerCase();
          const val = d.valor || 0;
          if (cat.includes("mercadoria") || cat.includes("compra") || cat.includes("estoque")) custo += val;
          else if (cat.includes("pessoal") || cat.includes("salário") || cat.includes("salario")) pessoal += val;
          else if (cat.includes("financ")) fin += val;
          else if (cat.includes("admin")) admin += val;
          else op += val;
        });
        cmv.push(custo);
        despOp.push(op);
        despAdmin.push(admin);
        despPessoal.push(pessoal);
        despFin.push(fin);
      }

      setMeses(mesesCalc);

      const deducoes = receitaBruta.map(r => r * 0.05);
      const receitaLiquida = receitaBruta.map((r, i) => r - deducoes[i]);
      const lucroBruto = receitaLiquida.map((r, i) => r - cmv[i]);
      const totalDespOp = lucroBruto.map((_, i) => despOp[i] + despAdmin[i] + despPessoal[i]);
      const lucroOp = lucroBruto.map((r, i) => r - totalDespOp[i]);
      const lucroLiquido = lucroOp.map((r, i) => r - despFin[i]);

      setDre([
        { categoria: "Receita Bruta de Vendas", valores: receitaBruta, tipo: "receita" },
        { categoria: "Deduções sobre Receita", valores: deducoes.map(v => -v), tipo: "deducao", indent: true },
        { categoria: "RECEITA LÍQUIDA", valores: receitaLiquida, tipo: "subtotal" },
        { categoria: "Custo das Mercadorias Vendidas (CMV)", valores: cmv.map(v => -v), tipo: "custo", indent: true },
        { categoria: "LUCRO BRUTO", valores: lucroBruto, tipo: "subtotal" },
        { categoria: "Despesas Operacionais", valores: despOp.map(v => -v), tipo: "despesa", indent: true },
        { categoria: "Despesas Administrativas", valores: despAdmin.map(v => -v), tipo: "despesa", indent: true },
        { categoria: "Despesas com Pessoal", valores: despPessoal.map(v => -v), tipo: "despesa", indent: true },
        { categoria: "RESULTADO OPERACIONAL (EBITDA)", valores: lucroOp, tipo: "subtotal" },
        { categoria: "Despesas Financeiras", valores: despFin.map(v => -v), tipo: "despesa", indent: true },
        { categoria: "RESULTADO LÍQUIDO DO EXERCÍCIO", valores: lucroLiquido, tipo: "resultado" },
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    const formatted = Math.abs(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return value < 0 ? `(${formatted})` : formatted;
  };

  if (loading) {
    const loader = <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    if (embedded) return loader;
    return (
      <MainLayout>
        <Header title="DRE" subtitle="Demonstrativo de Resultados do Exercício" />
        {loader}
      </MainLayout>
    );
  }

  const totalReceita = dre.find(d => d.categoria.includes("Receita Bruta"))?.valores.reduce((s, v) => s + v, 0) || 0;
  const totalLucro = dre.find(d => d.tipo === "resultado")?.valores.reduce((s, v) => s + v, 0) || 0;
  const totalDesp = Math.abs(totalReceita - totalLucro);
  const margemLiquida = totalReceita > 0 ? (totalLucro / totalReceita) * 100 : 0;
  const lucroArr = dre.find(d => d.tipo === "resultado")?.valores || [];
  const receitaArr = dre.find(d => d.categoria.includes("Receita Bruta"))?.valores || [];

  // Evolução mensal
  const chartData = meses.map((mes, i) => ({
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
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between w-full min-w-0">
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
            {meses[0]} — {meses[meses.length - 1]}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto">
          <Button variant="outline" size="sm" className="h-10 sm:h-9 min-w-0" onClick={() => exportDREtoPdf(dre, meses, `${meses[0]} a ${meses[meses.length - 1]}`)}>
            <FileDown className="h-4 w-4 mr-1.5" /> Exportar PDF
          </Button>
          <Button variant="outline" size="sm" className="h-10 sm:h-9 min-w-0" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 w-full min-w-0">
        <KPICard
          label="Receita Bruta"
          value={totalReceita}
          icon={<TrendingUp className="h-4 w-4" />}
          color="green"
        />
        <KPICard
          label="Custos + Despesas"
          value={-totalDesp}
          icon={<TrendingDown className="h-4 w-4" />}
          color="red"
        />
        <KPICard
          label="Resultado Líquido"
          value={totalLucro}
          icon={totalLucro >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          color={totalLucro >= 0 ? "green" : "red"}
          badge={variacao !== 0 ? `${variacao > 0 ? "+" : ""}${variacao.toFixed(1)}%` : undefined}
        />
        <KPICard
          label="Margem Líquida"
          value={margemLiquida}
          isPercent
          icon={margemLiquida >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          color={margemLiquida >= 0 ? "blue" : "red"}
        />
      </div>

      {/* Gráfico de Evolução */}
      <Card className="min-w-0 overflow-hidden">
        <CardContent className="pt-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Evolução Mensal</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(152, 69%, 40%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(152, 69%, 40%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradLucro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(215, 90%, 52%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(215, 90%, 52%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                  name === "receita" ? "Receita" : "Resultado"
                ]}
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="receita" stroke="hsl(152, 69%, 40%)" fill="url(#gradReceita)" strokeWidth={2} />
              <Area type="monotone" dataKey="lucro" stroke="hsl(215, 90%, 52%)" fill="url(#gradLucro)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-3 h-0.5 rounded" style={{ backgroundColor: "hsl(152, 69%, 40%)" }} /> Receita
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-3 h-0.5 rounded" style={{ backgroundColor: "hsl(215, 90%, 52%)" }} /> Resultado
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela DRE Principal */}
      <Card className="min-w-0 overflow-hidden">
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-muted/60 border-b-2 border-border">
                  <th className="text-left py-2.5 px-3 sm:px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground sticky left-0 bg-muted/60 z-10 min-w-[210px] sm:min-w-[260px]">
                    Descrição
                  </th>
                  {meses.map(m => (
                    <th key={m} className="text-right py-2.5 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground min-w-[110px]">
                      {m}
                    </th>
                  ))}
                  <th className="text-right py-2.5 px-4 text-xs font-bold uppercase tracking-wider min-w-[120px] bg-muted/80">
                    Acumulado
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground min-w-[70px]">
                    AV%
                  </th>
                </tr>
              </thead>
              <tbody>
                {dre.map((item, index) => {
                  const total = item.valores.reduce((s, v) => s + v, 0);
                  const av = totalReceita > 0 ? (total / totalReceita) * 100 : 0;
                  const isSubtotal = item.tipo === "subtotal";
                  const isResultado = item.tipo === "resultado";
                  const isNegative = total < 0;

                  return (
                    <tr
                      key={index}
                      className={`
                        border-b border-border/50 transition-colors
                        ${isResultado ? "bg-primary/5 border-t-2 border-b-2 border-primary/20" : ""}
                        ${isSubtotal ? "bg-muted/30 border-t" : ""}
                        ${!isSubtotal && !isResultado ? "hover:bg-muted/20" : ""}
                      `}
                    >
                      <td className={`py-2 px-3 sm:px-4 sticky left-0 z-10 ${isResultado ? "bg-primary/5" : isSubtotal ? "bg-muted/30" : "bg-card"}`}>
                        <span className={`
                          ${item.indent && !isSubtotal ? "pl-4" : ""}
                          ${isSubtotal || isResultado ? "font-bold text-xs uppercase tracking-wide" : "text-sm"}
                          ${isResultado ? "text-primary" : ""}
                        `}>
                          {item.categoria}
                        </span>
                      </td>
                      {item.valores.map((v, i) => (
                        <td
                          key={i}
                          className={`py-2 px-3 text-right tabular-nums
                            ${isSubtotal || isResultado ? "font-bold" : "font-medium"}
                            ${isNegative || v < 0 ? "text-destructive" : ""}
                            ${isResultado && v >= 0 ? "text-green-600" : ""}
                          `}
                        >
                          {formatCurrency(v)}
                        </td>
                      ))}
                      <td className={`py-2 px-4 text-right tabular-nums font-bold bg-muted/10
                        ${isNegative ? "text-destructive" : ""}
                        ${isResultado && total >= 0 ? "text-green-600" : ""}
                        ${isResultado && total < 0 ? "text-destructive" : ""}
                      `}>
                        {formatCurrency(total)}
                      </td>
                      <td className={`py-2 px-3 text-right tabular-nums text-xs
                        ${isSubtotal || isResultado ? "font-bold" : "text-muted-foreground"}
                      `}>
                        {Math.abs(av).toFixed(1)}%
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
      <Card className="min-w-0 overflow-hidden">
        <CardContent className="pt-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Resultado por Mês</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Resultado"]}
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Bar dataKey="lucro" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.lucro >= 0 ? "hsl(152, 69%, 40%)" : "hsl(0, 72%, 51%)"} />
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
      <Header title="DRE" subtitle="Demonstrativo de Resultados do Exercício" />
      <div className="p-3 sm:p-4 md:p-6 w-full min-w-0 max-w-full overflow-x-hidden">{content}</div>
    </MainLayout>
  );
}

// --- KPI Card Component ---
function KPICard({ label, value, icon, color, isPercent, badge }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "green" | "red" | "blue";
  isPercent?: boolean;
  badge?: string;
}) {
  const colorMap = {
    green: { bg: "bg-green-500/10", text: "text-green-600", gradient: "from-green-500/5" },
    red: { bg: "bg-destructive/10", text: "text-destructive", gradient: "from-destructive/5" },
    blue: { bg: "bg-blue-500/10", text: "text-blue-600", gradient: "from-blue-500/5" },
  };
  const c = colorMap[color];

  const display = isPercent
    ? `${value.toFixed(1)}%`
    : `${(Math.abs(value) / 1000).toFixed(1)}k`;

  return (
    <Card className="relative overflow-hidden min-w-0">
      <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient} to-transparent pointer-events-none`} />
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <div className={`p-1.5 rounded-lg ${c.bg}`}>
            <span className={c.text}>{icon}</span>
          </div>
          {badge && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
              badge.startsWith("+") ? "text-green-600 border-green-200 bg-green-50" : "text-destructive border-destructive/20 bg-destructive/5"
            }`}>
              {badge}
            </Badge>
          )}
        </div>
        <p className={`text-lg sm:text-xl font-bold tabular-nums truncate ${value < 0 && !isPercent ? "text-destructive" : c.text}`}>
          {value < 0 && !isPercent ? `-${display}` : display}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{label}</p>
      </CardContent>
    </Card>
  );
}

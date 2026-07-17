import { MainLayout } from "@/components/layout/MainLayout";
import { parseLocalDate, getBrasiliaDateString } from "@/lib/utils";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import {
  DollarSign, TrendingUp, AlertTriangle, CreditCard,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, Banknote,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format, subMonths, startOfMonth, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { KpiCard, SectionCard } from "@/components/shared";

export default function DashboardFinanceiro() {
  const { unidadeAtual } = useUnidade();
  const navigate = useNavigate();
  const hoje = getBrasiliaDateString();

  // Contas a Pagar
  const { data: contasPagar = [] } = useQuery({
    queryKey: ["dash_fin_pagar", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("contas_pagar").select("valor, vencimento, status");
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return data || [];
    },
  });

  // Contas a Receber
  const { data: contasReceber = [], refetch: refetchReceber } = useQuery({
    queryKey: ["dash_fin_receber", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("contas_receber").select("id, valor, valor_liquido, valor_taxa, vencimento, status, forma_pagamento, conta_bancaria_destino_id, operadora_id, taxa_percentual, descricao");
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return data || [];
    },
  });

  // Contas bancárias (para agrupar recebíveis)
  const { data: contasBancarias = [] } = useQuery({
    queryKey: ["dash_fin_contas_bancarias", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("contas_bancarias").select("id, nome, banco, saldo_atual").eq("ativo", true);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return data || [];
    },
  });

  // Saldo bancário real
  const { data: saldoBancario = 0 } = useQuery({
    queryKey: ["dash_fin_saldo_bancario"],
    queryFn: async () => {
      const { data } = await supabase.from("contas_bancarias").select("saldo_atual").eq("ativo", true);
      return data?.reduce((s, c) => s + Number(c.saldo_atual || 0), 0) || 0;
    },
  });

  // Movimentações bancárias reais últimos 6 meses
  const { data: movimentacoes = [] } = useQuery({
    queryKey: ["dash_fin_movs_bancarias", unidadeAtual?.id],
    queryFn: async () => {
      const inicio = format(subMonths(startOfMonth(new Date()), 5), "yyyy-MM-dd");
      let q = supabase.from("movimentacoes_bancarias").select("tipo, valor, data").gte("data", inicio);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return data || [];
    },
  });

  // KPIs
  const pagarPendente = contasPagar.filter((c: any) => c.status === "pendente");
  const totalPagar = pagarPendente.reduce((s: number, c: any) => s + Number(c.valor), 0);
  const vencidasPagar = pagarPendente.filter((c: any) => c.vencimento < hoje);
  const totalVencidasPagar = vencidasPagar.reduce((s: number, c: any) => s + Number(c.valor), 0);

  const receberPendente = contasReceber.filter((c: any) => c.status === "pendente");
  const totalReceber = receberPendente.reduce((s: number, c: any) => s + Number(c.valor), 0);
  const vencidasReceber = receberPendente.filter((c: any) => c.vencimento < hoje);
  const totalVencidasReceber = vencidasReceber.reduce((s: number, c: any) => s + Number(c.valor), 0);

  const saldoProjetado = totalReceber - totalPagar;

  // Próximos 7 dias
  const prox7 = format(addDays(new Date(), 7), "yyyy-MM-dd");
  const pagarProx7 = pagarPendente.filter((c: any) => c.vencimento >= hoje && c.vencimento <= prox7).reduce((s: number, c: any) => s + Number(c.valor), 0);
  const receberProx7 = receberPendente.filter((c: any) => c.vencimento >= hoje && c.vencimento <= prox7).reduce((s: number, c: any) => s + Number(c.valor), 0);

  // Gráfico mensal
  const chartData = (() => {
    const meses: Record<string, { entradas: number; saidas: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      meses[format(d, "yyyy-MM")] = { entradas: 0, saidas: 0 };
    }
    movimentacoes.forEach((m: any) => {
      const key = format(parseLocalDate(m.data), "yyyy-MM");
      if (meses[key]) {
        if (m.tipo === "entrada") meses[key].entradas += Number(m.valor);
        else meses[key].saidas += Number(m.valor);
      }
    });
    return Object.entries(meses).map(([key, val]) => ({
      mes: format(new Date(key + "-01"), "MMM", { locale: ptBR }),
      Entradas: val.entradas,
      Saídas: val.saidas,
    }));
  })();

  // Pie chart - composição
  const pieData = [
    { name: "A Receber", value: totalReceber, color: "hsl(var(--success))" },
    { name: "A Pagar", value: totalPagar, color: "hsl(var(--destructive))" },
    { name: "Vencidas (Pagar)", value: totalVencidasPagar, color: "hsl(var(--warning))" },
    { name: "Vencidas (Receber)", value: totalVencidasReceber, color: "hsl(var(--accent))" },
  ].filter(d => d.value > 0);

  // Alertas
  const alertas = [];
  if (vencidasPagar.length > 0) alertas.push({ tipo: "danger", msg: `${vencidasPagar.length} conta(s) a pagar vencida(s) — R$ ${totalVencidasPagar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` });
  if (vencidasReceber.length > 0) alertas.push({ tipo: "warning", msg: `${vencidasReceber.length} recebível(is) vencido(s) — R$ ${totalVencidasReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` });
  if (saldoProjetado < 0) alertas.push({ tipo: "danger", msg: `Saldo projetado negativo: R$ ${saldoProjetado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` });
  if (pagarProx7 > receberProx7) alertas.push({ tipo: "warning", msg: `Próximos 7 dias: saídas (R$ ${pagarProx7.toLocaleString("pt-BR")}) superam entradas (R$ ${receberProx7.toLocaleString("pt-BR")})` });

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <MainLayout>
      <Header title="Dashboard Financeiro" subtitle="Visão consolidada das finanças" />
      <div className="p-4 md:p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div onClick={() => navigate("/financeiro/receber")} className="cursor-pointer">
            <KpiCard icon={ArrowUpRight} label="A Receber" value={fmt(totalReceber)} tone="success" hint={`${receberPendente.length} pendente(s)`} />
          </div>
          <div onClick={() => navigate("/financeiro/pagar")} className="cursor-pointer">
            <KpiCard icon={ArrowDownRight} label="A Pagar" value={fmt(totalPagar)} tone="destructive" hint={`${pagarPendente.length} pendente(s)`} />
          </div>
          <KpiCard icon={DollarSign} label="Saldo Projetado" value={fmt(saldoProjetado)} tone={saldoProjetado >= 0 ? "success" : "destructive"} hint="Receber − Pagar" />
          <KpiCard icon={Banknote} label="Saldo Bancário" value={fmt(saldoBancario)} tone={saldoBancario >= 0 ? "primary" : "destructive"} hint="Todas as contas" />
        </div>

        {/* Alertas */}
        {alertas.length > 0 && (
          <SectionCard title="Alertas Financeiros" icon={AlertTriangle} className="border-warning/40">
            <div className="space-y-2">
              {alertas.map((a, i) => (
                <div key={i} className={`flex items-start gap-2 text-sm p-3 rounded-lg ${a.tipo === "danger" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{a.msg}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Recebíveis por Banco */}
        <SectionCard
          title="Recebíveis por Banco"
          description="Cartão, PIX-maquininha e boletos aguardando depósito"
          actions={
            <Button
              size="sm"
              onClick={async () => {
                const hoje2 = getBrasiliaDateString();
                const aLiquidar = receberPendente.filter((c: any) => c.vencimento <= hoje2 && c.conta_bancaria_destino_id);
                if (!aLiquidar.length) { alert("Nenhum recebível vencido para liquidar hoje."); return; }
                if (!confirm(`Liquidar ${aLiquidar.length} recebível(is) vencido(s) — R$ ${aLiquidar.reduce((s: number, c: any) => s + Number(c.valor_liquido || c.valor), 0).toFixed(2)}?`)) return;
                const { criarMovimentacaoBancaria } = await import("@/services/paymentRoutingService");
                for (const c of aLiquidar) {
                  const liquido = Number(c.valor_liquido || c.valor);
                  const { data: upd } = await supabase
                    .from("contas_receber")
                    .update({ status: "recebida", data_recebimento: hoje2 } as any)
                    .eq("id", c.id)
                    .eq("status", "pendente")
                    .select("id");
                  if (!upd || upd.length === 0) continue;
                  await criarMovimentacaoBancaria({
                    contaBancariaId: c.conta_bancaria_destino_id,
                    valor: liquido,
                    descricao: `Liquidação ${c.forma_pagamento} — ${c.descricao || ""}`.trim(),
                    categoria: "recebimento_cartao",
                    unidadeId: unidadeAtual?.id || null,
                  });
                }
                await refetchReceber();
                alert(`${aLiquidar.length} recebível(is) liquidado(s) com sucesso.`);
              }}
            >
              Liquidar vencidos hoje
            </Button>
          }
        >
          {(() => {
            const grupos: Record<string, { nome: string; banco: string; hoje: number; d7: number; d30: number; total: number; count: number }> = {};
            const semBanco = { nome: "⚠ Sem banco vinculado", banco: "", hoje: 0, d7: 0, d30: 0, total: 0, count: 0 };
            const d7 = format(addDays(new Date(), 7), "yyyy-MM-dd");
            const d30 = format(addDays(new Date(), 30), "yyyy-MM-dd");
            receberPendente.forEach((c: any) => {
              const cbId = c.conta_bancaria_destino_id;
              const target = cbId
                ? (grupos[cbId] ||= { nome: contasBancarias.find((b: any) => b.id === cbId)?.nome || "Conta", banco: contasBancarias.find((b: any) => b.id === cbId)?.banco || "", hoje: 0, d7: 0, d30: 0, total: 0, count: 0 })
                : semBanco;
              const val = Number(c.valor_liquido || c.valor);
              target.total += val;
              target.count += 1;
              if (c.vencimento <= hoje) target.hoje += val;
              else if (c.vencimento <= d7) target.d7 += val;
              else if (c.vencimento <= d30) target.d30 += val;
            });
            const lista = Object.values(grupos);
            if (semBanco.count > 0) lista.push(semBanco);
            if (!lista.length) return <p className="text-sm text-muted-foreground text-center py-4">Sem recebíveis pendentes.</p>;
            return (
              <div className="space-y-2">
                {lista.map((g, i) => (
                  <div key={i} className="flex flex-col gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{g.nome} {g.banco && <span className="text-xs text-muted-foreground ml-1">({g.banco})</span>}</p>
                      <p className="text-xs text-muted-foreground">{g.count} título(s) · Total {fmt(g.total)}</p>
                    </div>
                    <div className="flex gap-4 text-right shrink-0">
                      <div className="text-xs">
                        <p className="text-muted-foreground">Hoje/vencido</p>
                        <p className="font-semibold text-warning">{fmt(g.hoje)}</p>
                      </div>
                      <div className="text-xs">
                        <p className="text-muted-foreground">Até 7d</p>
                        <p className="font-semibold text-foreground">{fmt(g.d7)}</p>
                      </div>
                      <div className="text-xs">
                        <p className="text-muted-foreground">Até 30d</p>
                        <p className="font-semibold text-foreground">{fmt(g.d30)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </SectionCard>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SectionCard title="Evolução Mensal — Entradas vs Saídas" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR")}`} />
                <Legend />
                <Bar dataKey="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Composição Financeira">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR")}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-12">Sem dados</p>
            )}
          </SectionCard>
        </div>

        {/* Próximos 7 dias */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SectionCard title="Próximos 7 dias — A Pagar" icon={Clock}>
            <div className="text-2xl font-bold text-destructive">{fmt(pagarProx7)}</div>
            <p className="text-sm text-muted-foreground mt-1">{pagarPendente.filter((c: any) => c.vencimento >= hoje && c.vencimento <= prox7).length} conta(s)</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/financeiro/pagar")}>Ver todas</Button>
          </SectionCard>

          <SectionCard title="Próximos 7 dias — A Receber" icon={CheckCircle2}>
            <div className="text-2xl font-bold text-success">{fmt(receberProx7)}</div>
            <p className="text-sm text-muted-foreground mt-1">{receberPendente.filter((c: any) => c.vencimento >= hoje && c.vencimento <= prox7).length} recebível(is)</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/financeiro/receber")}>Ver todos</Button>
          </SectionCard>
        </div>

        {/* Atalhos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigate("/financeiro/fluxo")}>
            <TrendingUp className="h-5 w-5" />
            <span className="text-xs">Fluxo de Caixa</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigate("/financeiro/aging")}>
            <Banknote className="h-5 w-5" />
            <span className="text-xs">Aging Report</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigate("/financeiro/boletos")}>
            <CreditCard className="h-5 w-5" />
            <span className="text-xs">Boletos</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigate("/financeiro/calendario")}>
            <Clock className="h-5 w-5" />
            <span className="text-xs">Calendário</span>
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}

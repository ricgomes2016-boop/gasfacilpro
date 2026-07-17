import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Package, DollarSign, Truck, Clock, Target, Gauge } from "lucide-react";
import { RemindersWidget } from "@/components/dashboard/RemindersWidget";
import { AiInsightsWidget } from "@/components/dashboard/AiInsightsWidget";
import { ProdutividadeWidget } from "@/components/operacional/ProdutividadeWidget";
import { PrevisaoDemandaWidget } from "@/components/operacional/PrevisaoDemandaWidget";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { getBrasiliaDate } from "@/lib/utils";
import { DashboardHero } from "@/components/dashboard/premium/DashboardHero";
import { PremiumKpiCard } from "@/components/dashboard/premium/PremiumKpiCard";
import { KpiCardSkeleton } from "@/components/dashboard/premium/skeletons";
import { fmtBRL } from "@/components/dashboard/premium/chartTheme";

export default function CockpitGestor() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState({
    vendasHoje: 0, faturamentoHoje: 0, ticketMedio: 0,
    pedidosPendentes: 0, entregadoresAtivos: 0, entregadoresEmRota: 0,
    estoqueBaixo: 0, contasVencer: 0, alertasJornada: 0,
    faturamentoMes: 0, metaMensal: 150000,
    pedidosOntem: 0, faturamentoOntem: 0,
  });

  useEffect(() => { fetchData(); }, [unidadeAtual]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const now = getBrasiliaDate();
      const hojeInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const ontemInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
      const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      let pHoje = supabase.from("pedidos").select("valor_total").gte("created_at", hojeInicio).neq("status", "cancelado");
      if (unidadeAtual?.id) pHoje = pHoje.eq("unidade_id", unidadeAtual.id);
      const { data: pedidosHoje } = await pHoje;
      const fatHoje = pedidosHoje?.reduce((s, p) => s + (p.valor_total || 0), 0) || 0;

      let pOntem = supabase.from("pedidos").select("valor_total").gte("created_at", ontemInicio).lt("created_at", hojeInicio).neq("status", "cancelado");
      if (unidadeAtual?.id) pOntem = pOntem.eq("unidade_id", unidadeAtual.id);
      const { data: pedidosOntem } = await pOntem;
      const fatOntem = pedidosOntem?.reduce((s, p) => s + (p.valor_total || 0), 0) || 0;

      let pMes = supabase.from("pedidos").select("valor_total").gte("created_at", mesInicio).neq("status", "cancelado");
      if (unidadeAtual?.id) pMes = pMes.eq("unidade_id", unidadeAtual.id);
      const { data: pedidosMes } = await pMes;
      const fatMes = pedidosMes?.reduce((s, p) => s + (p.valor_total || 0), 0) || 0;

      let pPend = supabase.from("pedidos").select("id", { count: "exact" }).eq("status", "pendente");
      if (unidadeAtual?.id) pPend = pPend.eq("unidade_id", unidadeAtual.id);
      const { count: pendentes } = await pPend;

      const { data: entregs } = await supabase.from("entregadores").select("status").eq("ativo", true);
      const emRota = entregs?.filter(e => e.status === "em_rota").length || 0;

      let eBaixo = supabase.from("produtos").select("id", { count: "exact" }).eq("ativo", true).lt("estoque", 10);
      if (unidadeAtual?.id) eBaixo = eBaixo.eq("unidade_id", unidadeAtual.id);
      const { count: estoqueBaixo } = await eBaixo;

      const tresDias = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      let cv = supabase.from("contas_pagar").select("id", { count: "exact" }).eq("status", "pendente").lte("vencimento", tresDias);
      if (unidadeAtual?.id) cv = cv.eq("unidade_id", unidadeAtual.id);
      const { count: contasVencer } = await cv;

      let aj = supabase.from("alertas_jornada").select("id", { count: "exact" }).eq("resolvido", false);
      if (unidadeAtual?.id) aj = aj.eq("unidade_id", unidadeAtual.id);
      const { count: alertas } = await aj;

      setDados({
        vendasHoje: pedidosHoje?.length || 0, faturamentoHoje: fatHoje,
        ticketMedio: pedidosHoje?.length ? fatHoje / pedidosHoje.length : 0,
        pedidosPendentes: pendentes || 0, entregadoresAtivos: entregs?.length || 0,
        entregadoresEmRota: emRota, estoqueBaixo: estoqueBaixo || 0,
        contasVencer: contasVencer || 0, alertasJornada: alertas || 0,
        faturamentoMes: fatMes, metaMensal: 150000,
        pedidosOntem: pedidosOntem?.length || 0, faturamentoOntem: fatOntem,
      });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const progressoMeta = Math.min((dados.faturamentoMes / dados.metaMensal) * 100, 100);
  const variacaoVendas = dados.faturamentoOntem > 0 ? ((dados.faturamentoHoje - dados.faturamentoOntem) / dados.faturamentoOntem * 100) : 0;
  const dataStr = getBrasiliaDate().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const alertasTotal = dados.pedidosPendentes + dados.estoqueBaixo + dados.contasVencer + dados.alertasJornada;

  return (
    <MainLayout>
      <div className="p-3 sm:p-4 md:p-6 space-y-5 md:space-y-6">
        <DashboardHero
          eyebrow={dataStr}
          icon={Gauge}
          title={`${saudacao}, Gestor!`}
          description="Visão consolidada do dia: performance, operação e alertas críticos em um só lugar."
        />

        {alertasTotal > 0 && (
          <div className="rounded-[var(--radius)] border border-destructive/40 bg-destructive/5 p-4 shadow-[var(--elev-1)]">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="font-semibold text-destructive">Atenção Necessária ({alertasTotal})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {dados.pedidosPendentes > 0 && <Badge variant="outline">{dados.pedidosPendentes} pedidos pendentes</Badge>}
              {dados.estoqueBaixo > 0 && <Badge variant="outline">{dados.estoqueBaixo} produtos com estoque baixo</Badge>}
              {dados.contasVencer > 0 && <Badge variant="outline">{dados.contasVencer} contas vencem em 3 dias</Badge>}
              {dados.alertasJornada > 0 && <Badge variant="outline">{dados.alertasJornada} alertas de jornada</Badge>}
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <PremiumKpiCard
              label="Faturamento Hoje"
              value={fmtBRL(dados.faturamentoHoje)}
              icon={DollarSign}
              tone="success"
              trend={variacaoVendas !== 0 ? { value: variacaoVendas, label: "vs ontem" } : undefined}
            />
            <PremiumKpiCard
              label="Vendas Hoje"
              value={String(dados.vendasHoje)}
              icon={Package}
              tone="primary"
              subtitle={`Ticket médio ${fmtBRL(dados.ticketMedio)}`}
            />
            <PremiumKpiCard
              label="Entregadores"
              value={`${dados.entregadoresEmRota}/${dados.entregadoresAtivos}`}
              icon={Truck}
              tone="info"
              subtitle="em rota / ativos"
            />
            <PremiumKpiCard
              label="Pedidos Pendentes"
              value={String(dados.pedidosPendentes)}
              icon={Clock}
              tone="warning"
              subtitle="aguardando ação"
            />
          </div>
        )}

        <div className="rounded-[var(--radius)] border border-border/60 bg-card p-5 shadow-[var(--elev-2)]">
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold">Meta Mensal</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm tabular-nums">
              <span className="font-semibold text-foreground">{fmtBRL(dados.faturamentoMes)}</span>
              <span className="text-muted-foreground">Meta: {fmtBRL(dados.metaMensal)}</span>
            </div>
            <Progress value={progressoMeta} className="h-3" />
            <p className="text-center text-sm text-muted-foreground tabular-nums">
              {progressoMeta.toFixed(1)}% da meta atingida
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ProdutividadeWidget />
          <PrevisaoDemandaWidget />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <RemindersWidget />
          <AiInsightsWidget />
        </div>
      </div>
    </MainLayout>
  );
}

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subDays, subWeeks, subMonths, differenceInCalendarDays, format,
} from "date-fns";
import { DollarSign, ShoppingCart, Truck, Users, TrendingUp, PackageX } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { PremiumKpiCard, KpiTone } from "./premium/PremiumKpiCard";
import { KpiGridSkeleton } from "./premium/skeletons";

type Periodo = "hoje" | "semana" | "mes";

function getRange(p: Periodo) {
  const now = new Date();
  if (p === "hoje") return { ini: startOfDay(now), fim: endOfDay(now) };
  if (p === "semana") return { ini: startOfWeek(now, { weekStartsOn: 1 }), fim: endOfWeek(now, { weekStartsOn: 1 }) };
  return { ini: startOfMonth(now), fim: endOfMonth(now) };
}

function getPreviousRange(p: Periodo) {
  const now = new Date();
  if (p === "hoje") { const d = subDays(now, 1); return { ini: startOfDay(d), fim: endOfDay(d) }; }
  if (p === "semana") { const d = subWeeks(now, 1); return { ini: startOfWeek(d, { weekStartsOn: 1 }), fim: endOfWeek(d, { weekStartsOn: 1 }) }; }
  const d = subMonths(now, 1); return { ini: startOfMonth(d), fim: endOfMonth(d) };
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const pctDelta = (curr: number, prev: number): number => {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / Math.abs(prev)) * 100;
};

export function DashboardKpis() {
  const { unidadeAtual } = useUnidade();
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const { ini, fim } = useMemo(() => getRange(periodo), [periodo]);
  const prev = useMemo(() => getPreviousRange(periodo), [periodo]);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-kpis", unidadeAtual?.id, periodo],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      const iniISO = format(ini, "yyyy-MM-dd");
      const fimISO = format(fim, "yyyy-MM-dd");
      const prevIniISO = format(prev.ini, "yyyy-MM-dd");
      const prevFimISO = format(prev.fim, "yyyy-MM-dd");
      const sb = supabase as any;

      const pedidosQ = sb
        .from("pedidos")
        .select("id, status, valor_total, data_entrega, created_at")
        .or(`unidade_id.eq.${unidadeAtual!.id},unidade_id.is.null`)
        .gte("data_entrega", iniISO)
        .lte("data_entrega", fimISO);

      const pedidosPrevQ = sb
        .from("pedidos")
        .select("id, status, valor_total")
        .or(`unidade_id.eq.${unidadeAtual!.id},unidade_id.is.null`)
        .gte("data_entrega", prevIniISO)
        .lte("data_entrega", prevFimISO);

      const clientesUnQ = sb
        .from("cliente_unidades")
        .select("cliente_id", { count: "exact", head: true })
        .eq("unidade_id", unidadeAtual!.id);

      const estoqueQ = sb
        .from("vw_previsao_ruptura")
        .select("id, situacao")
        .eq("unidade_id", unidadeAtual!.id)
        .neq("situacao", "ok");

      const [{ data: pedidos }, { data: pedidosPrev }, { count: clientesCount }, { data: estoque }] = await Promise.all([
        pedidosQ, pedidosPrevQ, clientesUnQ, estoqueQ,
      ]);

      const ped = pedidos || [];
      const pedPrev = pedidosPrev || [];
      const concluidos = ped.filter((p: any) => ["entregue", "finalizado", "pago_cartao"].includes(p.status));
      const concluidosPrev = pedPrev.filter((p: any) => ["entregue", "finalizado", "pago_cartao"].includes(p.status));
      const receita = concluidos.reduce((s: number, p: any) => s + Number(p.valor_total || 0), 0);
      const receitaPrev = concluidosPrev.reduce((s: number, p: any) => s + Number(p.valor_total || 0), 0);
      const pendentes = ped.filter((p: any) => p.status === "pendente").length;
      const emRota = ped.filter((p: any) => p.status === "em_rota").length;
      const entregues = concluidos.length;
      const ticket = concluidos.length ? receita / concluidos.length : 0;
      const ticketPrev = concluidosPrev.length ? receitaPrev / concluidosPrev.length : 0;
      const criticos = (estoque || []).length;

      // Sparkline: receita por dia dentro do período (buckets simples)
      const buckets = Math.max(differenceInCalendarDays(fim, ini) + 1, 1);
      const sparkReceita = new Array(Math.min(buckets, 24)).fill(0);
      const sparkPedidos = new Array(Math.min(buckets, 24)).fill(0);
      concluidos.forEach((p: any) => {
        const d = new Date(p.created_at);
        const idx = periodo === "hoje"
          ? Math.min(Math.floor(d.getHours() / (24 / sparkReceita.length)), sparkReceita.length - 1)
          : Math.min(differenceInCalendarDays(d, ini), sparkReceita.length - 1);
        if (idx >= 0) sparkReceita[idx] += Number(p.valor_total || 0);
      });
      ped.forEach((p: any) => {
        const d = new Date(p.created_at);
        const idx = periodo === "hoje"
          ? Math.min(Math.floor(d.getHours() / (24 / sparkPedidos.length)), sparkPedidos.length - 1)
          : Math.min(differenceInCalendarDays(d, ini), sparkPedidos.length - 1);
        if (idx >= 0) sparkPedidos[idx] += 1;
      });

      return {
        receita, receitaPrev,
        totalPedidos: ped.length, totalPedidosPrev: pedPrev.length,
        pendentes, emRota, entregues,
        clientes: clientesCount ?? 0,
        ticket, ticketPrev,
        criticos,
        sparkReceita, sparkPedidos,
      };
    },
  });

  const trendLabel = periodo === "hoje" ? "vs ontem" : periodo === "semana" ? "vs sem. anterior" : "vs mês anterior";

  const kpis: Array<{
    label: string; value: string; icon: any; tone: KpiTone; sub: string;
    trend?: { value: number; label: string }; sparkline?: number[];
  }> = [
    {
      label: "Receita", value: fmtBRL(data?.receita ?? 0), icon: DollarSign, tone: "success",
      sub: `${data?.entregues ?? 0} concluídos`,
      trend: data ? { value: pctDelta(data.receita, data.receitaPrev), label: trendLabel } : undefined,
      sparkline: data?.sparkReceita,
    },
    {
      label: "Pedidos", value: String(data?.totalPedidos ?? 0), icon: ShoppingCart, tone: "primary",
      sub: `${data?.pendentes ?? 0} pendentes`,
      trend: data ? { value: pctDelta(data.totalPedidos, data.totalPedidosPrev), label: trendLabel } : undefined,
      sparkline: data?.sparkPedidos,
    },
    {
      label: "Em Rota", value: String(data?.emRota ?? 0), icon: Truck, tone: "info",
      sub: `${data?.entregues ?? 0} entregues`,
    },
    {
      label: "Clientes ativos", value: String(data?.clientes ?? 0), icon: Users, tone: "violet",
      sub: "na unidade",
    },
    {
      label: "Ticket Médio", value: fmtBRL(data?.ticket ?? 0), icon: TrendingUp, tone: "accent",
      sub: "por pedido",
      trend: data ? { value: pctDelta(data.ticket, data.ticketPrev), label: trendLabel } : undefined,
    },
    {
      label: "Estoque crítico", value: String(data?.criticos ?? 0), icon: PackageX,
      tone: (data?.criticos ?? 0) > 0 ? "destructive" : "success",
      sub: "abaixo do mínimo",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <TabsList className="h-9">
            <TabsTrigger value="hoje" className="text-xs">Hoje</TabsTrigger>
            <TabsTrigger value="semana" className="text-xs">Semana</TabsTrigger>
            <TabsTrigger value="mes" className="text-xs">Mês</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="[&_[data-shim]]:h-full"><KpiGridSkeleton count={1} /></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 lg:grid-cols-6">
          {kpis.map((k) => (
            <PremiumKpiCard
              key={k.label}
              label={k.label}
              value={k.value}
              icon={k.icon}
              tone={k.tone}
              subtitle={k.sub}
              trend={k.trend}
              sparkline={k.sparkline}
            />
          ))}
        </div>
      )}
    </div>
  );
}

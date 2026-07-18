import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subDays, subWeeks, subMonths, format,
} from "date-fns";
import {
  DollarSign, ShoppingCart, Truck, Users, TrendingUp, PackageX,
  ArrowUpRight, ArrowDownRight, Minus, LucideIcon,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { cn } from "@/lib/utils";

type Periodo = "hoje" | "semana" | "mes";
type Tone = "success" | "primary" | "info" | "violet" | "accent" | "destructive" | "warning";

const toneStyles: Record<Tone, { icon: string; bg: string; ring: string }> = {
  success:     { icon: "text-success",              bg: "bg-success/10",     ring: "ring-success/15" },
  primary:     { icon: "text-primary",              bg: "bg-primary/10",     ring: "ring-primary/15" },
  info:        { icon: "text-info",                 bg: "bg-info/10",        ring: "ring-info/15" },
  violet:      { icon: "text-secondary-foreground", bg: "bg-secondary/60",   ring: "ring-border/60" },
  accent:      { icon: "text-accent-foreground",    bg: "bg-accent/60",      ring: "ring-border/60" },
  destructive: { icon: "text-destructive",          bg: "bg-destructive/10", ring: "ring-destructive/15" },
  warning:     { icon: "text-warning",              bg: "bg-warning/10",     ring: "ring-warning/15" },
};

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

interface CompactKpiProps {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: Tone;
  trend?: { value: number; label?: string };
}

function CompactKpi({ label, value, sub, icon: Icon, tone = "primary", trend }: CompactKpiProps) {
  const t = toneStyles[tone];
  const isPos = trend ? trend.value >= 0 : undefined;
  const TrendIcon = trend ? (trend.value === 0 ? Minus : isPos ? ArrowUpRight : ArrowDownRight) : null;

  return (
    <div className="flex min-w-0 flex-col justify-between rounded-xl border border-border/60 bg-card p-3.5 shadow-[var(--elev-1)] transition-shadow hover:shadow-[var(--elev-2)]">
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset",
          t.bg, t.ring,
        )}>
          <Icon className={cn("h-3.5 w-3.5", t.icon)} strokeWidth={2.2} />
        </span>
      </div>
      <p className="mt-1.5 truncate text-[1.35rem] font-semibold leading-tight tabular-nums text-foreground">
        {value}
      </p>
      <div className="mt-1 flex min-h-[16px] items-center justify-between gap-2">
        {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
        {trend && TrendIcon && (
          <span className={cn(
            "inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold tabular-nums",
            trend.value === 0
              ? "text-muted-foreground"
              : isPos
                ? "text-success"
                : "text-destructive",
          )}>
            <TrendIcon className="h-3 w-3" strokeWidth={2.5} />
            {trend.value === 0 ? "0%" : `${isPos ? "+" : ""}${trend.value.toFixed(0)}%`}
          </span>
        )}
      </div>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="relative h-[104px] overflow-hidden rounded-xl border border-border/60 bg-card shadow-[var(--elev-1)] before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-muted/40 before:to-transparent" />
  );
}

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

      return {
        receita, receitaPrev,
        totalPedidos: ped.length, totalPedidosPrev: pedPrev.length,
        pendentes, emRota, entregues,
        clientes: clientesCount ?? 0,
        ticket, ticketPrev,
        criticos,
      };
    },
  });

  const trendLabel = periodo === "hoje" ? "vs ontem" : periodo === "semana" ? "vs sem." : "vs mês";

  const kpis: CompactKpiProps[] = [
    {
      label: "Receita", value: fmtBRL(data?.receita ?? 0), icon: DollarSign, tone: "success",
      sub: `${data?.entregues ?? 0} concluídos`,
      trend: data ? { value: pctDelta(data.receita, data.receitaPrev), label: trendLabel } : undefined,
    },
    {
      label: "Pedidos", value: String(data?.totalPedidos ?? 0), icon: ShoppingCart, tone: "primary",
      sub: `${data?.pendentes ?? 0} pendentes`,
      trend: data ? { value: pctDelta(data.totalPedidos, data.totalPedidosPrev), label: trendLabel } : undefined,
    },
    {
      label: "Em rota", value: String(data?.emRota ?? 0), icon: Truck, tone: "info",
      sub: `${data?.entregues ?? 0} entregues`,
    },
    {
      label: "Clientes ativos", value: String(data?.clientes ?? 0), icon: Users, tone: "violet",
      sub: "na unidade",
    },
    {
      label: "Ticket médio", value: fmtBRL(data?.ticket ?? 0), icon: TrendingUp, tone: "accent",
      sub: "por pedido",
      trend: data ? { value: pctDelta(data.ticket, data.ticketPrev), label: trendLabel } : undefined,
    },
    {
      label: "Estoque baixo", value: String(data?.criticos ?? 0), icon: PackageX,
      tone: (data?.criticos ?? 0) > 0 ? "destructive" : "success",
      sub: "abaixo do mínimo",
    },
  ];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Indicadores</h3>
        <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <TabsList className="h-8">
            <TabsTrigger value="hoje" className="h-6 px-2.5 text-xs">Hoje</TabsTrigger>
            <TabsTrigger value="semana" className="h-6 px-2.5 text-xs">Semana</TabsTrigger>
            <TabsTrigger value="mes" className="h-6 px-2.5 text-xs">Mês</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2.5 min-[480px]:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 min-[480px]:grid-cols-3 lg:grid-cols-6">
          {kpis.map((k) => <CompactKpi key={k.label} {...k} />)}
        </div>
      )}
    </div>
  );
}

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfDay, endOfDay, format } from "date-fns";
import { DollarSign, TrendingUp, TrendingDown, ShoppingCart, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

type Tone = "success" | "primary" | "danger" | "info" | "warning";

const toneStyles: Record<Tone, { icon: string; bg: string; ring: string }> = {
  success:  { icon: "text-success",     bg: "bg-success/10",     ring: "ring-success/20" },
  primary:  { icon: "text-primary",     bg: "bg-primary/10",     ring: "ring-primary/20" },
  danger:   { icon: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/20" },
  info:     { icon: "text-info",        bg: "bg-info/10",        ring: "ring-info/20" },
  warning:  { icon: "text-warning",     bg: "bg-warning/10",     ring: "ring-warning/20" },
};

function OpCard({
  label, value, sub, icon: Icon, tone = "primary",
}: { label: string; value: string; sub?: string; icon: LucideIcon; tone?: Tone }) {
  const t = toneStyles[tone];
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border/60 bg-card p-3.5 shadow-[var(--elev-1)] transition-shadow hover:shadow-[var(--elev-2)] sm:p-4">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset", t.bg, t.ring)}>
        <Icon className={cn("h-[18px] w-[18px]", t.icon)} strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-lg font-semibold tabular-nums text-foreground sm:text-xl">{value}</p>
        {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export function DashboardFinancialHero() {
  const { unidadeAtual } = useUnidade();

  const { ini, fim } = useMemo(() => {
    const now = new Date();
    return { ini: startOfDay(now), fim: endOfDay(now) };
  }, []);

  const { data } = useQuery({
    queryKey: ["dashboard-hero-financeiro", unidadeAtual?.id],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      const sb = supabase as any;
      const iniISO = format(ini, "yyyy-MM-dd");
      const fimISO = format(fim, "yyyy-MM-dd");

      const [receberQ, pagarQ, pedidosHojeQ] = await Promise.all([
        sb.from("contas_receber")
          .select("valor, valor_recebido, status, data_vencimento")
          .or(`unidade_id.eq.${unidadeAtual!.id},unidade_id.is.null`)
          .in("status", ["pendente", "parcial", "atrasada", "vencida"])
          .lte("data_vencimento", fimISO),
        sb.from("contas_pagar")
          .select("valor, valor_pago, status, data_vencimento")
          .or(`unidade_id.eq.${unidadeAtual!.id},unidade_id.is.null`)
          .in("status", ["pendente", "parcial", "atrasada", "vencida"])
          .lte("data_vencimento", fimISO),
        sb.from("pedidos")
          .select("valor_total, status")
          .or(`unidade_id.eq.${unidadeAtual!.id},unidade_id.is.null`)
          .gte("data_entrega", iniISO)
          .lte("data_entrega", fimISO),
      ]);

      const receber = (receberQ.data || []).reduce(
        (s: number, r: any) => s + (Number(r.valor || 0) - Number(r.valor_recebido || 0)),
        0
      );
      const pagar = (pagarQ.data || []).reduce(
        (s: number, r: any) => s + (Number(r.valor || 0) - Number(r.valor_pago || 0)),
        0
      );
      const pedidos = (pedidosHojeQ.data || []) as any[];
      const receitaHoje = pedidos
        .filter((p) => ["entregue", "finalizado", "pago_cartao"].includes(p.status))
        .reduce((s, p) => s + Number(p.valor_total || 0), 0);
      const pendentes = pedidos.filter((p) => p.status === "pendente").length;
      const emRota = pedidos.filter((p) => p.status === "em_rota").length;

      return { receber, pagar, receitaHoje, pendentes, emRota };
    },
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <OpCard
        label="Receita hoje"
        value={fmtBRL(data?.receitaHoje ?? 0)}
        sub="Pedidos concluídos"
        icon={DollarSign}
        tone="success"
      />
      <OpCard
        label="Pedidos pendentes"
        value={String(data?.pendentes ?? 0)}
        sub="Aguardando"
        icon={ShoppingCart}
        tone="warning"
      />
      <OpCard
        label="Em rota"
        value={String(data?.emRota ?? 0)}
        sub="Entregas em andamento"
        icon={Truck}
        tone="info"
      />
      <OpCard
        label="A receber"
        value={fmtBRL(data?.receber ?? 0)}
        sub="Vencendo até hoje"
        icon={TrendingUp}
        tone="primary"
      />
      <OpCard
        label="A pagar"
        value={fmtBRL(data?.pagar ?? 0)}
        sub="Vencendo até hoje"
        icon={TrendingDown}
        tone="danger"
      />
    </div>
  );
}

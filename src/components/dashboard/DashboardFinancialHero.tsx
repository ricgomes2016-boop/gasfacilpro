import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfDay, endOfDay, format } from "date-fns";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { FinancialHeroCard } from "@/components/ui/financial-hero-card";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

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

      const [receberQ, pagarQ, receitaHojeQ] = await Promise.all([
        sb.from("contas_receber")
          .select("valor, status, vencimento")
          .or(`unidade_id.eq.${unidadeAtual!.id},unidade_id.is.null`)
          .in("status", ["pendente", "parcial", "atrasada", "vencida"])
          .lte("vencimento", fimISO),
        sb.from("contas_pagar")
          .select("valor, status, vencimento")
          .or(`unidade_id.eq.${unidadeAtual!.id},unidade_id.is.null`)
          .in("status", ["pendente", "parcial", "atrasada", "vencida"])
          .lte("vencimento", fimISO),
        sb.from("pedidos")
          .select("valor_total, status")
          .or(`unidade_id.eq.${unidadeAtual!.id},unidade_id.is.null`)
          .gte("data_entrega", iniISO)
          .lte("data_entrega", fimISO),
      ]);

      const receber = (receberQ.data || []).reduce(
        (s: number, r: any) => s + Number(r.valor || 0),
        0
      );
      const pagar = (pagarQ.data || []).reduce(
        (s: number, r: any) => s + Number(r.valor || 0),
        0
      );
      const receitaHoje = (receitaHojeQ.data || [])
        .filter((p: any) => ["entregue", "finalizado", "pago_cartao"].includes(p.status))
        .reduce((s: number, p: any) => s + Number(p.valor_total || 0), 0);

      const totalMov = receber + pagar || 1;
      const saudePct = Math.round((receber / totalMov) * 100);

      return { receber, pagar, receitaHoje, saudePct };
    },
  });

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <FinancialHeroCard
        title="Receita de hoje"
        value={fmtBRL(data?.receitaHoje ?? 0)}
        subtitle="Pedidos concluídos no dia"
        icon={DollarSign}
        color="primary"
        progress={data?.saudePct}
        details={[
          { label: "A receber", value: fmtBRL(data?.receber ?? 0) },
          { label: "A pagar", value: fmtBRL(data?.pagar ?? 0) },
        ]}
      />
      <FinancialHeroCard
        title="Contas a receber"
        value={fmtBRL(data?.receber ?? 0)}
        subtitle="Pendentes até hoje"
        icon={TrendingUp}
        color="success"
      />
      <FinancialHeroCard
        title="Contas a pagar"
        value={fmtBRL(data?.pagar ?? 0)}
        subtitle="Vencendo até hoje"
        icon={TrendingDown}
        color="danger"
      />
    </div>
  );
}

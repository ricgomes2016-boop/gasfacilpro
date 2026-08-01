import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfDay, endOfDay, format } from "date-fns";
import { ArrowRight, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { cn } from "@/lib/utils";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export function DashboardFinancialHero() {
  const { unidadeAtual } = useUnidade();
  const navigate = useNavigate();

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

      return { receber, pagar, receitaHoje };
    },
  });

  const cards = [
    {
      title: "A receber hoje",
      value: fmtBRL(data?.receber ?? 0),
      action: "Ir para contas a receber",
      icon: TrendingUp,
      className: "from-[#66bd67] to-[#4d9f52]",
      path: "/financeiro/receber",
    },
    {
      title: "A pagar hoje",
      value: fmtBRL(data?.pagar ?? 0),
      action: "Ir para contas a pagar",
      icon: TrendingDown,
      className: "from-[#c83c35] to-[#a72d28]",
      path: "/financeiro/pagar",
    },
    {
      title: "Fluxo financeiro",
      value: fmtBRL(data?.receitaHoje ?? 0),
      action: "Ir para fluxo de caixa",
      icon: WalletCards,
      className: "from-[#4f68e8] to-[#3041a6]",
      path: "/financeiro/fluxo",
      details: [
        { label: "Recebimentos", value: fmtBRL(data?.receber ?? 0) },
        { label: "Pagamentos", value: fmtBRL(data?.pagar ?? 0) },
      ],
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.title}
            type="button"
            onClick={() => navigate(card.path)}
            style={{ color: "#fff" }}
            className={cn(
              "group relative min-h-[210px] overflow-hidden rounded-2xl bg-gradient-to-br p-6 text-left !text-white shadow-[0_18px_42px_-24px_rgba(15,23,42,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_48px_-22px_rgba(15,23,42,0.58)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:min-h-[230px]",
              card.className
            )}
          >
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/10" />
            <div className="absolute -bottom-16 left-8 h-32 w-32 rounded-full bg-white/5" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/18 !text-white backdrop-blur-sm">
                  <Icon className="h-6 w-6 !text-white" strokeWidth={2.3} />
                </span>
                <ArrowRight className="mt-3 h-5 w-5 !text-white opacity-70 transition-transform group-hover:translate-x-1" />
              </div>

              <div className="mt-6">
                <p className="text-sm font-semibold !text-white opacity-90">{card.title}</p>
                <p className="mt-3 text-4xl font-black leading-none tracking-tight !text-white">
                  {card.value}
                </p>
                {card.details ? (
                  <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                    {card.details.map((detail) => (
                      <div key={detail.label} className="min-w-0">
                        <p className="!text-white opacity-75">{detail.label}</p>
                        <p className="mt-1 truncate font-bold !text-white">{detail.value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-5 inline-flex items-center gap-2 text-sm font-medium !text-white opacity-85">
                    {card.action}
                    <ArrowRight className="h-4 w-4 !text-white" />
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

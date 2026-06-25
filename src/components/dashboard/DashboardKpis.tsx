import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
import { DollarSign, ShoppingCart, Truck, Users, TrendingUp, PackageX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

type Periodo = "hoje" | "semana" | "mes";

function getRange(p: Periodo) {
  const now = new Date();
  if (p === "hoje") return { ini: startOfDay(now), fim: endOfDay(now) };
  if (p === "semana") return { ini: startOfWeek(now, { weekStartsOn: 1 }), fim: endOfWeek(now, { weekStartsOn: 1 }) };
  return { ini: startOfMonth(now), fim: endOfMonth(now) };
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const tones: Array<"violet" | "blue" | "amber" | "green" | "sky" | "red"> = [
  "violet", "blue", "amber", "green", "sky", "red",
];

export function DashboardKpis() {
  const { unidadeAtual } = useUnidade();
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const { ini, fim } = useMemo(() => getRange(periodo), [periodo]);

  const { data } = useQuery({
    queryKey: ["dashboard-kpis", unidadeAtual?.id, periodo],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      const iniISO = format(ini, "yyyy-MM-dd");
      const fimISO = format(fim, "yyyy-MM-dd");
      const sb = supabase as any;

      const pedidosQ = sb
        .from("pedidos")
        .select("id, status, valor_total, data_entrega, created_at")
        .or(`unidade_id.eq.${unidadeAtual!.id},unidade_id.is.null`)
        .gte("data_entrega", iniISO)
        .lte("data_entrega", fimISO);

      const clientesUnQ = sb
        .from("cliente_unidades")
        .select("cliente_id", { count: "exact", head: true })
        .eq("unidade_id", unidadeAtual!.id);

      const estoqueQ = sb
        .from("vw_previsao_ruptura")
        .select("id, situacao")
        .eq("unidade_id", unidadeAtual!.id)
        .neq("situacao", "ok");

      const [{ data: pedidos }, { count: clientesCount }, { data: estoque }] = await Promise.all([
        pedidosQ, clientesUnQ, estoqueQ,
      ]);

      const ped = pedidos || [];
      const concluidos = ped.filter((p: any) => ["entregue", "finalizado", "pago_cartao"].includes(p.status));
      const receita = concluidos.reduce((s: number, p: any) => s + Number(p.valor_total || 0), 0);
      const pendentes = ped.filter((p: any) => p.status === "pendente").length;
      const emRota = ped.filter((p: any) => p.status === "em_rota").length;
      const entregues = concluidos.length;
      const ticket = concluidos.length ? receita / concluidos.length : 0;
      const criticos = (estoque || []).length;

      return {
        receita,
        totalPedidos: ped.length,
        pendentes,
        emRota,
        entregues,
        clientes: clientesCount ?? 0,
        ticket,
        criticos,
      };
    },
  });

  const kpis = [
    { label: "Receita", value: fmtBRL(data?.receita ?? 0), icon: DollarSign, sub: `${data?.entregues ?? 0} concluídos` },
    { label: "Pedidos", value: String(data?.totalPedidos ?? 0), icon: ShoppingCart, sub: `${data?.pendentes ?? 0} pendentes` },
    { label: "Em Rota", value: String(data?.emRota ?? 0), icon: Truck, sub: `${data?.entregues ?? 0} entregues` },
    { label: "Clientes ativos", value: String(data?.clientes ?? 0), icon: Users, sub: "na unidade" },
    { label: "Ticket Médio", value: fmtBRL(data?.ticket ?? 0), icon: TrendingUp, sub: "por pedido" },
    { label: "Estoque crítico", value: String(data?.criticos ?? 0), icon: PackageX, sub: "produtos abaixo do mínimo" },
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

      <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} variant="kpi" tone={tones[i % tones.length]} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {k.label}
                  </p>
                  <p className="mt-1 truncate text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-[1.35rem]">
                    {k.value}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{k.sub}</p>
                </div>
                <div className="kpi-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

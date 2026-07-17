import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Truck, MapPin, Clock, Package, TrendingUp, Route } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { DashboardHero } from "@/components/dashboard/premium/DashboardHero";
import { PremiumKpiCard } from "@/components/dashboard/premium/PremiumKpiCard";
import { ChartTooltip } from "@/components/dashboard/premium/ChartTooltip";
import { KpiCardSkeleton, ChartCardSkeleton } from "@/components/dashboard/premium/skeletons";
import { chartGridProps, chartAxisTick, CHART_SEMANTIC } from "@/components/dashboard/premium/chartTheme";

export default function DashboardLogistico() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [entregasHoje, setEntregasHoje] = useState(0);
  const [emRota, setEmRota] = useState(0);
  const [taxaSucesso, setTaxaSucesso] = useState(0);
  const [entregadores, setEntregadores] = useState<any[]>([]);
  const [entregasPorBairro, setEntregasPorBairro] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, [unidadeAtual]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const hojeInicio = new Date();
      hojeInicio.setHours(0, 0, 0, 0);

      let pq = supabase.from("pedidos").select("status, entregador_id, endereco_entrega").gte("created_at", hojeInicio.toISOString());
      if (unidadeAtual?.id) pq = pq.eq("unidade_id", unidadeAtual.id);
      const { data: pedidosHoje } = await pq;

      setEntregasHoje(pedidosHoje?.length || 0);
      const entregues = pedidosHoje?.filter(p => p.status === "entregue").length || 0;
      const total = pedidosHoje?.length || 1;
      setTaxaSucesso((entregues / total) * 100);

      let entQ = supabase.from("entregadores").select("id, nome, status").eq("ativo", true);
      if (unidadeAtual?.id) entQ = entQ.eq("unidade_id", unidadeAtual.id);
      const { data: entregs } = await entQ;
      const emRotaCount = entregs?.filter(e => e.status === "em_rota").length || 0;
      setEmRota(emRotaCount);

      const entregadoresComEntregas = (entregs || []).map(e => ({
        ...e,
        entregas: pedidosHoje?.filter(p => p.entregador_id === e.id).length || 0,
      })).filter(e => e.entregas > 0 || e.status === "em_rota").slice(0, 5);
      setEntregadores(entregadoresComEntregas);

      const mesInicio = new Date();
      mesInicio.setDate(1);
      mesInicio.setHours(0, 0, 0, 0);

      let cq = supabase.from("pedidos").select("cliente_id, clientes(bairro)").gte("created_at", mesInicio.toISOString()).eq("status", "entregue");
      if (unidadeAtual?.id) cq = cq.eq("unidade_id", unidadeAtual.id);
      const { data: pedidosClientes } = await cq;

      const bairroMap: Record<string, number> = {};
      pedidosClientes?.forEach((p: any) => {
        const bairro = p.clientes?.bairro || "Outros";
        bairroMap[bairro] = (bairroMap[bairro] || 0) + 1;
      });
      setEntregasPorBairro(
        Object.entries(bairroMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([bairro, entregas]) => ({ bairro, entregas }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="p-3 sm:p-4 md:p-6 space-y-5 md:space-y-6">
        <DashboardHero
          eyebrow="Operação"
          icon={Truck}
          title="Dashboard Logístico"
          description="Monitore entregas, rotas e produtividade da frota em tempo real."
        />

        {loading ? (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCardSkeleton />
              <ChartCardSkeleton />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <PremiumKpiCard label="Entregas Hoje" value={String(entregasHoje)} icon={Package} tone="primary" />
              <PremiumKpiCard label="Tempo Médio" value="—" icon={Clock} tone="info" subtitle="min por entrega" />
              <PremiumKpiCard label="Taxa Sucesso" value={`${taxaSucesso.toFixed(0)}%`} icon={TrendingUp} tone="success" />
              <PremiumKpiCard label="Em Rota" value={String(emRota)} icon={Route} tone="warning" subtitle="entregadores ativos" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-[var(--radius)] border border-border/60 bg-card p-5 shadow-[var(--elev-2)]">
                <div className="mb-4 flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold">Status dos Entregadores</h3>
                </div>
                {entregadores.length === 0 ? (
                  <EmptyState
                    compact
                    icon={Truck}
                    title="Nenhum entregador ativo hoje"
                    description="Quando houver entregas ou rotas em andamento, os entregadores aparecerão aqui."
                  />
                ) : (
                  <div className="space-y-3">
                    {entregadores.map((e) => (
                      <div key={e.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/40">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                            <Truck className="h-4 w-4 text-primary" />
                          </div>
                          <p className="font-medium truncate">{e.nome}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge variant={e.status === "em_rota" ? "default" : "secondary"}>
                            {e.status === "em_rota" ? "Em Rota" : "Disponível"}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1 tabular-nums">{e.entregas} entregas</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-[var(--radius)] border border-border/60 bg-card p-5 shadow-[var(--elev-2)]">
                <div className="mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-info" />
                  <h3 className="text-base font-semibold">Entregas por Bairro</h3>
                </div>
                {entregasPorBairro.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={entregasPorBairro} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                      <CartesianGrid {...chartGridProps} vertical horizontal={false} />
                      <XAxis type="number" tick={chartAxisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis dataKey="bairro" type="category" width={92} tick={chartAxisTick} axisLine={false} tickLine={false} tickMargin={8} />
                      <Tooltip content={<ChartTooltip formatter={(v) => `${v} entregas`} />} cursor={{ fill: "hsl(var(--info) / 0.08)" }} />
                      <Bar dataKey="entregas" fill={CHART_SEMANTIC.info} radius={[0, 8, 8, 0]} barSize={18} name="Entregas" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    compact
                    icon={MapPin}
                    title="Sem entregas por bairro"
                    description="As entregas concluídas do mês formarão este ranking por região."
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}

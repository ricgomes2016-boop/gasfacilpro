import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSectionLoader } from "@/components/ui/page-loader";
import { Truck, MapPin, Clock, Package, TrendingUp, Route } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { KpiCard, SectionCard } from "@/components/shared";


export default function LogisticoContent() {
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
      const hojeInicio = new Date(); hojeInicio.setHours(0, 0, 0, 0);
      let pq = supabase.from("pedidos").select("status, entregador_id, endereco_entrega").gte("created_at", hojeInicio.toISOString());
      if (unidadeAtual?.id) pq = pq.eq("unidade_id", unidadeAtual.id);
      const { data: pedidosHoje } = await pq;

      setEntregasHoje(pedidosHoje?.length || 0);
      const entregues = pedidosHoje?.filter(p => p.status === "entregue").length || 0;
      setTaxaSucesso((entregues / (pedidosHoje?.length || 1)) * 100);

      const { data: entregs } = await supabase.from("entregadores").select("id, nome, status").eq("ativo", true);
      setEmRota(entregs?.filter(e => e.status === "em_rota").length || 0);

      const entregadoresComEntregas = (entregs || []).map(e => ({
        ...e, entregas: pedidosHoje?.filter(p => p.entregador_id === e.id).length || 0
      })).filter(e => e.entregas > 0 || e.status === "em_rota").slice(0, 5);
      setEntregadores(entregadoresComEntregas);

      const mesInicio = new Date(); mesInicio.setDate(1); mesInicio.setHours(0, 0, 0, 0);
      let cq = supabase.from("pedidos").select("cliente_id, clientes(bairro)").gte("created_at", mesInicio.toISOString()).eq("status", "entregue");
      if (unidadeAtual?.id) cq = cq.eq("unidade_id", unidadeAtual.id);
      const { data: pedidosClientes } = await cq;
      const bairroMap: Record<string, number> = {};
      pedidosClientes?.forEach((p: any) => { const b = p.clientes?.bairro || "Outros"; bairroMap[b] = (bairroMap[b] || 0) + 1; });
      setEntregasPorBairro(Object.entries(bairroMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([bairro, entregas]) => ({ bairro, entregas })));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return <PageSectionLoader label="Carregando visão logística..." />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={Package} label="Entregas Hoje" value={entregasHoje} tone="primary" />
        <KpiCard icon={Clock} label="Tempo Médio" value="-" tone="info" />
        <KpiCard icon={TrendingUp} label="Taxa Sucesso" value={`${taxaSucesso.toFixed(0)}%`} tone="success" />
        <KpiCard icon={Route} label="Em Rota" value={emRota} tone="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Status dos Entregadores" icon={Truck}>
          <div className="space-y-3">
            {entregadores.length === 0 && (
              <EmptyState
                compact
                icon={Truck}
                title="Nenhum entregador ativo hoje"
                description="Quando houver entregas ou rotas em andamento, os entregadores aparecerão aqui."
              />
            )}
            {entregadores.map((e) => (
              <div key={e.id} className="flex flex-col gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center"><Truck className="h-4 w-4 text-primary" /></div>
                  <p className="font-medium truncate">{e.nome}</p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant={e.status === "em_rota" ? "default" : "secondary"}>{e.status === "em_rota" ? "Em Rota" : "Disponível"}</Badge>
                  <p className="text-xs text-muted-foreground mt-1">{e.entregas} entregas</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Entregas por Bairro" icon={MapPin}>
          {entregasPorBairro.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={entregasPorBairro} layout="vertical" margin={{ top: 10, right: 22, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="4 8" horizontal={false} stroke="hsl(var(--border) / 0.5)" />
                <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="bairro" type="category" width={92} axisLine={false} tickLine={false} tickMargin={8} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--info) / 0.08)" }}
                  contentStyle={{ borderRadius: 12, borderColor: "hsl(var(--border) / 0.55)", boxShadow: "0 18px 45px hsl(var(--foreground) / 0.10)" }}
                  formatter={(value) => [value, "Entregas"]}
                />
                <Bar dataKey="entregas" fill="hsl(var(--info))" radius={[0, 8, 8, 0]} barSize={18} />
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
        </SectionCard>
      </div>
    </div>
  );
}

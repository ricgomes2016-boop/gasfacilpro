import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Truck, MapPin, Clock, Package, TrendingUp, Route, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

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

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-primary/10"><Package className="h-6 w-6 text-primary" /></div><div><p className="text-2xl font-bold">{entregasHoje}</p><p className="text-sm text-muted-foreground">Entregas Hoje</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-chart-2/10"><Clock className="h-6 w-6 text-chart-2" /></div><div><p className="text-2xl font-bold">-</p><p className="text-sm text-muted-foreground">Tempo Médio</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-chart-3/10"><TrendingUp className="h-6 w-6 text-chart-3" /></div><div><p className="text-2xl font-bold">{taxaSucesso.toFixed(0)}%</p><p className="text-sm text-muted-foreground">Taxa Sucesso</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-chart-4/10"><Route className="h-6 w-6 text-chart-4" /></div><div><p className="text-2xl font-bold">{emRota}</p><p className="text-sm text-muted-foreground">Em Rota</p></div></div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" />Status dos Entregadores</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {entregadores.length === 0 && (
                <EmptyState
                  compact
                  icon={Truck}
                  title="Nenhum entregador ativo hoje"
                  description="Quando houver entregas ou rotas em andamento, os entregadores aparecerão aqui."
                />
              )}
              {entregadores.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><Truck className="h-5 w-5 text-primary" /></div>
                    <p className="font-medium">{e.nome}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={e.status === "em_rota" ? "default" : "secondary"}>{e.status === "em_rota" ? "Em Rota" : "Disponível"}</Badge>
                    <p className="text-sm text-muted-foreground mt-1">{e.entregas} entregas</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Entregas por Bairro</CardTitle></CardHeader>
          <CardContent>
            {entregasPorBairro.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={entregasPorBairro} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="bairro" type="category" width={80} /><Tooltip />
                  <Bar dataKey="entregas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

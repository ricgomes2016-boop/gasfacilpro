import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Timer, Trophy, Target, AlertTriangle, Loader2, Plus, Settings2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { getBrasiliaDate, getBrasiliaStartOfDay, getBrasiliaEndOfDay } from "@/lib/utils";

export default function SlaEntregas() {
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("indicadores");
  const [slaDialog, setSlaDialog] = useState(false);
  const [newSla, setNewSla] = useState({ nome: "Padrão", tempo_maximo_minutos: 40 });

  const today = getBrasiliaDate();
  const start30 = subDays(today, 30).toISOString();

  const { data: slaConfig = [] } = useQuery({
    queryKey: ["sla_config", empresa?.id],
    enabled: !!empresa?.id,
    queryFn: async () => {
      const { data } = await supabase.from("sla_config").select("*").eq("empresa_id", empresa!.id).eq("ativo", true);
      return data || [];
    },
  });

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["sla_pedidos", unidadeAtual?.id],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      let q = supabase.from("pedidos").select("id, status, created_at, updated_at, entregador_id, tempo_entrega_minutos, sla_cumprido, sla_minutos, entregadores(nome)").in("status", ["entregue", "finalizado"]).gte("created_at", start30);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      q = q.order("created_at", { ascending: false });
      const { data } = await q;
      return data || [];
    },
  });

  const slaMinutos = slaConfig[0]?.tempo_maximo_minutos || 40;

  // Compute metrics
  const pedidosComTempo = pedidos.filter((p: any) => p.tempo_entrega_minutos !== null);
  const totalEntregas = pedidosComTempo.length;
  const dentroDeSla = pedidosComTempo.filter((p: any) => (p.tempo_entrega_minutos || 0) <= slaMinutos).length;
  const taxaPontualidade = totalEntregas > 0 ? Math.round((dentroDeSla / totalEntregas) * 100) : 0;
  const tempoMedio = totalEntregas > 0 ? Math.round(pedidosComTempo.reduce((s: number, p: any) => s + (p.tempo_entrega_minutos || 0), 0) / totalEntregas) : 0;

  // Ranking por entregador
  const entregadorMap = new Map<string, { nome: string; total: number; dentroSla: number; tempoTotal: number }>();
  pedidosComTempo.forEach((p: any) => {
    if (!p.entregador_id) return;
    const key = p.entregador_id;
    const existing = entregadorMap.get(key) || { nome: (p.entregadores as any)?.nome || "Sem nome", total: 0, dentroSla: 0, tempoTotal: 0 };
    existing.total++;
    if ((p.tempo_entrega_minutos || 0) <= slaMinutos) existing.dentroSla++;
    existing.tempoTotal += (p.tempo_entrega_minutos || 0);
    entregadorMap.set(key, existing);
  });
  const ranking = Array.from(entregadorMap.entries()).map(([id, data]) => ({
    id,
    ...data,
    taxa: Math.round((data.dentroSla / data.total) * 100),
    tempoMedio: Math.round(data.tempoTotal / data.total),
  })).sort((a, b) => b.taxa - a.taxa || a.tempoMedio - b.tempoMedio);

  const criarSla = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sla_config").insert({ empresa_id: empresa!.id, unidade_id: unidadeAtual?.id, ...newSla });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sla_config"] }); setSlaDialog(false); toast.success("SLA configurado!"); },
  });

  return (
    <MainLayout>
      <Header title="SLA de Entregas" subtitle="Indicadores de performance e pontualidade" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-primary">{slaMinutos}min</p><p className="text-xs text-muted-foreground">SLA Contratual</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className={`text-2xl font-bold ${taxaPontualidade >= 80 ? "text-green-600" : taxaPontualidade >= 60 ? "text-chart-4" : "text-destructive"}`}>{taxaPontualidade}%</p><p className="text-xs text-muted-foreground">Pontualidade</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className={`text-2xl font-bold ${tempoMedio <= slaMinutos ? "text-green-600" : "text-destructive"}`}>{tempoMedio}min</p><p className="text-xs text-muted-foreground">Tempo Médio</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold">{totalEntregas}</p><p className="text-xs text-muted-foreground">Entregas (30d)</p></CardContent></Card>
        </div>

        {taxaPontualidade < 70 && totalEntregas > 5 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm font-medium">Pontualidade abaixo de 70%! Avalie regiões de entrega e capacidade da equipe.</p>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList>
              <TabsTrigger value="indicadores"><Timer className="h-4 w-4 mr-1" />Indicadores</TabsTrigger>
              <TabsTrigger value="ranking"><Trophy className="h-4 w-4 mr-1" />Ranking</TabsTrigger>
              <TabsTrigger value="config"><Settings2 className="h-4 w-4 mr-1" />Configuração</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="indicadores">
            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Pedido</TableHead><TableHead>Entregador</TableHead><TableHead>Tempo</TableHead><TableHead>SLA</TableHead><TableHead>Data</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {pedidosComTempo.slice(0, 50).map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.id.slice(0, 8)}</TableCell>
                        <TableCell>{(p.entregadores as any)?.nome || "-"}</TableCell>
                        <TableCell className={`font-semibold ${(p.tempo_entrega_minutos || 0) <= slaMinutos ? "text-green-600" : "text-destructive"}`}>{p.tempo_entrega_minutos}min</TableCell>
                        <TableCell>{(p.tempo_entrega_minutos || 0) <= slaMinutos ? <Badge variant="secondary" className="bg-green-100 text-green-700">✓ No prazo</Badge> : <Badge variant="destructive">✗ Atrasado</Badge>}</TableCell>
                        <TableCell className="text-sm">{format(new Date(p.created_at), "dd/MM/yy HH:mm")}</TableCell>
                      </TableRow>
                    ))}
                    {pedidosComTempo.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma entrega com tempo registrado nos últimos 30 dias.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="ranking">
            <Card><CardHeader><CardTitle className="text-base">Ranking de Entregadores (30 dias)</CardTitle></CardHeader><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Entregador</TableHead><TableHead>Entregas</TableHead><TableHead>Pontualidade</TableHead><TableHead>Tempo Médio</TableHead></TableRow></TableHeader>
                <TableBody>
                  {ranking.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-bold">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</TableCell>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell>{r.total}</TableCell>
                      <TableCell><Badge variant={r.taxa >= 80 ? "secondary" : r.taxa >= 60 ? "default" : "destructive"} className={r.taxa >= 80 ? "bg-green-100 text-green-700" : ""}>{r.taxa}%</Badge></TableCell>
                      <TableCell className={r.tempoMedio <= slaMinutos ? "text-green-600" : "text-destructive"}>{r.tempoMedio}min</TableCell>
                    </TableRow>
                  ))}
                  {ranking.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem dados suficientes.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="config">
            <Card><CardHeader><CardTitle className="text-base flex items-center justify-between">Configuração de SLA<Button size="sm" onClick={() => setSlaDialog(true)}><Plus className="h-4 w-4 mr-1" />Novo SLA</Button></CardTitle></CardHeader>
              <CardContent>
                {slaConfig.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhum SLA configurado. O padrão de 40 minutos está sendo usado.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Tempo Máximo</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>{slaConfig.map((s: any) => (
                      <TableRow key={s.id}><TableCell>{s.nome}</TableCell><TableCell className="font-semibold">{s.tempo_maximo_minutos} min</TableCell><TableCell><Badge variant="secondary">Ativo</Badge></TableCell></TableRow>
                    ))}</TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={slaDialog} onOpenChange={setSlaDialog}>
          <DialogContent><DialogHeader><DialogTitle>Configurar SLA</DialogTitle><DialogDescription>Defina o tempo máximo de entrega contratual.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={newSla.nome} onChange={(e) => setNewSla(p => ({ ...p, nome: e.target.value }))} /></div>
              <div><Label>Tempo Máximo (minutos)</Label><Input type="number" value={newSla.tempo_maximo_minutos} onChange={(e) => setNewSla(p => ({ ...p, tempo_maximo_minutos: Number(e.target.value) }))} /></div>
              <Button className="w-full" onClick={() => criarSla.mutate()}>Salvar SLA</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

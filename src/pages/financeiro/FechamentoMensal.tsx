import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CalendarDays, Lock, Unlock, CheckCircle, Clock, Loader2, Plus, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { format } from "date-fns";

const CHECKLIST_PADRAO = [
  { item: "Conciliar extrato bancário com movimentações", categoria: "conciliacao" },
  { item: "Conferir saldo de caixa vs sistema", categoria: "conciliacao" },
  { item: "Verificar contas a receber em atraso", categoria: "conferencia" },
  { item: "Conferir contas a pagar pendentes", categoria: "conferencia" },
  { item: "Validar estoque físico vs sistema", categoria: "conferencia" },
  { item: "Provisionar despesas fixas do mês seguinte", categoria: "provisao" },
  { item: "Calcular depreciação de veículos", categoria: "depreciacao" },
  { item: "Revisar comissões e folha de pagamento", categoria: "conferencia" },
  { item: "Gerar balancete de verificação", categoria: "conferencia" },
  { item: "Conferir impostos e obrigações fiscais", categoria: "conferencia" },
];

export default function FechamentoMensal() {
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const queryClient = useQueryClient();
  const [novoDialog, setNovoDialog] = useState(false);
  const [mesRef, setMesRef] = useState(format(new Date(), "yyyy-MM"));

  const { data: fechamentos = [], isLoading } = useQuery({
    queryKey: ["fechamentos", empresa?.id, unidadeAtual?.id],
    enabled: !!empresa?.id,
    queryFn: async () => {
      let q = supabase.from("fechamentos_mensais").select("*").eq("empresa_id", empresa!.id);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      q = q.order("mes_referencia", { ascending: false });
      const { data } = await q;
      return data || [];
    },
  });

  const [selectedFechamento, setSelectedFechamento] = useState<string | null>(null);

  const { data: checklist = [] } = useQuery({
    queryKey: ["fechamento_checklist", selectedFechamento],
    enabled: !!selectedFechamento,
    queryFn: async () => {
      const { data } = await supabase.from("fechamento_checklist").select("*").eq("fechamento_id", selectedFechamento!).order("created_at");
      return data || [];
    },
  });

  const criarFechamento = useMutation({
    mutationFn: async () => {
      const { data: fech, error } = await supabase.from("fechamentos_mensais").insert({
        empresa_id: empresa!.id,
        unidade_id: unidadeAtual?.id || null,
        mes_referencia: mesRef,
        status: "em_fechamento",
      }).select().single();
      if (error) throw error;
      // Insert checklist items
      const items = CHECKLIST_PADRAO.map(c => ({ fechamento_id: fech.id, ...c }));
      const { error: e2 } = await supabase.from("fechamento_checklist").insert(items);
      if (e2) throw e2;
      return fech;
    },
    onSuccess: (fech) => { queryClient.invalidateQueries({ queryKey: ["fechamentos"] }); setNovoDialog(false); setSelectedFechamento(fech.id); toast.success("Fechamento iniciado!"); },
    onError: (e: any) => toast.error(e.message?.includes("duplicate") ? "Já existe um fechamento para este mês." : e.message),
  });

  const marcarItem = useMutation({
    mutationFn: async ({ id, concluido }: { id: string; concluido: boolean }) => {
      const { error } = await supabase.from("fechamento_checklist").update({ concluido, concluido_em: concluido ? new Date().toISOString() : null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fechamento_checklist"] }),
  });

  const fecharPeriodo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fechamentos_mensais").update({ status: "fechado", data_fechamento: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["fechamentos"] }); toast.success("Período fechado! Lançamentos retroativos bloqueados."); },
  });

  const reabrirPeriodo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fechamentos_mensais").update({ status: "em_fechamento", data_fechamento: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["fechamentos"] }); toast.success("Período reaberto."); },
  });

  const concluidos = checklist.filter((c: any) => c.concluido).length;
  const totalChecklist = checklist.length;
  const progresso = totalChecklist > 0 ? Math.round((concluidos / totalChecklist) * 100) : 0;
  const selectedFech = fechamentos.find((f: any) => f.id === selectedFechamento);

  const categoriaLabel: Record<string, string> = { conciliacao: "Conciliação", provisao: "Provisão", depreciacao: "Depreciação", conferencia: "Conferência" };

  return (
    <MainLayout>
      <Header title="Fechamento Mensal" subtitle="Checklist contábil e travamento de período" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2 flex-wrap">
            {fechamentos.slice(0, 6).map((f: any) => (
              <Button key={f.id} variant={selectedFechamento === f.id ? "default" : "outline"} size="sm" onClick={() => setSelectedFechamento(f.id)} className="gap-1.5">
                {f.status === "fechado" ? <Lock className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {f.mes_referencia}
              </Button>
            ))}
          </div>
          <Button size="sm" onClick={() => setNovoDialog(true)}><Plus className="h-4 w-4 mr-1" />Novo Fechamento</Button>
        </div>

        {selectedFech ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Fechamento {selectedFech.mes_referencia}
                    <Badge variant={selectedFech.status === "fechado" ? "destructive" : "default"} className="ml-2">{selectedFech.status === "fechado" ? "🔒 Fechado" : "⏳ Em Fechamento"}</Badge>
                  </CardTitle>
                  {selectedFech.status === "em_fechamento" ? (
                    <Button size="sm" variant="destructive" onClick={() => fecharPeriodo.mutate(selectedFech.id)} disabled={progresso < 100}>
                      <Lock className="h-4 w-4 mr-1" />Fechar Período
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => reabrirPeriodo.mutate(selectedFech.id)}>
                      <Unlock className="h-4 w-4 mr-1" />Reabrir
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${progresso === 100 ? "bg-green-500" : "bg-primary"}`} style={{ width: `${progresso}%` }} />
                  </div>
                  <span className="text-sm font-semibold">{progresso}%</span>
                </div>

                {progresso < 100 && selectedFech.status === "em_fechamento" && (
                  <div className="bg-chart-4/10 border border-chart-4/30 rounded-lg p-3 flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-4 w-4 text-chart-4" />
                    <p className="text-sm">Complete todos os itens antes de fechar o período.</p>
                  </div>
                )}

                <div className="space-y-2">
                  {checklist.map((item: any) => (
                    <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border ${item.concluido ? "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800" : "bg-background"}`}>
                      <Checkbox checked={item.concluido} disabled={selectedFech.status === "fechado"} onCheckedChange={(v) => marcarItem.mutate({ id: item.id, concluido: !!v })} />
                      <div className="flex-1">
                        <p className={`text-sm ${item.concluido ? "line-through text-muted-foreground" : "font-medium"}`}>{item.item}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{categoriaLabel[item.categoria] || item.categoria}</Badge>
                      {item.concluido && item.concluido_em && <span className="text-[10px] text-muted-foreground">{format(new Date(item.concluido_em), "dd/MM HH:mm")}</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : fechamentos.length === 0 ? "Nenhum fechamento iniciado. Clique em 'Novo Fechamento'." : "Selecione um período acima para ver o checklist."}
          </CardContent></Card>
        )}

        <Dialog open={novoDialog} onOpenChange={setNovoDialog}>
          <DialogContent><DialogHeader><DialogTitle>Iniciar Fechamento Mensal</DialogTitle><DialogDescription>O checklist padrão será criado automaticamente.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <div><Label>Mês de Referência</Label><Input type="month" value={mesRef} onChange={(e) => setMesRef(e.target.value)} /></div>
              <Button className="w-full" onClick={() => criarFechamento.mutate()}>Iniciar Fechamento</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

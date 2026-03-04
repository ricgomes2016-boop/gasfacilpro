import { MainLayout } from "@/components/layout/MainLayout";
import { parseLocalDate } from "@/lib/utils";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { UserPlus, UserMinus, Plus, CheckCircle, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { useState } from "react";

const ITENS_ADMISSAO = [
  "Documentos pessoais coletados", "Contrato de trabalho assinado", "Exame admissional realizado",
  "Cadastro no sistema", "Uniforme entregue", "Treinamento inicial", "Acesso ao sistema criado",
  "Apresentação à equipe", "Manual do funcionário entregue",
];

const ITENS_DESLIGAMENTO = [
  "Notificação formal entregue", "Exame demissional agendado", "Cálculo rescisório realizado",
  "Uniforme devolvido", "Acesso ao sistema revogado", "Chaves/equipamentos devolvidos",
  "Entrevista de desligamento", "Documentos rescisórios assinados", "FGTS/seguro desemprego processado",
];

export default function OnboardingOffboarding() {
  const queryClient = useQueryClient();
  const { unidadeAtual } = useUnidade();
  const [showNovo, setShowNovo] = useState(false);
  const [novoTipo, setNovoTipo] = useState<"admissao" | "desligamento">("admissao");
  const [novoFuncId, setNovoFuncId] = useState("");

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["onboarding-funcionarios", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase.from("funcionarios").select("id, nome").order("nome");
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: checklists = [], isLoading } = useQuery({
    queryKey: ["onboarding-checklists", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("onboarding_checklists")
        .select("*, funcionarios(nome), onboarding_itens(*)")
        .order("created_at", { ascending: false });
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const criarChecklist = useMutation({
    mutationFn: async () => {
      const { data: checklist, error } = await supabase.from("onboarding_checklists").insert({
        funcionario_id: novoFuncId,
        tipo: novoTipo,
        unidade_id: unidadeAtual?.id || null,
      }).select().single();
      if (error) throw error;

      const itens = (novoTipo === "admissao" ? ITENS_ADMISSAO : ITENS_DESLIGAMENTO).map((desc, i) => ({
        checklist_id: checklist.id,
        descricao: desc,
        ordem: i,
      }));
      const { error: itensError } = await supabase.from("onboarding_itens").insert(itens);
      if (itensError) throw itensError;
    },
    onSuccess: () => {
      toast.success("Checklist criado!");
      queryClient.invalidateQueries({ queryKey: ["onboarding-checklists"] });
      setShowNovo(false);
      setNovoFuncId("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleItem = useMutation({
    mutationFn: async ({ itemId, concluido }: { itemId: string; concluido: boolean }) => {
      const { error } = await supabase.from("onboarding_itens").update({
        concluido,
        data_conclusao: concluido ? new Date().toISOString() : null,
      }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding-checklists"] }),
  });

  const admissoes = checklists.filter((c: any) => c.tipo === "admissao");
  const desligamentos = checklists.filter((c: any) => c.tipo === "desligamento");

  const renderChecklist = (checklist: any) => {
    const itens = (checklist.onboarding_itens || []).sort((a: any, b: any) => a.ordem - b.ordem);
    const concluidos = itens.filter((i: any) => i.concluido).length;
    const total = itens.length;
    const progresso = total > 0 ? (concluidos / total) * 100 : 0;

    return (
      <Card key={checklist.id} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{(checklist as any).funcionarios?.nome || "—"}</CardTitle>
              <p className="text-xs text-muted-foreground">Iniciado em {format(parseLocalDate(checklist.data_inicio), "dd/MM/yyyy")}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{concluidos}/{total}</span>
              <Badge variant={progresso === 100 ? "secondary" : "default"}>
                {progresso === 100 ? "Concluído" : "Em andamento"}
              </Badge>
            </div>
          </div>
          <Progress value={progresso} className="mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {itens.map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 py-1">
                <Checkbox
                  checked={item.concluido}
                  onCheckedChange={(checked) => toggleItem.mutate({ itemId: item.id, concluido: !!checked })}
                />
                <span className={`text-sm ${item.concluido ? "line-through text-muted-foreground" : ""}`}>
                  {item.descricao}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <MainLayout>
      <Header title="Onboarding / Offboarding" subtitle="Checklists de admissão e desligamento" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex justify-end">
          <Button className="gap-2" onClick={() => setShowNovo(true)}>
            <Plus className="h-4 w-4" />Novo Checklist
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Checklists</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{checklists.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Admissões</CardTitle>
              <UserPlus className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-success">{admissoes.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Desligamentos</CardTitle>
              <UserMinus className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-destructive">{desligamentos.length}</div></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="admissao">
          <TabsList>
            <TabsTrigger value="admissao" className="gap-2"><UserPlus className="h-4 w-4" />Admissão</TabsTrigger>
            <TabsTrigger value="desligamento" className="gap-2"><UserMinus className="h-4 w-4" />Desligamento</TabsTrigger>
          </TabsList>
          <TabsContent value="admissao" className="mt-4">
            {isLoading ? <Skeleton className="h-32 w-full" /> : admissoes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum checklist de admissão</p>
            ) : admissoes.map(renderChecklist)}
          </TabsContent>
          <TabsContent value="desligamento" className="mt-4">
            {isLoading ? <Skeleton className="h-32 w-full" /> : desligamentos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum checklist de desligamento</p>
            ) : desligamentos.map(renderChecklist)}
          </TabsContent>
        </Tabs>

        <Dialog open={showNovo} onOpenChange={setShowNovo}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Checklist</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tipo</Label>
                <Select value={novoTipo} onValueChange={(v: any) => setNovoTipo(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admissao">Admissão</SelectItem>
                    <SelectItem value="desligamento">Desligamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Funcionário</Label>
                <Select value={novoFuncId} onValueChange={setNovoFuncId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {funcionarios.map((f: any) => (<SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNovo(false)}>Cancelar</Button>
              <Button onClick={() => criarChecklist.mutate()} disabled={!novoFuncId || criarChecklist.isPending}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

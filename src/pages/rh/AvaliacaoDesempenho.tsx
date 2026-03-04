import { MainLayout } from "@/components/layout/MainLayout";
import { parseLocalDate } from "@/lib/utils";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Star, Plus, TrendingUp, Users } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { useState } from "react";

const CRITERIOS = [
  { key: "pontualidade", label: "Pontualidade" },
  { key: "produtividade", label: "Produtividade" },
  { key: "trabalho_equipe", label: "Trabalho em Equipe" },
  { key: "iniciativa", label: "Iniciativa" },
  { key: "comunicacao", label: "Comunicação" },
];

export default function AvaliacaoDesempenho() {
  const queryClient = useQueryClient();
  const { unidadeAtual } = useUnidade();
  const [showNovo, setShowNovo] = useState(false);
  const [form, setForm] = useState<any>({
    funcionario_id: "", periodo_referencia: format(new Date(), "yyyy-MM"),
    pontualidade: 3, produtividade: 3, trabalho_equipe: 3, iniciativa: 3, comunicacao: 3,
    pontos_fortes: "", pontos_melhorar: "", metas_proximas: "", observacoes: "",
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["avaliacao-funcionarios", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase.from("funcionarios").select("id, nome").eq("ativo", true).order("nome");
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: avaliacoes = [], isLoading } = useQuery({
    queryKey: ["avaliacoes-desempenho", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("avaliacoes_desempenho")
        .select("*, funcionarios(nome)")
        .order("data_avaliacao", { ascending: false });
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const criarAvaliacao = useMutation({
    mutationFn: async () => {
      const nota_geral = (form.pontualidade + form.produtividade + form.trabalho_equipe + form.iniciativa + form.comunicacao) / 5;
      const { error } = await supabase.from("avaliacoes_desempenho").insert({
        funcionario_id: form.funcionario_id,
        periodo_referencia: form.periodo_referencia,
        nota_geral,
        pontualidade: form.pontualidade,
        produtividade: form.produtividade,
        trabalho_equipe: form.trabalho_equipe,
        iniciativa: form.iniciativa,
        comunicacao: form.comunicacao,
        pontos_fortes: form.pontos_fortes,
        pontos_melhorar: form.pontos_melhorar,
        metas_proximas: form.metas_proximas,
        observacoes: form.observacoes,
        status: "finalizada",
        unidade_id: unidadeAtual?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Avaliação salva!");
      queryClient.invalidateQueries({ queryKey: ["avaliacoes-desempenho"] });
      setShowNovo(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const notaColor = (nota: number) => {
    if (nota >= 4) return "text-success";
    if (nota >= 3) return "text-primary";
    if (nota >= 2) return "text-warning";
    return "text-destructive";
  };

  const mediaGeral = avaliacoes.length > 0
    ? (avaliacoes.reduce((a: number, av: any) => a + Number(av.nota_geral), 0) / avaliacoes.length).toFixed(1)
    : "0.0";

  return (
    <MainLayout>
      <Header title="Avaliação de Desempenho" subtitle="Avaliações periódicas dos funcionários" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex justify-end">
          <Button className="gap-2" onClick={() => setShowNovo(true)}>
            <Plus className="h-4 w-4" />Nova Avaliação
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Avaliações</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{avaliacoes.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Média Geral</CardTitle>
              <Star className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className={`text-2xl font-bold ${notaColor(parseFloat(mediaGeral))}`}>{mediaGeral} / 5</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Excelentes (≥4)</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-success">{avaliacoes.filter((a: any) => Number(a.nota_geral) >= 4).length}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Avaliações Realizadas</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : avaliacoes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma avaliação registrada</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-center">Nota</TableHead>
                    {CRITERIOS.map(c => <TableHead key={c.key} className="text-center">{c.label}</TableHead>)}
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {avaliacoes.map((av: any) => (
                    <TableRow key={av.id}>
                      <TableCell className="font-medium">{(av as any).funcionarios?.nome || "—"}</TableCell>
                      <TableCell>{av.periodo_referencia}</TableCell>
                      <TableCell className={`text-center font-bold ${notaColor(Number(av.nota_geral))}`}>
                        {Number(av.nota_geral).toFixed(1)}
                      </TableCell>
                      {CRITERIOS.map(c => (
                        <TableCell key={c.key} className="text-center">{av[c.key]}/5</TableCell>
                      ))}
                      <TableCell>{format(parseLocalDate(av.data_avaliacao), "dd/MM/yyyy")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={showNovo} onOpenChange={setShowNovo}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Avaliação de Desempenho</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <Label>Funcionário</Label>
                <Select value={form.funcionario_id} onValueChange={v => setForm((prev: any) => ({ ...prev, funcionario_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {funcionarios.map((f: any) => (<SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Período de Referência</Label>
                <Input type="month" value={form.periodo_referencia} onChange={e => setForm((prev: any) => ({ ...prev, periodo_referencia: e.target.value }))} />
              </div>
              {CRITERIOS.map(c => (
                <div key={c.key}>
                  <div className="flex justify-between">
                    <Label>{c.label}</Label>
                    <span className="text-sm font-bold">{form[c.key]}/5</span>
                  </div>
                  <Slider min={1} max={5} step={1} value={[form[c.key]]} onValueChange={([v]) => setForm((prev: any) => ({ ...prev, [c.key]: v }))} />
                </div>
              ))}
              <div><Label>Pontos Fortes</Label><Textarea value={form.pontos_fortes} onChange={e => setForm((prev: any) => ({ ...prev, pontos_fortes: e.target.value }))} /></div>
              <div><Label>Pontos a Melhorar</Label><Textarea value={form.pontos_melhorar} onChange={e => setForm((prev: any) => ({ ...prev, pontos_melhorar: e.target.value }))} /></div>
              <div><Label>Metas Próximas</Label><Textarea value={form.metas_proximas} onChange={e => setForm((prev: any) => ({ ...prev, metas_proximas: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNovo(false)}>Cancelar</Button>
              <Button onClick={() => criarAvaliacao.mutate()} disabled={!form.funcionario_id || criarAvaliacao.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

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
import { Switch } from "@/components/ui/switch";
import { FileText, Plus, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { useState } from "react";

const TIPOS = [
  { value: "falta", label: "Falta" },
  { value: "atestado_medico", label: "Atestado Médico" },
  { value: "licenca", label: "Licença" },
  { value: "atraso", label: "Atraso" },
  { value: "suspensao", label: "Suspensão" },
];

export default function AtestadosFaltas() {
  const queryClient = useQueryClient();
  const { unidadeAtual } = useUnidade();
  const [showNovo, setShowNovo] = useState(false);
  const [form, setForm] = useState({
    funcionario_id: "", tipo: "falta", data_inicio: format(new Date(), "yyyy-MM-dd"),
    data_fim: format(new Date(), "yyyy-MM-dd"), dias: "1", motivo: "", abona: false,
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["atestados-funcionarios", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase.from("funcionarios").select("id, nome").eq("ativo", true).order("nome");
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["atestados-faltas", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("atestados_faltas")
        .select("*, funcionarios(nome)")
        .order("data_inicio", { ascending: false });
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const criarRegistro = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("atestados_faltas").insert({
        funcionario_id: form.funcionario_id,
        tipo: form.tipo,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        dias: parseInt(form.dias) || 1,
        motivo: form.motivo,
        abona: form.abona,
        unidade_id: unidadeAtual?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro criado!");
      queryClient.invalidateQueries({ queryKey: ["atestados-faltas"] });
      setShowNovo(false);
      setForm({ funcionario_id: "", tipo: "falta", data_inicio: format(new Date(), "yyyy-MM-dd"), data_fim: format(new Date(), "yyyy-MM-dd"), dias: "1", motivo: "", abona: false });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const tipoBadge = (tipo: string) => {
    const colors: Record<string, string> = {
      falta: "destructive", atestado_medico: "secondary", licenca: "outline",
      atraso: "default", suspensao: "destructive",
    };
    return <Badge variant={(colors[tipo] || "default") as any}>{TIPOS.find(t => t.value === tipo)?.label || tipo}</Badge>;
  };

  const totalFaltas = registros.filter((r: any) => !r.abona).reduce((a: number, r: any) => a + (r.dias || 0), 0);
  const totalAbonadas = registros.filter((r: any) => r.abona).reduce((a: number, r: any) => a + (r.dias || 0), 0);

  return (
    <MainLayout>
      <Header title="Atestados e Faltas" subtitle="Controle de ausências dos funcionários" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex justify-end">
          <Button className="gap-2" onClick={() => setShowNovo(true)}>
            <Plus className="h-4 w-4" />Novo Registro
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Registros</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{registros.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Dias Não Abonados</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-destructive">{totalFaltas}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Dias Abonados</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-success">{totalAbonadas}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Registros</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : registros.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum registro</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead className="text-center">Dias</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-center">Abonado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registros.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{(r as any).funcionarios?.nome || "—"}</TableCell>
                      <TableCell>{tipoBadge(r.tipo)}</TableCell>
                      <TableCell>{format(parseLocalDate(r.data_inicio), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{format(parseLocalDate(r.data_fim), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-center">{r.dias}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.motivo || "—"}</TableCell>
                      <TableCell className="text-center">
                        {r.abona ? <CheckCircle className="h-4 w-4 text-success mx-auto" /> : <XCircle className="h-4 w-4 text-destructive mx-auto" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={showNovo} onOpenChange={setShowNovo}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Registro de Ausência</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Funcionário</Label>
                <Select value={form.funcionario_id} onValueChange={v => setForm(prev => ({ ...prev, funcionario_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {funcionarios.map((f: any) => (<SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(prev => ({ ...prev, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Início</Label><Input type="date" value={form.data_inicio} onChange={e => setForm(prev => ({ ...prev, data_inicio: e.target.value }))} /></div>
                <div><Label>Fim</Label><Input type="date" value={form.data_fim} onChange={e => setForm(prev => ({ ...prev, data_fim: e.target.value }))} /></div>
                <div><Label>Dias</Label><Input type="number" value={form.dias} onChange={e => setForm(prev => ({ ...prev, dias: e.target.value }))} /></div>
              </div>
              <div><Label>Motivo</Label><Textarea value={form.motivo} onChange={e => setForm(prev => ({ ...prev, motivo: e.target.value }))} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={form.abona} onCheckedChange={v => setForm(prev => ({ ...prev, abona: v }))} />
                <Label>Abonado</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNovo(false)}>Cancelar</Button>
              <Button onClick={() => criarRegistro.mutate()} disabled={!form.funcionario_id || criarRegistro.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

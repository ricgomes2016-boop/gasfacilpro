import { useEffect, useState } from "react";
import { parseLocalDate, getBrasiliaDateString } from "@/lib/utils";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ClipboardCheck, Plus, Loader2, CheckCircle2, XCircle, Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";

const ITENS_CHECKLIST = [
  { key: "pneus", label: "Pneus (calibragem e desgaste)" },
  { key: "freios", label: "Freios" },
  { key: "luzes", label: "Luzes (farol, lanterna, seta)" },
  { key: "oleo", label: "Nível de óleo" },
  { key: "agua", label: "Nível de água" },
  { key: "limpeza", label: "Limpeza geral" },
  { key: "documentos", label: "Documentos em dia" },
  { key: "avarias", label: "Sem avarias visíveis" },
];

export default function ChecklistSaida() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [entregadores, setEntregadores] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    veiculo_id: "",
    entregador_id: "",
    pneus: false, freios: false, luzes: false, oleo: false,
    agua: false, limpeza: false, documentos: false, avarias: false,
    observacoes: "",
  });

  useEffect(() => { fetchData(); }, [unidadeAtual?.id]);

  const fetchData = async () => {
    setLoading(true);
    let cq = (supabase as any).from("checklist_saida_veiculo")
      .select("*, veiculos(placa, modelo), entregadores(nome)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (unidadeAtual?.id) cq = cq.eq("unidade_id", unidadeAtual.id);
    const { data: cl } = await cq;
    setChecklists(cl || []);

    const [{ data: v }, { data: e }] = await Promise.all([
      supabase.from("veiculos").select("id, placa, modelo").eq("ativo", true).order("placa"),
      supabase.from("entregadores").select("id, nome").eq("ativo", true).order("nome"),
    ]);
    setVeiculos(v || []);
    setEntregadores(e || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.veiculo_id || !form.entregador_id) {
      toast.error("Selecione veículo e entregador.");
      return;
    }
    setSaving(true);
    const allChecked = ITENS_CHECKLIST.every(i => (form as any)[i.key]);
    try {
      const { error } = await (supabase as any).from("checklist_saida_veiculo").insert({
        veiculo_id: form.veiculo_id,
        entregador_id: form.entregador_id,
        pneus: form.pneus,
        freios: form.freios,
        luzes: form.luzes,
        oleo: form.oleo,
        agua: form.agua,
        limpeza: form.limpeza,
        documentos: form.documentos,
        avarias: form.avarias,
        observacoes: form.observacoes || null,
        aprovado: allChecked,
        unidade_id: unidadeAtual?.id || null,
      });
      if (error) throw error;
      toast.success(allChecked ? "Checklist aprovado!" : "Checklist salvo com pendências.");
      setShowForm(false);
      setForm({ veiculo_id: "", entregador_id: "", pneus: false, freios: false, luzes: false, oleo: false, agua: false, limpeza: false, documentos: false, avarias: false, observacoes: "" });
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const hoje = getBrasiliaDateString();
  const checklistsHoje = checklists.filter(c => c.data === hoje).length;
  const aprovadosHoje = checklists.filter(c => c.data === hoje && c.aprovado).length;

  if (loading) {
    return (
      <MainLayout>
        <Header title="Checklist de Saída" subtitle="Inspeção diária dos veículos" />
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title="Checklist de Saída" subtitle="Inspeção diária dos veículos" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center gap-3">
          <Button className="gap-2" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />Novo Checklist
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Hoje</CardTitle><ClipboardCheck className="h-4 w-4 text-primary" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{checklistsHoje}</div><p className="text-xs text-muted-foreground">inspeções</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Aprovados</CardTitle><CheckCircle2 className="h-4 w-4 text-green-600" /></CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-600">{aprovadosHoje}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Com Pendências</CardTitle><XCircle className="h-4 w-4 text-destructive" /></CardHeader>
            <CardContent><div className="text-2xl font-bold text-destructive">{checklistsHoje - aprovadosHoje}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Histórico de Inspeções</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Entregador</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Itens OK</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checklists.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum checklist registrado</TableCell></TableRow>
                  )}
                  {checklists.map(c => {
                    const itensOk = ITENS_CHECKLIST.filter(i => c[i.key]).length;
                    return (
                      <TableRow key={c.id}>
                        <TableCell>{parseLocalDate(c.data).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="font-medium">{c.veiculos?.placa || "—"}</TableCell>
                        <TableCell>{c.entregadores?.nome || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={c.aprovado ? "default" : "destructive"}>
                            {c.aprovado ? "Aprovado" : "Pendências"}
                          </Badge>
                        </TableCell>
                        <TableCell>{itensOk}/{ITENS_CHECKLIST.length}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setShowView(c)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Novo Checklist Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Inspeção de Saída</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Veículo *</Label>
                <Select value={form.veiculo_id} onValueChange={v => setForm(p => ({ ...p, veiculo_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {veiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.placa} - {v.modelo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Entregador *</Label>
                <Select value={form.entregador_id} onValueChange={v => setForm(p => ({ ...p, entregador_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {entregadores.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 border rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Itens de Inspeção</p>
              {ITENS_CHECKLIST.map(item => (
                <div key={item.key} className="flex items-center gap-3">
                  <Checkbox
                    checked={(form as any)[item.key]}
                    onCheckedChange={(checked) => setForm(p => ({ ...p, [item.key]: !!checked }))}
                  />
                  <Label className="font-normal cursor-pointer">{item.label}</Label>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} placeholder="Descreva problemas encontrados..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Checklist */}
      <Dialog open={!!showView} onOpenChange={(o) => !o && setShowView(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inspeção — {showView?.veiculos?.placa} ({new Date(showView?.data || "").toLocaleDateString("pt-BR")})</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm"><strong>Entregador:</strong> {showView?.entregadores?.nome}</p>
            {ITENS_CHECKLIST.map(item => (
              <div key={item.key} className="flex items-center gap-2">
                {showView?.[item.key] ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm">{item.label}</span>
              </div>
            ))}
            {showView?.observacoes && (
              <div className="mt-3 p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Observações:</p>
                <p className="text-sm">{showView.observacoes}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

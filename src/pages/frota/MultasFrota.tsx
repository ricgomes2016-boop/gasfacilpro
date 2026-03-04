import { useEffect, useState } from "react";
import { getBrasiliaDateString } from "@/lib/utils";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FileWarning, Plus, Search, Loader2, DollarSign, AlertTriangle, CheckCircle2, Edit, Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";

export default function MultasFrota() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [multas, setMultas] = useState<any[]>([]);
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [entregadores, setEntregadores] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    veiculo_id: "", entregador_id: "", data_infracao: getBrasiliaDateString(),
    data_vencimento: "", descricao: "", valor: "", pontos: "0",
    status: "pendente", responsavel: "empresa", observacoes: "",
  });

  useEffect(() => { fetchData(); }, [unidadeAtual?.id]);

  const fetchData = async () => {
    setLoading(true);
    let mq = (supabase as any).from("multas_frota")
      .select("*, veiculos(placa, modelo), entregadores(nome)")
      .order("data_infracao", { ascending: false });
    if (unidadeAtual?.id) mq = mq.eq("unidade_id", unidadeAtual.id);
    const { data } = await mq;
    setMultas(data || []);

    const [{ data: v }, { data: e }] = await Promise.all([
      supabase.from("veiculos").select("id, placa, modelo").eq("ativo", true).order("placa"),
      supabase.from("entregadores").select("id, nome").eq("ativo", true).order("nome"),
    ]);
    setVeiculos(v || []);
    setEntregadores(e || []);
    setLoading(false);
  };

  const filtered = multas.filter(m => {
    const matchBusca = !busca ||
      m.veiculos?.placa?.toLowerCase().includes(busca.toLowerCase()) ||
      m.entregadores?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      m.descricao?.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === "todos" || m.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const pendentes = multas.filter(m => m.status === "pendente");
  const totalValor = pendentes.reduce((s, m) => s + Number(m.valor), 0);
  const totalPontos = multas.reduce((s, m) => s + Number(m.pontos), 0);

  const handleSave = async () => {
    if (!form.veiculo_id || !form.descricao || !form.valor) {
      toast.error("Preencha veículo, descrição e valor.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        veiculo_id: form.veiculo_id,
        entregador_id: form.entregador_id || null,
        data_infracao: form.data_infracao,
        data_vencimento: form.data_vencimento || null,
        descricao: form.descricao,
        valor: Number(form.valor),
        pontos: Number(form.pontos) || 0,
        status: form.status,
        responsavel: form.responsavel,
        observacoes: form.observacoes || null,
        unidade_id: unidadeAtual?.id || null,
      };

      if (editId) {
        const { error } = await (supabase as any).from("multas_frota").update(payload).eq("id", editId);
        if (error) throw error;
        toast.success("Multa atualizada!");
      } else {
        const { error } = await (supabase as any).from("multas_frota").insert(payload);
        if (error) throw error;
        toast.success("Multa registrada!");
      }
      setShowForm(false);
      setEditId(null);
      resetForm();
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => setForm({
    veiculo_id: "", entregador_id: "", data_infracao: getBrasiliaDateString(),
    data_vencimento: "", descricao: "", valor: "", pontos: "0",
    status: "pendente", responsavel: "empresa", observacoes: "",
  });

  const handleEdit = (m: any) => {
    setForm({
      veiculo_id: m.veiculo_id, entregador_id: m.entregador_id || "",
      data_infracao: m.data_infracao, data_vencimento: m.data_vencimento || "",
      descricao: m.descricao, valor: String(m.valor), pontos: String(m.pontos),
      status: m.status, responsavel: m.responsavel, observacoes: m.observacoes || "",
    });
    setEditId(m.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta multa?")) return;
    const { error } = await (supabase as any).from("multas_frota").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Multa excluída!");
    fetchData();
  };

  if (loading) {
    return (
      <MainLayout>
        <Header title="Multas da Frota" subtitle="Registro e controle de infrações" />
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title="Multas da Frota" subtitle="Registro e controle de infrações" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button className="gap-2" onClick={() => { resetForm(); setEditId(null); setShowForm(true); }}>
            <Plus className="h-4 w-4" />Nova Multa
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Pendentes</CardTitle><FileWarning className="h-4 w-4 text-destructive" /></CardHeader>
            <CardContent><div className="text-2xl font-bold text-destructive">{pendentes.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Valor Pendente</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">R$ {totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Total Multas</CardTitle><AlertTriangle className="h-4 w-4 text-yellow-500" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{multas.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Pontos Acumulados</CardTitle><AlertTriangle className="h-4 w-4 text-orange-600" /></CardHeader>
            <CardContent><div className="text-2xl font-bold text-orange-600">{totalPontos}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Registro de Multas</CardTitle>
              <div className="flex items-center gap-3">
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                    <SelectItem value="paga">Pagas</SelectItem>
                    <SelectItem value="contestada">Contestadas</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar..." className="pl-10 w-[180px]" value={busca} onChange={e => setBusca(e.target.value)} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Pontos</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Nenhuma multa encontrada</TableCell></TableRow>
                  )}
                  {filtered.map(m => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Badge variant={m.status === "paga" ? "default" : m.status === "contestada" ? "secondary" : "destructive"}>
                          {m.status === "paga" ? "Paga" : m.status === "contestada" ? "Contestada" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(m.data_infracao).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="font-medium">{m.veiculos?.placa || "—"}</TableCell>
                      <TableCell>{m.entregadores?.nome || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{m.descricao}</TableCell>
                      <TableCell><Badge variant="outline">{m.pontos}pts</Badge></TableCell>
                      <TableCell className="font-medium">R$ {Number(m.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <Badge variant={m.responsavel === "motorista" ? "secondary" : "outline"}>
                          {m.responsavel === "motorista" ? "Motorista" : "Empresa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(m)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditId(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Editar Multa" : "Registrar Multa"}</DialogTitle></DialogHeader>
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
                <Label>Motorista</Label>
                <Select value={form.entregador_id} onValueChange={v => setForm(p => ({ ...p, entregador_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não identificado</SelectItem>
                    {entregadores.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data da Infração *</Label>
                <Input type="date" value={form.data_infracao} onChange={e => setForm(p => ({ ...p, data_infracao: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Input type="date" value={form.data_vencimento} onChange={e => setForm(p => ({ ...p, data_vencimento: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição da Infração *</Label>
              <Input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Excesso de velocidade" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Pontos</Label>
                <Input type="number" value={form.pontos} onChange={e => setForm(p => ({ ...p, pontos: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={form.responsavel} onValueChange={v => setForm(p => ({ ...p, responsavel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="empresa">Empresa</SelectItem>
                    <SelectItem value="motorista">Motorista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="paga">Paga</SelectItem>
                  <SelectItem value="contestada">Contestada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : editId ? "Atualizar" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

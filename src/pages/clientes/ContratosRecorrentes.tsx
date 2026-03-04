import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Plus, Search, Pause, Play, XCircle, Calendar, Package, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ativo: { label: "Ativo", variant: "default" },
  pausado: { label: "Pausado", variant: "outline" },
  cancelado: { label: "Cancelado", variant: "destructive" },
  encerrado: { label: "Encerrado", variant: "secondary" },
};

const freqLabels: Record<string, string> = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  bimestral: "Bimestral",
};

export default function ContratosRecorrentes() {
  const [contratos, setContratos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    cliente_nome: "",
    produto_nome: "",
    quantidade: "1",
    valor_unitario: "",
    frequencia: "semanal",
    dia_preferencial: "",
    observacoes: "",
  });

  const fetchContratos = async () => {
    let query = supabase
      .from("contratos_recorrentes")
      .select("*")
      .order("created_at", { ascending: false });

    if (filtroStatus !== "todos") {
      query = query.eq("status", filtroStatus);
    }

    const { data } = await query;
    setContratos(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchContratos();
  }, [filtroStatus]);

  const handleSubmit = async () => {
    if (!form.cliente_nome || !form.produto_nome || !form.valor_unitario) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    // Find or skip client lookup - use a placeholder for now
    let clienteId: string | null = null;
    const { data: clienteMatch } = await supabase
      .from("clientes")
      .select("id")
      .ilike("nome", `%${form.cliente_nome}%`)
      .limit(1);
    
    if (clienteMatch?.[0]) {
      clienteId = clienteMatch[0].id;
    }

    if (!clienteId) {
      // Create a new client
      const { data: novoCliente } = await supabase
        .from("clientes")
        .insert({ nome: form.cliente_nome })
        .select("id")
        .single();
      clienteId = novoCliente?.id || null;
    }

    if (!clienteId) {
      toast.error("Erro ao vincular cliente");
      return;
    }

    // Calculate proxima_entrega
    const hoje = new Date();
    const dia = form.dia_preferencial ? parseInt(form.dia_preferencial) : hoje.getDate();
    let proximaEntrega = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
    if (proximaEntrega <= hoje) {
      proximaEntrega.setMonth(proximaEntrega.getMonth() + 1);
    }

    const { error } = await supabase.from("contratos_recorrentes").insert({
      cliente_id: clienteId,
      cliente_nome: form.cliente_nome,
      produto_nome: form.produto_nome,
      quantidade: parseInt(form.quantidade) || 1,
      valor_unitario: parseFloat(form.valor_unitario) || 0,
      frequencia: form.frequencia,
      dia_preferencial: form.dia_preferencial ? parseInt(form.dia_preferencial) : null,
      observacoes: form.observacoes || null,
      proxima_entrega: proximaEntrega.toISOString().split("T")[0],
    });

    if (error) {
      toast.error("Erro ao criar contrato");
    } else {
      toast.success("Contrato criado!");
      setDialogOpen(false);
      setForm({ cliente_nome: "", produto_nome: "", quantidade: "1", valor_unitario: "", frequencia: "semanal", dia_preferencial: "", observacoes: "" });
      fetchContratos();
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ativo" ? "pausado" : "ativo";
    await supabase.from("contratos_recorrentes").update({ status: newStatus }).eq("id", id);
    toast.success(newStatus === "ativo" ? "Contrato reativado" : "Contrato pausado");
    fetchContratos();
  };

  const handleCancelar = async (id: string) => {
    await supabase.from("contratos_recorrentes").update({ status: "cancelado" }).eq("id", id);
    toast.success("Contrato cancelado");
    fetchContratos();
  };

  const filtrados = contratos.filter((c) => {
    if (!busca) return true;
    const term = busca.toLowerCase();
    return c.cliente_nome?.toLowerCase().includes(term) || c.produto_nome?.toLowerCase().includes(term);
  });

  const ativos = contratos.filter((c) => c.status === "ativo");
  const receitaMensal = ativos.reduce((s, c) => {
    const mult = c.frequencia === "semanal" ? 4 : c.frequencia === "quinzenal" ? 2 : c.frequencia === "bimestral" ? 0.5 : 1;
    return s + Number(c.valor_unitario) * c.quantidade * mult;
  }, 0);

  return (
    <MainLayout>
      <Header title="Contratos Recorrentes" subtitle="Assinaturas e entregas programadas" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{ativos.length}</p>
                  <p className="text-xs text-muted-foreground">Contratos ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{ativos.reduce((s, c) => s + c.quantidade, 0)}</p>
                  <p className="text-xs text-muted-foreground">Unidades/ciclo</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">R$ {receitaMensal.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Receita recorrente/mês</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente ou produto..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="pausado">Pausados</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1.5"><Plus className="h-4 w-4" />Novo Contrato</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Contrato Recorrente</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Cliente *</Label><Input value={form.cliente_nome} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} /></div>
                <div><Label>Produto *</Label><Input value={form.produto_nome} onChange={(e) => setForm({ ...form, produto_nome: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Quantidade</Label><Input type="number" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} /></div>
                  <div><Label>Valor Unitário *</Label><Input type="number" step="0.01" value={form.valor_unitario} onChange={(e) => setForm({ ...form, valor_unitario: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Frequência</Label>
                    <Select value={form.frequencia} onValueChange={(v) => setForm({ ...form, frequencia: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="quinzenal">Quinzenal</SelectItem>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="bimestral">Bimestral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Dia preferencial</Label><Input type="number" min="1" max="31" value={form.dia_preferencial} onChange={(e) => setForm({ ...form, dia_preferencial: e.target.value })} /></div>
                </div>
                <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
                <Button className="w-full" onClick={handleSubmit}>Criar Contrato</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Próxima</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((c) => {
                  const status = statusConfig[c.status] || statusConfig.ativo;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.cliente_nome}</TableCell>
                      <TableCell>{c.produto_nome}</TableCell>
                      <TableCell className="text-center">{c.quantidade}</TableCell>
                      <TableCell>{freqLabels[c.frequencia]}</TableCell>
                      <TableCell className="text-right">R$ {(Number(c.valor_unitario) * c.quantidade).toFixed(2)}</TableCell>
                      <TableCell>
                        {c.proxima_entrega ? (
                          <div className="flex items-center gap-1 text-xs">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(c.proxima_entrega), "dd/MM", { locale: ptBR })}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        {(c.status === "ativo" || c.status === "pausado") && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => handleToggleStatus(c.id, c.status)}>
                              {c.status === "ativo" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => handleCancelar(c.id)}>
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

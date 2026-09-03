import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { RotateCcw, ArrowLeftRight, DollarSign, Plus, Search, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  pendente: { label: "Pendente", variant: "outline", icon: Clock },
  aprovada: { label: "Aprovada", variant: "default", icon: CheckCircle },
  recusada: { label: "Recusada", variant: "destructive", icon: XCircle },
  concluida: { label: "Concluída", variant: "secondary", icon: CheckCircle },
};

const tipoConfig: Record<string, { label: string; icon: React.ElementType }> = {
  devolucao: { label: "Devolução", icon: RotateCcw },
  troca: { label: "Troca", icon: ArrowLeftRight },
  estorno: { label: "Estorno", icon: DollarSign },
};

export default function Devolucoes() {
  const { unidadeAtual } = useUnidade();
  const [devolucoes, setDevolucoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    cliente_nome: "",
    tipo: "devolucao",
    motivo: "",
    valor_total: "",
    observacoes: "",
  });

  const fetchDevolucoes = async () => {
    let query = supabase
      .from("devolucoes")
      .select("*")
      .order("created_at", { ascending: false });

    if (filtroStatus !== "todos") {
      query = query.eq("status", filtroStatus);
    }

    const { data } = await query;
    setDevolucoes(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDevolucoes();
  }, [filtroStatus]);

  const handleSubmit = async () => {
    if (!form.cliente_nome || !form.motivo) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    if (!unidadeAtual?.id) {
      toast.error("Selecione uma unidade antes de registrar.");
      return;
    }

    const { error } = await supabase.from("devolucoes").insert({
      unidade_id: unidadeAtual.id,
      cliente_nome: form.cliente_nome,
      tipo: form.tipo,
      motivo: form.motivo,
      valor_total: parseFloat(form.valor_total) || 0,
      observacoes: form.observacoes || null,
    });

    if (error) {
      toast.error("Erro ao registrar: " + error.message);
    } else {
      toast.success("Registrado com sucesso");
      setDialogOpen(false);
      setForm({ cliente_nome: "", tipo: "devolucao", motivo: "", valor_total: "", observacoes: "" });
      fetchDevolucoes();
    }
  };

  const handleAprovar = async (id: string) => {
    await supabase.from("devolucoes").update({ status: "aprovada", data_aprovacao: new Date().toISOString() }).eq("id", id);
    toast.success("Aprovada!");
    fetchDevolucoes();
  };

  const handleRecusar = async (id: string) => {
    await supabase.from("devolucoes").update({ status: "recusada" }).eq("id", id);
    toast.success("Recusada");
    fetchDevolucoes();
  };

  const filtradas = devolucoes.filter((d) => {
    if (!busca) return true;
    return d.cliente_nome?.toLowerCase().includes(busca.toLowerCase());
  });

  const stats = {
    pendentes: devolucoes.filter((d) => d.status === "pendente").length,
    valorTotal: devolucoes.filter((d) => d.status !== "recusada").reduce((s, d) => s + Number(d.valor_total), 0),
  };

  return (
    <MainLayout>
      <Header title="Devoluções e Trocas" subtitle="Gestão de devoluções, trocas de produtos e estornos" />
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Stats */}
        <div className="grid gap-3 grid-cols-3">
          <Card>
            <CardContent className="p-3 sm:pt-6 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <RotateCcw className="h-5 w-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold">{devolucoes.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-6 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <Clock className="h-5 w-5 text-warning shrink-0" />
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold">{stats.pendentes}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-6 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <DollarSign className="h-5 w-5 text-destructive shrink-0" />
                <div className="min-w-0">
                  <p className="text-base sm:text-2xl font-bold truncate">R$ {stats.valorTotal.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Valor total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters + Action */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="aprovada">Aprovadas</SelectItem>
              <SelectItem value="recusada">Recusadas</SelectItem>
              <SelectItem value="concluida">Concluídas</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1.5">
                <Plus className="h-4 w-4" />
                Nova Devolução
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Devolução / Troca</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Cliente *</Label>
                  <Input value={form.cliente_nome} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="devolucao">Devolução</SelectItem>
                      <SelectItem value="troca">Troca</SelectItem>
                      <SelectItem value="estorno">Estorno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Motivo *</Label>
                  <Textarea value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
                </div>
                <div>
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
                </div>
                <Button className="w-full" onClick={handleSubmit}>Registrar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0 sm:p-6 sm:pt-4">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : filtradas.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[520px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                      <TableHead className="hidden md:table-cell">Motivo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right w-20">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtradas.map((d) => {
                      const tipo = tipoConfig[d.tipo] || tipoConfig.devolucao;
                      const status = statusConfig[d.status] || statusConfig.pendente;
                      const TipoIcon = tipo.icon;
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="text-xs">
                            {format(new Date(d.created_at), "dd/MM/yy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            <div>{d.cliente_nome}</div>
                            <div className="sm:hidden flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <TipoIcon className="h-3 w-3" />{tipo.label}
                            </div>
                            <div className="md:hidden text-xs text-muted-foreground mt-0.5 max-w-[140px] truncate">{d.motivo}</div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-center gap-1.5 text-sm">
                              <TipoIcon className="h-3.5 w-3.5" />
                              {tipo.label}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell max-w-[180px] truncate text-sm">{d.motivo}</TableCell>
                          <TableCell className="text-right whitespace-nowrap text-sm">R$ {Number(d.valor_total).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant} className="text-xs whitespace-nowrap">{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {d.status === "pendente" && (
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" className="text-success h-7 w-7 p-0" onClick={() => handleAprovar(d.id)}>
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0" onClick={() => handleRecusar(d.id)}>
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

import { useState } from "react";
import { parseLocalDate } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Package, Plus, Users, AlertTriangle, CheckCircle, Search, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Comodatos() {
  const { unidadeAtual } = useUnidade();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const [form, setForm] = useState({
    cliente_id: "",
    produto_id: "",
    quantidade: "1",
    deposito: "0",
    prazo_dias: "90",
    observacoes: "",
  });

  const { data: comodatos = [], isLoading } = useQuery({
    queryKey: ["comodatos", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase
        .from("comodatos")
        .select("*, clientes:cliente_id(nome, telefone), produtos:produto_id(nome)")
        .order("created_at", { ascending: false });
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return (data || []) as any[];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["comodatos-clientes", unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual?.id) return [];
      const { data: cuData } = await supabase.from("cliente_unidades").select("cliente_id").eq("unidade_id", unidadeAtual.id);
      const ids = (cuData || []).map((cu: any) => cu.cliente_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("clientes").select("id, nome").eq("ativo", true).in("id", ids).order("nome").limit(500);
      return data || [];
    },
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["comodatos-produtos", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("produtos").select("id, nome").eq("ativo", true).eq("tipo_botijao", "vazio");
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return data || [];
    },
  });

  const criarComodato = useMutation({
    mutationFn: async () => {
      const prazoDias = parseInt(form.prazo_dias) || 90;
      const { error } = await supabase.from("comodatos").insert({
        cliente_id: form.cliente_id,
        produto_id: form.produto_id,
        quantidade: parseInt(form.quantidade) || 1,
        deposito: parseFloat(form.deposito) || 0,
        prazo_devolucao: format(addDays(new Date(), prazoDias), "yyyy-MM-dd"),
        observacoes: form.observacoes || null,
        unidade_id: unidadeAtual?.id || null,
        status: "ativo",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comodatos"] });
      toast({ title: "Comodato registrado!" });
      setDialogOpen(false);
      setForm({ cliente_id: "", produto_id: "", quantidade: "1", deposito: "0", prazo_dias: "90", observacoes: "" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const devolverComodato = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comodatos").update({
        status: "devolvido",
        data_devolucao: format(new Date(), "yyyy-MM-dd"),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comodatos"] });
      toast({ title: "Comodato devolvido!" });
    },
  });

  const filtrados = comodatos.filter((c: any) => {
    const matchBusca = !filtro || c.clientes?.nome?.toLowerCase().includes(filtro.toLowerCase()) || c.produtos?.nome?.toLowerCase().includes(filtro.toLowerCase());
    const matchStatus = filtroStatus === "todos" || c.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const ativos = comodatos.filter((c: any) => c.status === "ativo");
  const totalQtd = ativos.reduce((s: number, c: any) => s + (c.quantidade || 0), 0);
  const totalDeposito = ativos.reduce((s: number, c: any) => s + (c.deposito || 0), 0);
  const vencidos = ativos.filter((c: any) => c.prazo_devolucao && parseLocalDate(c.prazo_devolucao) < new Date()).length;
  const clientesUnicos = new Set(ativos.map((c: any) => c.cliente_id)).size;

  return (
    <MainLayout>
      <Header title="Comodatos" subtitle="Controle de vasilhames emprestados a clientes" />
      <div className="p-3 sm:p-6 space-y-6">
        {/* KPIs */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="p-3 rounded-lg bg-primary/10"><Package className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Vasilhames Emprestados</p><p className="text-2xl font-bold">{totalQtd}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="p-3 rounded-lg bg-accent"><Users className="h-5 w-5 text-accent-foreground" /></div>
            <div><p className="text-xs text-muted-foreground">Clientes</p><p className="text-2xl font-bold">{clientesUnicos}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="p-3 rounded-lg bg-destructive/10"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">Vencidos</p><p className="text-2xl font-bold text-destructive">{vencidos}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="p-3 rounded-lg bg-green-500/10"><CheckCircle className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-xs text-muted-foreground">Em Depósitos</p><p className="text-xl font-bold">R$ {totalDeposito.toLocaleString("pt-BR")}</p></div>
          </CardContent></Card>
        </div>

        {/* Ações */}
        <div className="flex flex-wrap items-center gap-3">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Comodato</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar Comodato</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Cliente</Label>
                  <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                    <SelectContent>
                      {clientes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Vasilhame</Label>
                  <Select value={form.produto_id} onValueChange={(v) => setForm({ ...form, produto_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o vasilhame" /></SelectTrigger>
                    <SelectContent>
                      {produtos.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-2">
                    <Label>Quantidade</Label>
                    <Input type="number" min="1" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Depósito (R$)</Label>
                    <Input type="number" min="0" value={form.deposito} onChange={(e) => setForm({ ...form, deposito: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Prazo (dias)</Label>
                    <Input type="number" min="1" value={form.prazo_dias} onChange={(e) => setForm({ ...form, prazo_dias: e.target.value })} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Detalhes..." />
                </div>
                <Button onClick={() => criarComodato.mutate()} disabled={!form.cliente_id || !form.produto_id || criarComodato.isPending}>
                  Registrar Comodato
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar cliente ou produto..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="devolvido">Devolvidos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Comodatos ({filtrados.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vasilhame</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-center">Depósito</TableHead>
                    <TableHead>Empréstimo</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum comodato encontrado</TableCell></TableRow>
                  ) : filtrados.map((c: any) => {
                    const vencido = c.status === "ativo" && c.prazo_devolucao && parseLocalDate(c.prazo_devolucao) < new Date();
                    const diasRestantes = c.prazo_devolucao ? differenceInDays(parseLocalDate(c.prazo_devolucao), new Date()) : null;
                    return (
                      <TableRow key={c.id} className={vencido ? "bg-destructive/5" : ""}>
                        <TableCell className="font-medium">{c.clientes?.nome || "—"}</TableCell>
                        <TableCell>{c.produtos?.nome || "—"}</TableCell>
                        <TableCell className="text-center">{c.quantidade}</TableCell>
                        <TableCell className="text-center">R$ {(c.deposito || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-sm">{format(parseLocalDate(c.data_emprestimo), "dd/MM/yy")}</TableCell>
                        <TableCell className="text-sm">
                          {c.prazo_devolucao ? (
                            <span className={vencido ? "text-destructive font-bold" : ""}>
                              {format(parseLocalDate(c.prazo_devolucao), "dd/MM/yy")}
                              {diasRestantes !== null && c.status === "ativo" && (
                                <span className="text-xs ml-1">({diasRestantes > 0 ? `${diasRestantes}d` : `${Math.abs(diasRestantes)}d atrás`})</span>
                              )}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {c.status === "ativo" ? (
                            vencido ? <Badge variant="destructive">Vencido</Badge> : <Badge>Ativo</Badge>
                          ) : (
                            <Badge variant="secondary">Devolvido</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {c.status === "ativo" && (
                            <Button variant="ghost" size="sm" onClick={() => devolverComodato.mutate(c.id)} disabled={devolverComodato.isPending}>
                              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Devolver
                            </Button>
                          )}
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
    </MainLayout>
  );
}

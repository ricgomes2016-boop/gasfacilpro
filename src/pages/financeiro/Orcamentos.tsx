import { useState, useMemo } from "react";
import { parseLocalDate } from "@/lib/utils";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Search, FileText, Trash2, Eye, Copy, ChevronsUpDown, Check,
  DollarSign, Clock, CheckCircle2, TrendingUp, ReceiptText
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", color: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400", icon: <Clock className="h-3 w-3" /> },
  aprovado: { label: "Aprovado", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400", icon: <CheckCircle2 className="h-3 w-3" /> },
  recusado: { label: "Recusado", color: "bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400", icon: <Trash2 className="h-3 w-3" /> },
  convertido: { label: "Convertido", color: "bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400", icon: <TrendingUp className="h-3 w-3" /> },
  vencido: { label: "Vencido", color: "bg-muted text-muted-foreground border-border", icon: <Clock className="h-3 w-3" /> },
};

interface OrcamentoItem {
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  produto_id?: string;
}


export default function Orcamentos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedOrcamento, setSelectedOrcamento] = useState<any>(null);

  // Form state
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteOpen, setClienteOpen] = useState(false);
  const [validade, setValidade] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [desconto, setDesconto] = useState(0);
  const [itens, setItens] = useState<OrcamentoItem[]>([
    { descricao: "", quantidade: 1, preco_unitario: 0, subtotal: 0 },
  ]);
  const [produtoOpenIdx, setProdutoOpenIdx] = useState<number | null>(null);


  // Fetch clientes
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-orcamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, telefone, endereco, bairro, numero")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Fetch produtos
  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-orcamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, preco_venda, ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: orcamentos = [], isLoading } = useQuery({
    queryKey: ["orcamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: viewItens = [] } = useQuery({
    queryKey: ["orcamento-itens", selectedOrcamento?.id],
    queryFn: async () => {
      if (!selectedOrcamento) return [];
      const { data, error } = await supabase
        .from("orcamento_itens")
        .select("*")
        .eq("orcamento_id", selectedOrcamento.id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrcamento,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const valorTotal = itens.reduce((sum, i) => sum + i.subtotal, 0) - desconto;
      const { data: orc, error } = await supabase
        .from("orcamentos")
        .insert({
          cliente_id: clienteId || undefined,
          cliente_nome: clienteNome,
          validade: validade || undefined,
          observacoes,
          desconto,
          valor_total: valorTotal,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;

      const itensToInsert = itens
        .filter((i) => i.descricao.trim())
        .map((i) => ({
          orcamento_id: orc.id,
          descricao: i.descricao,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
          subtotal: i.quantidade * i.preco_unitario,
          produto_id: i.produto_id || undefined,
        }));

      if (itensToInsert.length > 0) {
        const { error: itensError } = await supabase
          .from("orcamento_itens")
          .insert(itensToInsert);
        if (itensError) throw itensError;
      }

      return orc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      toast.success("Orçamento criado com sucesso!");
      resetForm();
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orcamentos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      toast.success("Status atualizado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orcamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      toast.success("Orçamento excluído!");
    },
  });

  const resetForm = () => {
    setClienteId(null);
    setClienteNome("");
    setValidade("");
    setObservacoes("");
    setDesconto(0);
    setItens([{ descricao: "", quantidade: 1, preco_unitario: 0, subtotal: 0 }]);
  };

  const selectCliente = (cliente: any) => {
    setClienteId(cliente.id);
    setClienteNome(cliente.nome || `${cliente.endereco || ""} ${cliente.numero || ""}`.trim());
    setClienteOpen(false);
  };

  const selectProduto = (index: number, produto: any) => {
    const updated = [...itens];
    updated[index] = {
      ...updated[index],
      descricao: produto.nome,
      preco_unitario: Number(produto.preco_venda) || 0,
      produto_id: produto.id,
      subtotal: updated[index].quantidade * (Number(produto.preco_venda) || 0),
    };
    setItens(updated);
    setProdutoOpenIdx(null);
  };

  const updateItem = (index: number, field: keyof OrcamentoItem, value: any) => {
    const updated = [...itens];
    (updated[index] as any)[field] = value;
    updated[index].subtotal = updated[index].quantidade * updated[index].preco_unitario;
    setItens(updated);
  };

  const addItem = () =>
    setItens([...itens, { descricao: "", quantidade: 1, preco_unitario: 0, subtotal: 0 }]);

  const removeItem = (index: number) => {
    if (itens.length > 1) setItens(itens.filter((_, i) => i !== index));
  };

  const totalItens = itens.reduce((s, i) => s + i.subtotal, 0);
  const totalFinal = totalItens - desconto;

  const filtered = orcamentos.filter((o: any) => {
    const matchSearch =
      o.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
      String(o.numero).includes(search);
    const matchStatus = filterStatus === "todos" || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const duplicar = (orc: any) => {
    setClienteId(orc.cliente_id);
    setClienteNome(orc.cliente_nome);
    setObservacoes(orc.observacoes || "");
    setDesconto(orc.desconto || 0);
    setDialogOpen(true);
  };

  // KPI calculations
  const pendentes = orcamentos.filter((o: any) => o.status === "pendente");
  const aprovados = orcamentos.filter((o: any) => o.status === "aprovado");
  const valorPendente = pendentes.reduce((s: number, o: any) => s + Number(o.valor_total || 0), 0);
  const valorAprovado = aprovados.reduce((s: number, o: any) => s + Number(o.valor_total || 0), 0);

  return (
    <MainLayout>
      <Header title="Orçamentos" subtitle="Gestão de propostas comerciais" />
      <div className="space-y-6 pb-8 p-3 md:p-6">
        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <ReceiptText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{orcamentos.length}</p>
                  <p className="text-xs text-muted-foreground">Total Orçamentos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-500/10 p-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendentes.length}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    R$ {valorPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground">Valor Pendente</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-500/10 p-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    R$ {valorAprovado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground">Valor Aprovado</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Actions Bar ── */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-3 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou nº..."
                className="pl-9 bg-card"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(statusConfig).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Orçamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="rounded-lg gradient-primary p-1.5">
                    <ReceiptText className="h-4 w-4 text-white" />
                  </div>
                  Novo Orçamento
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Cliente Search */}
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente *</Label>
                    <Popover open={clienteOpen} onOpenChange={setClienteOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between font-normal mt-1.5">
                          {clienteNome || "Selecionar cliente..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[350px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar cliente..." />
                          <CommandList>
                            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                            <CommandGroup className="max-h-60 overflow-auto">
                              {clientes.map((c: any) => {
                                const label = c.nome || `${c.endereco || ""} ${c.numero || ""}`.trim() || c.telefone || "Sem nome";
                                return (
                                  <CommandItem key={c.id} value={`${c.nome} ${c.telefone} ${c.endereco}`} onSelect={() => selectCliente(c)}>
                                    <Check className={cn("mr-2 h-4 w-4", clienteId === c.id ? "opacity-100" : "opacity-0")} />
                                    <div className="flex flex-col">
                                      <span className="font-medium">{label}</span>
                                      {c.telefone && <span className="text-xs text-muted-foreground">{c.telefone}</span>}
                                      {c.endereco && <span className="text-xs text-muted-foreground">{c.endereco}{c.numero ? `, ${c.numero}` : ""} {c.bairro ? `- ${c.bairro}` : ""}</span>}
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Validade</Label>
                    <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className="mt-1.5" />
                  </div>
                </div>

                {/* Itens */}
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-3 block">Itens do Orçamento</Label>
                  <div className="space-y-2">
                    {itens.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-muted/30 rounded-lg p-2">
                        <div className="col-span-5">
                          <Popover open={produtoOpenIdx === idx} onOpenChange={(o) => setProdutoOpenIdx(o ? idx : null)}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-left h-9 text-sm">
                                <span className="truncate">{item.descricao || "Selecionar produto..."}</span>
                                <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Buscar produto..." />
                                <CommandList>
                                  <CommandEmpty>Nenhum produto.</CommandEmpty>
                                  <CommandGroup className="max-h-48 overflow-auto">
                                    {produtos.map((p: any) => (
                                      <CommandItem key={p.id} value={p.nome} onSelect={() => selectProduto(idx, p)}>
                                        <Check className={cn("mr-2 h-4 w-4", item.produto_id === p.id ? "opacity-100" : "opacity-0")} />
                                        <div className="flex justify-between w-full">
                                          <span>{p.nome}</span>
                                          <span className="text-muted-foreground text-xs">R$ {Number(p.preco_venda).toFixed(2)}</span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="col-span-2">
                          <Input type="number" min={1} placeholder="Qtd" value={item.quantidade} onChange={(e) => updateItem(idx, "quantidade", Number(e.target.value))} className="h-9" />
                        </div>
                        <div className="col-span-2">
                          <Input type="number" min={0} step={0.01} placeholder="Preço" value={item.preco_unitario} onChange={(e) => updateItem(idx, "preco_unitario", Number(e.target.value))} className="h-9" />
                        </div>
                        <div className="col-span-2 text-right text-sm font-semibold pt-2 text-foreground">
                          R$ {item.subtotal.toFixed(2)}
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(idx)} disabled={itens.length === 1}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addItem} className="gap-1 text-xs">
                      <Plus className="h-3 w-3" />Adicionar Item
                    </Button>
                  </div>
                </div>

                {/* Totals */}
                <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Desconto (R$)</Label>
                      <Input type="number" min={0} step={0.01} value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} className="mt-1 bg-white dark:bg-background" />
                    </div>
                    <div className="flex flex-col justify-end">
                      <p className="text-xs text-muted-foreground">Total Final</p>
                      <p className="text-2xl font-bold text-primary">
                        R$ {totalFinal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Observações</Label>
                  <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="mt-1.5" rows={2} />
                </div>

                <Button
                  className="w-full gradient-primary text-primary-foreground shadow-lg gap-2"
                  onClick={() => createMutation.mutate()}
                  disabled={!clienteNome.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? "Salvando..." : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Salvar Orçamento
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* ── Table ── */}
        <Card className="overflow-hidden border-0 shadow-md">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-semibold">Nº</TableHead>
                    <TableHead className="font-semibold">Cliente</TableHead>
                    <TableHead className="font-semibold">Data</TableHead>
                    <TableHead className="font-semibold">Validade</TableHead>
                    <TableHead className="font-semibold">Valor</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                          <span className="text-sm">Carregando orçamentos...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <div className="rounded-full bg-muted p-4">
                            <ReceiptText className="h-8 w-8" />
                          </div>
                          <div>
                            <p className="font-medium">Nenhum orçamento encontrado</p>
                            <p className="text-xs">Crie seu primeiro orçamento clicando no botão acima</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((orc: any) => {
                      const st = statusConfig[orc.status] || statusConfig.pendente;
                      return (
                        <TableRow key={orc.id} className="group hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors">
                          <TableCell className="font-mono text-sm font-semibold text-orange-600 dark:text-orange-400">
                            #{orc.numero}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{orc.cliente_nome}</span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(parseLocalDate(orc.data_emissao), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(parseLocalDate(orc.validade), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">
                              R$ {Number(orc.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Select value={orc.status} onValueChange={(v) => updateStatusMutation.mutate({ id: orc.id, status: v })}>
                              <SelectTrigger className="w-36 h-7 border-0 bg-transparent p-0">
                                <Badge variant="outline" className={cn("gap-1 text-xs", st.color)}>
                                  {st.icon}
                                  {st.label}
                                </Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(statusConfig).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>
                                    <span className="flex items-center gap-1.5">
                                      {v.icon} {v.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedOrcamento(orc); setViewDialogOpen(true); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicar(orc)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (confirm("Excluir orçamento?")) deleteMutation.mutate(orc.id); }}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ── View Dialog ── */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="rounded-lg gradient-primary p-1.5">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                Orçamento #{selectedOrcamento?.numero}
              </DialogTitle>
            </DialogHeader>
            {selectedOrcamento && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</span>
                    <p className="font-medium mt-0.5">{selectedOrcamento.cliente_nome}</p>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Status</span>
                    <div className="mt-0.5">
                      <Badge variant="outline" className={cn("gap-1", statusConfig[selectedOrcamento.status]?.color)}>
                        {statusConfig[selectedOrcamento.status]?.icon}
                        {statusConfig[selectedOrcamento.status]?.label}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Emissão</span>
                    <p className="mt-0.5">{format(parseLocalDate(selectedOrcamento.data_emissao), "dd/MM/yyyy")}</p>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Validade</span>
                    <p className="mt-0.5">{format(parseLocalDate(selectedOrcamento.validade), "dd/MM/yyyy")}</p>
                  </div>
                </div>

                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Unit.</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewItens.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.descricao}</TableCell>
                          <TableCell className="text-right">{item.quantidade}</TableCell>
                          <TableCell className="text-right">R$ {Number(item.preco_unitario).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">R$ {Number(item.subtotal).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 space-y-1">
                  {Number(selectedOrcamento.desconto) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Desconto:</span>
                      <span className="text-destructive font-medium">- R$ {Number(selectedOrcamento.desconto).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total:</span>
                    <span className="text-xl font-bold text-primary">
                      R$ {Number(selectedOrcamento.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {selectedOrcamento.observacoes && (
                  <div className="text-sm rounded-lg bg-muted/50 p-3">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Observações</span>
                    <p className="mt-1">{selectedOrcamento.observacoes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

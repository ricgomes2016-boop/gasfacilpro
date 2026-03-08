import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRightLeft, Plus, Trash2, Loader2, Check, X, Truck, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDateString } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Produto {
  id: string;
  nome: string;
  preco?: number;
  preco_custo?: number;
  estoque: number;
}

interface TransferenciaItem {
  produto_id: string;
  produto_nome: string;
  quantidade: number;
  preco_compra: number;
}

interface Transferencia {
  id: string;
  status: string;
  observacoes: string | null;
  valor_total: number;
  created_at: string;
  data_transferencia: string | null;
  data_envio: string | null;
  data_recebimento: string | null;
  unidade_origem: { id: string; nome: string };
  unidade_destino: { id: string; nome: string };
  itens?: { produto_nome: string; quantidade: number; preco_compra: number }[];
}

export default function TransferenciaEstoque() {
  const { unidades, unidadeAtual } = useUnidade();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [destino, setDestino] = useState("");
  const [obs, setObs] = useState("");
  const [dataTransferencia, setDataTransferencia] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [itens, setItens] = useState<TransferenciaItem[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoSel, setProdutoSel] = useState("");
  const [qtdSel, setQtdSel] = useState(1);

  useEffect(() => {
    fetchTransferencias();
    fetchProdutos();
  }, [unidadeAtual]);

  const fetchProdutos = async () => {
    if (!unidadeAtual) return;
    const { data } = await supabase
      .from("produtos")
      .select("id, nome, preco, preco_custo, estoque")
      .eq("unidade_id", unidadeAtual.id)
      .eq("ativo", true)
      .order("nome");
    setProdutos((data as any[]) || []);
  };

  const fetchTransferencias = async () => {
    setLoading(true);
    try {
      // Single query: transferências + itens + produtos em uma só chamada
      const { data } = await supabase
        .from("transferencias_estoque")
        .select(`
          id, status, observacoes, valor_total, created_at, data_transferencia, data_envio, data_recebimento,
          unidade_origem:unidade_origem_id(id, nome),
          unidade_destino:unidade_destino_id(id, nome),
          itens:transferencia_estoque_itens(produto_id, quantidade, preco_compra, produtos:produto_id(nome))
        `)
        .or(unidadeAtual ? `unidade_origem_id.eq.${unidadeAtual.id},unidade_destino_id.eq.${unidadeAtual.id}` : "")
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) {
        setTransferencias((data as any[]).map(t => ({
          ...t,
          itens: (t.itens || []).map((i: any) => ({
            produto_nome: i.produtos?.nome || "",
            quantidade: i.quantidade,
            preco_compra: i.preco_compra,
          })),
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    const prod = produtos.find((p) => p.id === produtoSel);
    if (!prod) return;
    if (itens.find((i) => i.produto_id === produtoSel)) {
      toast.error("Produto já adicionado");
      return;
    }
    if (qtdSel > prod.estoque) {
      toast.error(`Estoque insuficiente! Disponível: ${prod.estoque}`);
      return;
    }
    if (prod.estoque <= 0) {
      toast.error(`Produto sem estoque disponível`);
      return;
    }
    setItens([...itens, {
      produto_id: prod.id,
      produto_nome: prod.nome,
      quantidade: qtdSel,
      preco_compra: prod.preco_custo ?? prod.preco ?? 0,
    }]);
    setProdutoSel("");
    setQtdSel(1);
  };

  const updateItemPreco = (prodId: string, novoPreco: number) => {
    setItens(itens.map(i => i.produto_id === prodId ? { ...i, preco_compra: novoPreco } : i));
  };

  const removeItem = (prodId: string) => {
    setItens(itens.filter((i) => i.produto_id !== prodId));
  };

  const valorTotal = itens.reduce((s, i) => s + i.quantidade * i.preco_compra, 0);

  const handleSalvar = async () => {
    if (!destino || itens.length === 0 || !unidadeAtual || !user) {
      toast.error("Preencha destino e adicione produtos");
      return;
    }
    setSaving(true);
    try {
      const { data: transf, error } = await supabase
        .from("transferencias_estoque")
        .insert({
          unidade_origem_id: unidadeAtual.id,
          unidade_destino_id: destino,
          solicitante_id: user.id,
          observacoes: obs || null,
          valor_total: valorTotal,
          status: "pendente",
          data_transferencia: format(dataTransferencia, "yyyy-MM-dd"),
        })
        .select("id")
        .single();

      if (error) throw error;

      const itensInsert = itens.map((i) => ({
        transferencia_id: transf.id,
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        preco_compra: i.preco_compra,
      }));

      const { error: iErr } = await supabase
        .from("transferencia_estoque_itens")
        .insert(itensInsert);

      if (iErr) throw iErr;

      toast.success("Transferência criada com sucesso!");
      setDialogOpen(false);
      setItens([]);
      setObs("");
      setDestino("");
      setDataTransferencia(new Date());
      fetchTransferencias();
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar transferência");
    } finally {
      setSaving(false);
    }
  };

  const handleEnviar = async (id: string) => {
    // Mark as em_transito and debit stock from origin
    const transf = transferencias.find((t) => t.id === id);
    if (!transf) return;

    const dataRef = transf.data_transferencia || getBrasiliaDateString();

    const { data: tItens } = await supabase
      .from("transferencia_estoque_itens")
      .select("produto_id, quantidade")
      .eq("transferencia_id", id);

    // Debit stock from origin
    for (const item of tItens || []) {
      const { data: prod } = await supabase
        .from("produtos")
        .select("id, estoque")
        .eq("id", item.produto_id)
        .single();
      if (prod) {
        await supabase.from("produtos").update({ estoque: Math.max(0, prod.estoque - item.quantidade) }).eq("id", prod.id);
        await supabase.from("movimentacoes_estoque").insert({
          produto_id: item.produto_id,
          tipo: "saida",
          quantidade: item.quantidade,
          observacoes: `Transferência para ${transf.unidade_destino.nome}`,
          unidade_id: transf.unidade_origem.id,
          created_at: `${dataRef}T12:00:00.000Z`,
        });
      }
    }

    await supabase.from("transferencias_estoque").update({ status: "em_transito", data_envio: new Date().toISOString() }).eq("id", id);
    toast.success("Transferência enviada!");
    fetchTransferencias();
  };

  const handleReceber = async (id: string) => {
    const transf = transferencias.find((t) => t.id === id);
    if (!transf) return;

    const dataRef = transf.data_transferencia || getBrasiliaDateString();

    const { data: tItens } = await supabase
      .from("transferencia_estoque_itens")
      .select("produto_id, quantidade, preco_compra, produtos:produto_id(nome, unidade_id)")
      .eq("transferencia_id", id);

    // Find or create equivalent products in destination and credit stock
    for (const item of tItens || []) {
      const itemAny = item as any;
      const { data: destProd } = await supabase
        .from("produtos")
        .select("id, estoque")
        .eq("nome", itemAny.produtos?.nome || "")
        .eq("unidade_id", transf.unidade_destino.id)
        .maybeSingle();

      if (destProd) {
        await supabase.from("produtos").update({ estoque: destProd.estoque + item.quantidade }).eq("id", destProd.id);
        await supabase.from("movimentacoes_estoque").insert({
          produto_id: destProd.id,
          tipo: "entrada",
          quantidade: item.quantidade,
          observacoes: `Transferência de ${transf.unidade_origem.nome}`,
          unidade_id: transf.unidade_destino.id,
          created_at: `${dataRef}T12:00:00.000Z`,
        });
      }
    }

    // Generate purchase record for destination
    const { data: compra } = await supabase
      .from("compras")
      .insert({
        fornecedor_id: null,
        unidade_id: transf.unidade_destino.id,
        valor_total: transf.valor_total,
        status: "recebida",
        data_compra: dataRef,
        data_recebimento: new Date().toISOString(),
        observacoes: `Transferência interna de ${transf.unidade_origem.nome}`,
        numero_nota_fiscal: `TRANSF-${id.slice(0, 8).toUpperCase()}`,
      })
      .select("id")
      .single();

    if (compra) {
      for (const item of tItens || []) {
        await supabase.from("compra_itens").insert({
          compra_id: compra.id,
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          preco_unitario: item.preco_compra,
        });
      }

      await supabase.from("contas_pagar").insert({
        fornecedor: transf.unidade_origem.nome,
        descricao: `Transferência de estoque - ${transf.unidade_origem.nome}`,
        valor: transf.valor_total,
        vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "pendente",
        categoria: "Compra de Mercadorias",
        unidade_id: transf.unidade_destino.id,
      });

      await supabase.from("movimentacoes_caixa").insert({
        tipo: "saida",
        descricao: `Compra via transferência - ${transf.unidade_origem.nome}`,
        valor: transf.valor_total,
        categoria: "Compra de Mercadorias",
        unidade_id: transf.unidade_destino.id,
        status: "aprovada",
        created_at: `${dataRef}T12:00:00.000Z`,
      });

      await supabase.from("transferencias_estoque").update({
        status: "recebido",
        data_recebimento: new Date().toISOString(),
        compra_gerada_id: compra.id,
      }).eq("id", id);
    }

    toast.success("Transferência recebida! Compra e conta a pagar geradas.");
    fetchTransferencias();
  };

  const handleCancelar = async (id: string) => {
    await supabase.from("transferencias_estoque").update({ status: "cancelado" }).eq("id", id);
    toast.info("Transferência cancelada");
    fetchTransferencias();
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pendente: { label: "Pendente", className: "bg-yellow-500 text-white" },
      em_transito: { label: "Em Trânsito", className: "bg-blue-500 text-white" },
      recebido: { label: "Recebido", className: "bg-green-600 text-white" },
      cancelado: { label: "Cancelado", className: "bg-destructive text-destructive-foreground" },
    };
    const m = map[s] || { label: s, className: "" };
    return <Badge className={m.className}>{m.label}</Badge>;
  };

  return (
    <MainLayout>
      <Header title="Transferência de Estoque" subtitle="Transferências entre filiais" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-primary/10"><ArrowRightLeft className="h-6 w-6 text-primary" /></div><div><p className="text-2xl font-bold">{transferencias.length}</p><p className="text-sm text-muted-foreground">Total</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-yellow-500/10"><Truck className="h-6 w-6 text-yellow-500" /></div><div><p className="text-2xl font-bold">{transferencias.filter(t => t.status === "pendente").length}</p><p className="text-sm text-muted-foreground">Pendentes</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-blue-500/10"><Truck className="h-6 w-6 text-blue-500" /></div><div><p className="text-2xl font-bold">{transferencias.filter(t => t.status === "em_transito").length}</p><p className="text-sm text-muted-foreground">Em Trânsito</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-green-500/10"><Check className="h-6 w-6 text-green-500" /></div><div><p className="text-2xl font-bold">{transferencias.filter(t => t.status === "recebido").length}</p><p className="text-sm text-muted-foreground">Recebidos</p></div></div></CardContent></Card>
        </div>

        {/* Nova Transferência */}
        <div className="flex justify-end">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Transferência</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nova Transferência de Estoque</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Origem</Label>
                  <Input value={unidadeAtual?.nome || ""} disabled />
                </div>
                <div>
                  <Label>Destino</Label>
                  <Select value={destino} onValueChange={setDestino}>
                    <SelectTrigger><SelectValue placeholder="Selecione a filial destino" /></SelectTrigger>
                    <SelectContent>
                      {unidades.filter(u => u.id !== unidadeAtual?.id).map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Data da Transferência</Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !dataTransferencia && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataTransferencia ? format(dataTransferencia, "dd/MM/yyyy") : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataTransferencia}
                        onSelect={(date) => { if (date) { setDataTransferencia(date); setCalendarOpen(false); } }}
                        locale={ptBR}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="border rounded-lg p-4 space-y-3">
                  <Label className="font-medium">Produtos</Label>
                  <div className="flex gap-2">
                    <Select value={produtoSel} onValueChange={setProdutoSel}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Produto" /></SelectTrigger>
                      <SelectContent>
                        {produtos.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.nome} (est: {p.estoque})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="number" min={1} value={qtdSel} onChange={e => setQtdSel(Number(e.target.value))} className="w-20" placeholder="Qtd" />
                    <Button type="button" size="sm" onClick={addItem}><Plus className="h-4 w-4" /></Button>
                  </div>

                  {itens.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Preço Custo</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itens.map(i => (
                          <TableRow key={i.produto_id}>
                            <TableCell>{i.produto_nome}</TableCell>
                            <TableCell className="text-right">{i.quantidade}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={i.preco_compra}
                                onChange={e => updateItemPreco(i.produto_id, parseFloat(e.target.value) || 0)}
                                className="w-24 text-right ml-auto"
                              />
                            </TableCell>
                            <TableCell className="text-right">R$ {(i.quantidade * i.preco_compra).toFixed(2)}</TableCell>
                            <TableCell><Button variant="ghost" size="icon" onClick={() => removeItem(i.produto_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold">
                          <TableCell colSpan={3}>Total</TableCell>
                          <TableCell className="text-right">R$ {valorTotal.toFixed(2)}</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div>
                  <Label>Observações</Label>
                  <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Notas sobre a transferência..." />
                </div>

                <Button onClick={handleSalvar} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
                  Criar Transferência
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista */}
        <Card>
          <CardHeader><CardTitle>Transferências</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : transferencias.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma transferência registrada</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transferencias.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{t.data_transferencia ? new Date(t.data_transferencia + "T12:00:00").toLocaleDateString("pt-BR") : new Date(t.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{t.unidade_origem?.nome}</TableCell>
                      <TableCell>{t.unidade_destino?.nome}</TableCell>
                      <TableCell className="text-sm">
                        {t.itens?.map(i => `${i.produto_nome} (${i.quantidade})`).join(", ")}
                      </TableCell>
                      <TableCell className="text-right font-medium">R$ {t.valor_total.toFixed(2)}</TableCell>
                      <TableCell>{statusBadge(t.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {t.status === "pendente" && unidadeAtual?.id === t.unidade_origem?.id && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleEnviar(t.id)}>
                                <Truck className="h-3 w-3 mr-1" />Enviar
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleCancelar(t.id)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {t.status === "em_transito" && unidadeAtual?.id === t.unidade_destino?.id && (
                            <Button size="sm" onClick={() => handleReceber(t.id)}>
                              <Check className="h-3 w-3 mr-1" />Receber
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

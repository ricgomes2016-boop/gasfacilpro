import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Banknote, Plus, Wallet, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

export default function VendaAntecipada() {
  const { unidadeAtual } = useUnidade();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    cliente_nome: "", valor_pago: "", forma_pagamento: "dinheiro",
    observacoes: "", data_validade: "",
  });
  const [clienteSearch, setClienteSearch] = useState("");

  const { data: vendas = [], isLoading } = useQuery({
    queryKey: ["vendas-antecipadas", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("vendas_antecipadas")
        .select("*, clientes(nome, telefone)")
        .order("created_at", { ascending: false });
      if (unidadeAtual?.id) query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-search-va", clienteSearch, unidadeAtual?.id],
    queryFn: async () => {
      if (!clienteSearch || clienteSearch.length < 2 || !unidadeAtual?.id) return [];
      const { data: cuData } = await supabase.from("cliente_unidades").select("cliente_id").eq("unidade_id", unidadeAtual.id);
      const ids = (cuData || []).map((cu: any) => cu.cliente_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("clientes").select("id, nome, telefone").eq("ativo", true).in("id", ids).ilike("nome", `%${clienteSearch}%`).limit(5);
      return data || [];
    },
    enabled: clienteSearch.length >= 2,
  });

  const criarVenda = async () => {
    const valor = parseFloat(form.valor_pago.replace(",", "."));
    if (!form.cliente_nome || !valor || valor <= 0) {
      toast.error("Preencha cliente e valor"); return;
    }
    const { error } = await supabase.from("vendas_antecipadas").insert({
      cliente_nome: form.cliente_nome, valor_pago: valor,
      forma_pagamento: form.forma_pagamento,
      observacoes: form.observacoes || null,
      data_validade: form.data_validade || null,
      unidade_id: unidadeAtual?.id || null,
      user_id: user?.id,
    });
    if (error) { toast.error("Erro ao registrar"); console.error(error); return; }
    toast.success("Venda antecipada registrada!");
    setDialogOpen(false);
    setForm({ cliente_nome: "", valor_pago: "", forma_pagamento: "dinheiro", observacoes: "", data_validade: "" });
    queryClient.invalidateQueries({ queryKey: ["vendas-antecipadas"] });
  };

  const utilizarCredito = async (id: string) => {
    const { error } = await supabase.from("vendas_antecipadas").update({ status: "utilizado", valor_utilizado: vendas.find((v: any) => v.id === id)?.valor_pago || 0 }).eq("id", id);
    if (error) { toast.error("Erro ao utilizar crédito"); return; }
    toast.success("Crédito utilizado!");
    queryClient.invalidateQueries({ queryKey: ["vendas-antecipadas"] });
  };

  const saldoAtivo = vendas.filter((v: any) => v.status === "ativo").reduce((a: number, v: any) => a + Number(v.saldo_restante), 0);
  const totalVendido = vendas.reduce((a: number, v: any) => a + Number(v.valor_pago), 0);

  return (
    <MainLayout>
      <Header title="Venda Antecipada" subtitle="Créditos antecipados de clientes" />
      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Saldo Ativo</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-primary">R$ {saldoAtivo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Vendido</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">R$ {totalVendido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Créditos Ativos</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{vendas.filter((v: any) => v.status === "ativo").length}</p></CardContent>
          </Card>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Venda Antecipada</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" />Registrar Venda Antecipada</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Cliente *</Label>
                <Input value={form.cliente_nome} onChange={e => { setForm({ ...form, cliente_nome: e.target.value }); setClienteSearch(e.target.value); }} placeholder="Buscar cliente..." />
                {clientes.length > 0 && (
                  <div className="border rounded-md mt-1 max-h-32 overflow-y-auto">
                    {clientes.map((c: any) => (
                      <button key={c.id} className="w-full text-left px-3 py-2 hover:bg-muted text-sm" onClick={() => { setForm({ ...form, cliente_nome: c.nome }); setClienteSearch(""); }}>
                        {c.nome} {c.telefone && `— ${c.telefone}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor Pago *</Label><Input value={form.valor_pago} onChange={e => setForm({ ...form, valor_pago: e.target.value })} placeholder="0,00" /></div>
                <div><Label>Forma Pagamento</Label>
                  <Select value={form.forma_pagamento} onValueChange={v => setForm({ ...form, forma_pagamento: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cartao_debito">Débito</SelectItem>
                      <SelectItem value="cartao_credito">Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Validade</Label><Input type="date" value={form.data_validade} onChange={e => setForm({ ...form, data_validade: e.target.value })} /></div>
              <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={2} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={criarVenda}>Registrar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? <p className="text-center py-6 text-muted-foreground">Carregando...</p> : vendas.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground">Nenhuma venda antecipada</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor Pago</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendas.map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.cliente_nome}</TableCell>
                      <TableCell>R$ {Number(v.valor_pago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className={`font-bold ${Number(v.saldo_restante) > 0 ? "text-success" : "text-muted-foreground"}`}>
                        R$ {Number(v.saldo_restante).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="capitalize">{v.forma_pagamento.replace("_", " ")}</TableCell>
                      <TableCell className="text-sm">{format(new Date(v.data_venda), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant={v.status === "ativo" ? "default" : v.status === "utilizado" ? "secondary" : "destructive"}>
                          {v.status === "ativo" ? "Ativo" : v.status === "utilizado" ? "Utilizado" : "Cancelado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {v.status === "ativo" && (
                          <Button size="sm" variant="outline" onClick={() => utilizarCredito(v.id)}>Utilizar</Button>
                        )}
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

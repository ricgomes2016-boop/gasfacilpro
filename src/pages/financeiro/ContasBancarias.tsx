import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog as Dialog, ResponsiveDialogContent as DialogContent, ResponsiveDialogHeader as DialogHeader, ResponsiveDialogTitle as DialogTitle, ResponsiveDialogTrigger as DialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ArrowRightLeft, Landmark, Send, FileSpreadsheet, Receipt, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import Conciliacao from "./Conciliacao";
import ExtratoBancario from "@/components/financeiro/ExtratoBancario";

interface ContaBancaria {
  id: string;
  nome: string;
  banco: string;
  agencia: string | null;
  conta: string | null;
  tipo: string;
  saldo_atual: number;
  chave_pix: string | null;
  ativo: boolean;
  unidade_id: string | null;
  unidades?: { nome: string } | null;
}

const emptyForm = { nome: "", banco: "", agencia: "", conta: "", tipo: "corrente", chave_pix: "", unidade_id: "", saldo_inicial: "" };

export default function ContasBancarias() {
  const { unidadeAtual, unidades } = useUnidade();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editForm, setEditForm] = useState<{ id: string } & typeof emptyForm>({ id: "", ...emptyForm });
  const [transferForm, setTransferForm] = useState({ conta_origem_id: "", conta_destino_id: "", valor: "", descricao: "" });

  // Filter by selected unidade
  const { data: contas = [], isLoading } = useQuery({
    queryKey: ["contas-bancarias", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("contas_bancarias")
        .select("*, unidades(nome)")
        .eq("ativo", true)
        .order("nome");

      if (unidadeAtual?.id) {
        query = query.eq("unidade_id", unidadeAtual.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ContaBancaria[];
    },
  });

  const { data: transferencias = [] } = useQuery({
    queryKey: ["transferencias-bancarias", unidadeAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transferencias_bancarias")
        .select("*, conta_origem:contas_bancarias!transferencias_bancarias_conta_origem_id_fkey(id,nome,banco,unidades(nome)), conta_destino:contas_bancarias!transferencias_bancarias_conta_destino_id_fkey(id,nome,banco,unidades(nome))")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const criarConta = async () => {
    if (!form.nome || !form.banco) { toast.error("Nome e banco são obrigatórios"); return; }
    const saldoInicial = parseFloat((form.saldo_inicial || "0").replace(",", ".")) || 0;
    const { error } = await supabase.from("contas_bancarias").insert({
      nome: form.nome, banco: form.banco, agencia: form.agencia || null,
      conta: form.conta || null, tipo: form.tipo, chave_pix: form.chave_pix || null,
      unidade_id: form.unidade_id || unidadeAtual?.id || null,
      saldo_atual: saldoInicial,
    });
    if (error) { toast.error("Erro ao criar conta"); console.error(error); return; }
    toast.success("Conta bancária criada!");
    setDialogOpen(false);
    setForm({ ...emptyForm });
    queryClient.invalidateQueries({ queryKey: ["contas-bancarias"] });
  };

  const editarConta = async () => {
    if (!editForm.nome || !editForm.banco) { toast.error("Nome e banco são obrigatórios"); return; }
    const { error } = await supabase.from("contas_bancarias").update({
      nome: editForm.nome, banco: editForm.banco, agencia: editForm.agencia || null,
      conta: editForm.conta || null, tipo: editForm.tipo, chave_pix: editForm.chave_pix || null,
      unidade_id: editForm.unidade_id || unidadeAtual?.id || null,
      // saldo_atual NÃO é editável diretamente - muda apenas via movimentações
    }).eq("id", editForm.id);
    if (error) { toast.error("Erro ao editar conta"); console.error(error); return; }
    toast.success("Conta atualizada!");
    setEditDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["contas-bancarias"] });
  };

  const abrirEdicao = (c: ContaBancaria) => {
    setEditForm({
      id: c.id,
      nome: c.nome,
      banco: c.banco,
      agencia: c.agencia || "",
      conta: c.conta || "",
      tipo: c.tipo,
      chave_pix: c.chave_pix || "",
      unidade_id: c.unidade_id || "",
      saldo_inicial: Number(c.saldo_atual).toFixed(2).replace(".", ","),
    });
    setEditDialogOpen(true);
  };

  const realizarTransferencia = async () => {
    const valor = parseFloat(transferForm.valor.replace(",", "."));
    if (!transferForm.conta_origem_id || !transferForm.conta_destino_id || !valor || valor <= 0) {
      toast.error("Preencha todos os campos"); return;
    }
    if (transferForm.conta_origem_id === transferForm.conta_destino_id) {
      toast.error("Conta origem e destino devem ser diferentes"); return;
    }

    const { error: transError } = await supabase.from("transferencias_bancarias").insert({
      conta_origem_id: transferForm.conta_origem_id,
      conta_destino_id: transferForm.conta_destino_id,
      valor, descricao: transferForm.descricao || null,
      user_id: user?.id,
    });
    if (transError) { toast.error("Erro na transferência"); console.error(transError); return; }

    const contaOrigem = contas.find(c => c.id === transferForm.conta_origem_id);
    const contaDestino = contas.find(c => c.id === transferForm.conta_destino_id);
    if (contaOrigem) {
      await supabase.from("contas_bancarias").update({ saldo_atual: contaOrigem.saldo_atual - valor }).eq("id", contaOrigem.id);
    }
    if (contaDestino) {
      await supabase.from("contas_bancarias").update({ saldo_atual: contaDestino.saldo_atual + valor }).eq("id", contaDestino.id);
    }

    toast.success("Transferência realizada!");
    setTransferOpen(false);
    setTransferForm({ conta_origem_id: "", conta_destino_id: "", valor: "", descricao: "" });
    queryClient.invalidateQueries({ queryKey: ["contas-bancarias"] });
    queryClient.invalidateQueries({ queryKey: ["transferencias-bancarias"] });
  };

  const tipoLabel = (tipo: string) => {
    const map: Record<string, string> = { corrente: "Conta Corrente", poupanca: "Poupança", caixa_interno: "Caixa Interno" };
    return map[tipo] || tipo;
  };

  const saldoTotal = contas.reduce((acc, c) => acc + Number(c.saldo_atual), 0);

  const renderContaForm = (formData: typeof emptyForm, setFormData: (f: any) => void, onSave: () => void, onCancel: () => void, saveLabel: string) => (
    <div className="space-y-4 pt-2">
      <div><Label>Nome da Conta *</Label><Input value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: Conta Principal Itaú" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Banco *</Label><Input value={formData.banco} onChange={e => setFormData({ ...formData, banco: e.target.value })} placeholder="Itaú, Bradesco..." /></div>
        <div><Label>Tipo</Label>
          <Select value={formData.tipo} onValueChange={v => setFormData({ ...formData, tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="corrente">Conta Corrente</SelectItem>
              <SelectItem value="poupanca">Poupança</SelectItem>
              <SelectItem value="caixa_interno">Caixa Interno</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Agência</Label><Input value={formData.agencia} onChange={e => setFormData({ ...formData, agencia: e.target.value })} /></div>
        <div><Label>Conta</Label><Input value={formData.conta} onChange={e => setFormData({ ...formData, conta: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Chave PIX</Label><Input value={formData.chave_pix} onChange={e => setFormData({ ...formData, chave_pix: e.target.value })} /></div>
        {!formData.unidade_id && <div><Label>Saldo Inicial (R$)</Label><Input value={formData.saldo_inicial} onChange={e => setFormData({ ...formData, saldo_inicial: e.target.value })} placeholder="0,00" /><p className="text-xs text-muted-foreground mt-1">Só editável na criação. Após criada, saldo muda via movimentações.</p></div>}
      </div>
      <div><Label>Unidade / Filial</Label>
        <Select value={formData.unidade_id} onValueChange={v => setFormData({ ...formData, unidade_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
          <SelectContent>
            {unidades.map(u => <SelectItem key={u.id} value={u.id}>{u.nome} ({u.tipo})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={onSave}>{saveLabel}</Button>
      </div>
    </div>
  );

  return (
    <MainLayout>
      <Header title="Contas Bancárias" subtitle="Gestão de contas e transferências" />
      <div className="p-4 md:p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total de Contas</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{contas.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Saldo Total</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-primary">R$ {saldoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Transferências (últimas)</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{transferencias.length}</p></CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Conta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" />Nova Conta Bancária</DialogTitle></DialogHeader>
              {renderContaForm(form, setForm, criarConta, () => setDialogOpen(false), "Salvar")}
            </DialogContent>
          </Dialog>

          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><ArrowRightLeft className="h-4 w-4 mr-2" />Transferência entre Contas</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5" />Nova Transferência</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Conta Origem *</Label>
                  <Select value={transferForm.conta_origem_id} onValueChange={v => setTransferForm({ ...transferForm, conta_origem_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {contas.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} ({c.banco}) — R$ {Number(c.saldo_atual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Conta Destino *</Label>
                  <Select value={transferForm.conta_destino_id} onValueChange={v => setTransferForm({ ...transferForm, conta_destino_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {contas.filter(c => c.id !== transferForm.conta_origem_id).map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} ({c.banco})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Valor *</Label><Input value={transferForm.valor} onChange={e => setTransferForm({ ...transferForm, valor: e.target.value })} placeholder="0,00" /></div>
                <div><Label>Descrição</Label><Input value={transferForm.descricao} onChange={e => setTransferForm({ ...transferForm, descricao: e.target.value })} placeholder="Ex: Depósito do caixa" /></div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button>
                  <Button onClick={realizarTransferencia}>Transferir</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="contas">
          <TabsList className="w-full flex-wrap h-auto gap-1">
            <TabsTrigger value="contas" className="text-xs sm:text-sm"><Landmark className="h-4 w-4 mr-1" />Contas</TabsTrigger>
            <TabsTrigger value="transferencias" className="text-xs sm:text-sm"><ArrowRightLeft className="h-4 w-4 mr-1" />Transf.</TabsTrigger>
            <TabsTrigger value="extrato" className="text-xs sm:text-sm"><Receipt className="h-4 w-4 mr-1" />Extrato</TabsTrigger>
            <TabsTrigger value="conciliacao" className="text-xs sm:text-sm"><FileSpreadsheet className="h-4 w-4 mr-1" />OFX</TabsTrigger>
          </TabsList>

          <TabsContent value="contas" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {isLoading ? <p className="text-center py-6 text-muted-foreground">Carregando...</p> : contas.length === 0 ? (
                  <EmptyState
                    icon={Landmark}
                    title="Nenhuma conta cadastrada"
                    description="Cadastre contas bancárias para registrar saldos, extratos e transferências por unidade."
                    action={{ label: "Nova conta", onClick: () => setDialogOpen(true), icon: Plus }}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Conta</TableHead>
                          <TableHead>Banco</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Unidade</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contas.map(c => (
                          <TableRow key={c.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{c.nome}</p>
                                {c.agencia && c.conta && <p className="text-xs text-muted-foreground">Ag: {c.agencia} | Cc: {c.conta}</p>}
                              </div>
                            </TableCell>
                            <TableCell>{c.banco}</TableCell>
                            <TableCell><Badge variant="outline">{tipoLabel(c.tipo)}</Badge></TableCell>
                            <TableCell>{(c as any).unidades?.nome || "—"}</TableCell>
                            <TableCell className={`text-right font-bold ${Number(c.saldo_atual) >= 0 ? "text-green-600" : "text-destructive"}`}>
                              R$ {Number(c.saldo_atual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => abrirEdicao(c)} title="Editar conta">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transferencias" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {transferencias.length === 0 ? (
                  <EmptyState
                    icon={ArrowRightLeft}
                    title="Nenhuma transferência registrada"
                    description="As transferências entre contas aparecerão aqui após o primeiro lançamento."
                    action={{ label: "Nova transferência", onClick: () => setTransferOpen(true), icon: ArrowRightLeft }}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead>Destino</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transferencias.map((t: any) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-sm">{format(new Date(t.data_transferencia), "dd/MM/yyyy")}</TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium">{t.conta_origem?.nome}</p>
                                <p className="text-xs text-muted-foreground">{t.conta_origem?.unidades?.nome}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium">{t.conta_destino?.nome}</p>
                                <p className="text-xs text-muted-foreground">{t.conta_destino?.unidades?.nome}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{t.descricao || "—"}</TableCell>
                            <TableCell className="text-right font-bold">R$ {Number(t.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell>
                              <Badge variant={t.status === "confirmada" ? "default" : "secondary"}>{t.status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="extrato" className="mt-4">
            <ExtratoBancario contas={contas} />
          </TabsContent>

          <TabsContent value="conciliacao" className="mt-4">
            <Conciliacao embedded contas={contas.map(c => ({ id: c.id, nome: c.nome, banco: c.banco, tipo: c.tipo, saldo_atual: c.saldo_atual }))} />
          </TabsContent>
        </Tabs>

        {/* Dialog Editar Conta */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" />Editar Conta Bancária</DialogTitle></DialogHeader>
            {renderContaForm(editForm, setEditForm, editarConta, () => setEditDialogOpen(false), "Atualizar")}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

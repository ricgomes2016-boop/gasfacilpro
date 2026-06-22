import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import { Plus, ArrowRightLeft, Landmark, Send, Pencil, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getBankTheme, bankGradient } from "@/lib/bancos/bankThemes";

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
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editForm, setEditForm] = useState<{ id: string } & typeof emptyForm>({ id: "", ...emptyForm });
  const [transferForm, setTransferForm] = useState({ conta_origem_id: "", conta_destino_id: "", valor: "", descricao: "" });

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ["contas-bancarias", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("contas_bancarias")
        .select("*, unidades(nome)")
        .eq("ativo", true)
        .order("nome");
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ContaBancaria[];
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
    }).eq("id", editForm.id);
    if (error) { toast.error("Erro ao editar conta"); console.error(error); return; }
    toast.success("Conta atualizada!");
    setEditDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["contas-bancarias"] });
  };

  const abrirEdicao = (c: ContaBancaria) => {
    setEditForm({
      id: c.id, nome: c.nome, banco: c.banco,
      agencia: c.agencia || "", conta: c.conta || "",
      tipo: c.tipo, chave_pix: c.chave_pix || "",
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
    if (contaOrigem) await supabase.from("contas_bancarias").update({ saldo_atual: contaOrigem.saldo_atual - valor }).eq("id", contaOrigem.id);
    if (contaDestino) await supabase.from("contas_bancarias").update({ saldo_atual: contaDestino.saldo_atual + valor }).eq("id", contaDestino.id);

    toast.success("Transferência realizada!");
    setTransferOpen(false);
    setTransferForm({ conta_origem_id: "", conta_destino_id: "", valor: "", descricao: "" });
    queryClient.invalidateQueries({ queryKey: ["contas-bancarias"] });
  };

  const tipoLabel = (tipo: string) => ({ corrente: "Conta Corrente", poupanca: "Poupança", caixa_interno: "Caixa Interno" } as Record<string,string>)[tipo] || tipo;

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
      <Header title="Contas Bancárias" subtitle="Clique em uma conta para abrir o painel do banco" />
      <div className="p-4 md:p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total de Contas</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{contas.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Saldo Consolidado</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-primary">R$ {saldoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent>
          </Card>
        </div>

        {/* Ações */}
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
              <Button variant="outline"><ArrowRightLeft className="h-4 w-4 mr-2" />Transferência rápida</Button>
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
                        <SelectItem key={c.id} value={c.id}>{c.nome} ({c.banco})</SelectItem>
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

        {/* Grid de cards de banco */}
        {isLoading ? (
          <p className="text-center py-12 text-muted-foreground">Carregando...</p>
        ) : contas.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                icon={Landmark}
                title="Nenhuma conta cadastrada"
                description="Cadastre contas bancárias para registrar saldos, extratos e transferências por unidade."
                action={{ label: "Nova conta", onClick: () => setDialogOpen(true), icon: Plus }}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {contas.map(c => {
              const theme = getBankTheme(c.banco);
              const saldo = Number(c.saldo_atual);
              return (
                <button
                  key={c.id}
                  onClick={() => navigate(`/financeiro/contas-bancarias/${c.id}`)}
                  className="group text-left rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <div
                    className="p-4 relative"
                    style={{ background: bankGradient(theme), color: theme.textColor }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="h-11 w-11 rounded-xl flex items-center justify-center font-bold shadow"
                          style={{ background: "rgba(255,255,255,0.18)", color: theme.textColor }}
                        >
                          {theme.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wider opacity-80">{theme.nome}</p>
                          <p className="font-semibold truncate">{c.nome}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 opacity-70 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <div className="mt-4">
                      <p className="text-[11px] uppercase tracking-wider opacity-80">Saldo</p>
                      <p className="text-2xl font-extrabold">
                        R$ {saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-card flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                      <Badge variant="outline" className="shrink-0">{tipoLabel(c.tipo)}</Badge>
                      <span className="truncate">
                        {c.agencia && `Ag ${c.agencia}`}{c.agencia && c.conta && " • "}{c.conta && `Cc ${c.conta}`}
                        {!c.agencia && !c.conta && (c.unidades?.nome || "—")}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); abrirEdicao(c); }}
                      title="Editar conta"
                      className="h-8 w-8 shrink-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </button>
              );
            })}
          </div>
        )}

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

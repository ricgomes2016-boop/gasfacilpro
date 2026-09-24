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
import { Package, Plus, Users, AlertTriangle, CheckCircle, Search, RotateCcw, FileText, Zap, Info, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EstoqueKpiCard } from "@/components/estoque/EstoqueKpiCard";
import { EstoquePageHeader } from "@/components/estoque/EstoquePageHeader";
import { ClienteAutocompleteInput } from "@/components/clientes/ClienteAutocompleteInput";

export default function Comodatos() {
  const { unidadeAtual } = useUnidade();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [devolucao, setDevolucao] = useState<{ id: string; pendente: number; nome: string } | null>(null);
  const [qtdDevolucao, setQtdDevolucao] = useState("1");

  const [form, setForm] = useState({
    cliente_id: "",
    produto_id: "",
    quantidade: "1",
    deposito: "0",
    prazo_dias: "90",
    observacoes: "",
    modalidade: "rapido" as "rapido" | "formal",
    responsavel_entrega: "",
    documento_referencia: "",
    local_entrega: "",
    finalidade: "",
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

  const [clienteNome, setClienteNome] = useState("");
  const { data: produtos = [] } = useQuery({
    queryKey: ["comodatos-produtos", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("produtos").select("id, nome, estoque, categoria").eq("ativo", true).eq("tipo_botijao", "vazio").order("nome");
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return data || [];
    },
  });

  const criarComodato = useMutation({
    mutationFn: async () => {
      const quantidade = Number(form.quantidade);
      const prazoDias = Number(form.prazo_dias);
      const produto = produtos.find((p: any) => p.id === form.produto_id);
      if (!unidadeAtual?.id || !form.cliente_id || !produto) throw new Error("Selecione unidade, cliente e vasilhame.");
      if (!Number.isInteger(quantidade) || quantidade < 1) throw new Error("Informe uma quantidade válida.");
      if (quantidade > Number(produto.estoque || 0)) throw new Error("Quantidade maior que o saldo disponível.");
      if (!Number.isInteger(prazoDias) || prazoDias < 1) throw new Error("Informe um prazo válido.");
      if (form.modalidade === "formal" && (!form.responsavel_entrega.trim() || !form.local_entrega.trim())) {
        throw new Error("No comodato formal, informe o responsável e o local de entrega.");
      }
      if (form.modalidade === "formal") {
        const { data: cliente, error: clienteError } = await supabase.from("clientes").select("cpf, cnpj").eq("id", form.cliente_id).single();
        if (clienteError) throw clienteError;
        if (!cliente?.cpf && !cliente?.cnpj) throw new Error("Cadastre o CPF ou CNPJ do cliente para emitir o termo formal.");
      }
      const { error } = await supabase.from("comodatos").insert({
        cliente_id: form.cliente_id,
        produto_id: form.produto_id,
        quantidade,
        deposito: Number(form.deposito) || 0,
        prazo_devolucao: format(addDays(new Date(), prazoDias), "yyyy-MM-dd"),
        observacoes: form.observacoes || null,
        unidade_id: unidadeAtual.id,
        status: "ativo",
        modalidade: form.modalidade,
        responsavel_entrega: form.responsavel_entrega || null,
        documento_referencia: form.documento_referencia || null,
        local_entrega: form.local_entrega || null,
        finalidade: form.finalidade || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comodatos"] });
      queryClient.invalidateQueries({ queryKey: ["comodatos-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast({ title: "Comodato registrado!" });
      setDialogOpen(false);
      setForm({ cliente_id: "", produto_id: "", quantidade: "1", deposito: "0", prazo_dias: "2", observacoes: "", modalidade: "rapido", responsavel_entrega: "", documento_referencia: "", local_entrega: "", finalidade: "" });
      setClienteNome("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const devolverComodato = useMutation({
    mutationFn: async () => {
      if (!devolucao) throw new Error("Selecione o comodato.");
      const quantidade = Number(qtdDevolucao);
      if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > devolucao.pendente) throw new Error("Quantidade devolvida inválida.");
      const atual = comodatos.find((c: any) => c.id === devolucao.id);
      const { data, error } = await supabase.from("comodatos").update({
        quantidade_devolvida: Number(atual?.quantidade_devolvida || 0) + quantidade,
      } as any).eq("id", devolucao.id).eq("status", "ativo").eq("quantidade_devolvida", Number(atual?.quantidade_devolvida || 0)).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("O comodato foi alterado por outro usuário. Atualize a página e tente novamente.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comodatos"] });
      queryClient.invalidateQueries({ queryKey: ["comodatos-produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      setDevolucao(null);
      toast({ title: "Devolução registrada", description: "O saldo de vasilhames vazios foi reposto." });
    },
    onError: (e: any) => toast({ title: "Não foi possível registrar a devolução", description: e.message, variant: "destructive" }),
  });

  const abrirDevolucao = (c: any) => {
    const pendente = c.quantidade - Number(c.quantidade_devolvida || 0);
    setQtdDevolucao(String(pendente));
    setDevolucao({ id: c.id, pendente, nome: c.produtos?.nome || "Vasilhame" });
  };

  const imprimirComprovante = async (c: any) => {
    const pdf = new jsPDF();
    const empresa = (unidadeAtual as any)?.nome || "Empresa";
    const { data: cliente, error: clienteError } = await supabase.from("clientes")
      .select("nome, cpf, cnpj, endereco, numero, cidade, telefone")
      .eq("id", c.cliente_id).single();
    if (clienteError) {
      toast({ title: "Não foi possível carregar os dados do cliente", description: clienteError.message, variant: "destructive" });
      return;
    }
    const formal = c.modalidade !== "rapido";
    const linhas = [
      `Cedente: ${empresa}  |  CNPJ: ${(unidadeAtual as any)?.cnpj || "a preencher"}`,
      `Cliente: ${c.clientes?.nome || cliente?.nome || "a preencher"}`,
      `CPF/CNPJ: ${cliente?.cpf || cliente?.cnpj || "a preencher"}`,
      `Vasilhame: ${c.produtos?.nome || "-"}  |  Quantidade: ${c.quantidade}`,
      `Entregue em: ${format(parseLocalDate(c.data_emprestimo), "dd/MM/yyyy")}`,
      `Devolver até: ${c.prazo_devolucao ? format(parseLocalDate(c.prazo_devolucao), "dd/MM/yyyy") : "a combinar"}`,
      `Local: ${c.local_entrega || cliente?.endereco || "a combinar"}`,
      `Responsável: ${c.responsavel_entrega || c.clientes?.nome || "-"}`,
      `Referência: ${c.documento_referencia || "-"}`,
      `Garantia informada: R$ ${Number(c.deposito || 0).toFixed(2)}`,
    ];
    pdf.setFontSize(16);
    pdf.text(formal ? "TERMO DE COMODATO DE VASILHAME" : "COMPROVANTE DE EMPRÉSTIMO DE VASILHAME", 14, 20);
    pdf.setFontSize(10);
    let y = 33;
    for (const linha of linhas) {
      const bloco = pdf.splitTextToSize(linha, 180);
      pdf.text(bloco, 14, y);
      y += bloco.length * 5 + 4;
    }
    const clausulas = formal ? [
      "O cedente entrega gratuitamente o(s) vasilhame(s) identificado(s) acima, permanecendo responsável pelo controle da sua devolução.",
      "O cliente compromete-se a conservar e restituir a quantidade recebida no prazo indicado, comunicando perda ou avaria.",
      "Este termo registra o empréstimo do recipiente vazio. A venda do GLP e os documentos fiscais correspondentes são operações separadas.",
    ] : ["O cliente confirma o recebimento do(s) vasilhame(s) vazio(s) e combina sua devolução até a data indicada."];
    for (const clausula of clausulas) { const bloco = pdf.splitTextToSize(clausula, 180); pdf.text(bloco, 14, y); y += bloco.length * 5 + 5; }
    if (c.observacoes) { const bloco = pdf.splitTextToSize(`Observações: ${c.observacoes}`, 180); pdf.text(bloco, 14, y); y += bloco.length * 5 + 7; }
    y = Math.min(Math.max(y + 16, 160), 255);
    pdf.line(16, y, 90, y); pdf.line(116, y, 190, y);
    pdf.text("Cedente", 42, y + 6); pdf.text("Cliente / responsável", 136, y + 6);
    pdf.save(`${formal ? "termo" : "comprovante"}-comodato-${c.id.slice(0, 8)}.pdf`);
  };

  const filtrados = comodatos.filter((c: any) => {
    const matchBusca = !filtro || c.clientes?.nome?.toLowerCase().includes(filtro.toLowerCase()) || c.produtos?.nome?.toLowerCase().includes(filtro.toLowerCase());
    const matchStatus = filtroStatus === "todos" || c.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const ativos = comodatos.filter((c: any) => c.status === "ativo");
  const totalQtd = ativos.reduce((s: number, c: any) => s + Math.max(0, (c.quantidade || 0) - Number(c.quantidade_devolvida || 0)), 0);
  const totalDeposito = ativos.reduce((s: number, c: any) => s + (c.deposito || 0), 0);
  const vencidos = ativos.filter((c: any) => c.prazo_devolucao && parseLocalDate(c.prazo_devolucao) < new Date()).length;
  const clientesUnicos = new Set(ativos.map((c: any) => c.cliente_id)).size;

  return (
    <MainLayout>
      <Header title="Comodatos" subtitle="Controle de vasilhames emprestados a clientes" />
      <div className="p-3 sm:p-6 space-y-6">
        <Dialog open={!!devolucao} onOpenChange={(open) => { if (!open) setDevolucao(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Receber vasilhames</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{devolucao?.nome} · {devolucao?.pendente} pendente(s). Você pode receber apenas parte agora.</p>
            <div className="grid gap-2"><Label>Quantidade recebida</Label><Input type="number" min="1" max={devolucao?.pendente} value={qtdDevolucao} onChange={(e) => setQtdDevolucao(e.target.value)} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDevolucao(null)}>Cancelar</Button><Button onClick={() => devolverComodato.mutate()} disabled={devolverComodato.isPending}>Confirmar devolução</Button></div>
          </DialogContent>
        </Dialog>
        <EstoquePageHeader
          title="Vasilhames em comodato"
          description="Empréstimos ativos, prazos e depósitos por cliente"
          actions={
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Novo Comodato</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[92dvh] overflow-y-auto p-0">
                <div className="border-b bg-gradient-to-r from-primary/10 to-background px-5 py-5 sm:px-7">
                  <DialogHeader>
                    <DialogTitle className="text-xl">Novo comodato de vasilhame</DialogTitle>
                    <p className="text-sm text-muted-foreground">Registre a saída do vazio e acompanhe a devolução ao estoque.</p>
                  </DialogHeader>
                </div>
                <div className="grid gap-5 px-5 py-5 sm:px-7">
                  <div className="grid gap-2">
                    <Label>Tipo de comodato</Label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button type="button" onClick={() => setForm({ ...form, modalidade: "rapido", prazo_dias: "2" })} className={`rounded-xl border p-4 text-left transition-colors ${form.modalidade === "rapido" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}>
                        <Zap className="mb-2 h-5 w-5 text-primary" /><span className="block font-semibold">Empréstimo rápido</span><span className="block text-xs text-muted-foreground">Comprovante simples, devolução em poucos dias.</span>
                      </button>
                      <button type="button" onClick={() => setForm({ ...form, modalidade: "formal", prazo_dias: "90" })} className={`rounded-xl border p-4 text-left transition-colors ${form.modalidade === "formal" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}>
                        <FileText className="mb-2 h-5 w-5 text-primary" /><span className="block font-semibold">Comodato formal</span><span className="block text-xs text-muted-foreground">Dados para termo completo, prazo e responsável.</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Cliente *</Label>
                    <ClienteAutocompleteInput
                      value={clienteNome}
                      placeholder="Digite nome, telefone ou endereço..."
                      onChange={(nome, cliente) => {
                        setClienteNome(nome);
                        setForm((f) => ({ ...f, cliente_id: cliente?.id || "" }));
                      }}
                    />
                    {clienteNome.trim().length >= 2 && !form.cliente_id && <p className="text-xs text-muted-foreground">Selecione um cliente da lista.</p>}
                  </div>
                  <div className="grid gap-2">
                    <Label>Vasilhame vazio *</Label>
                    <Select value={form.produto_id} onValueChange={(v) => setForm({ ...form, produto_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione o vasilhame" /></SelectTrigger>
                      <SelectContent>
                        {produtos.map((p: any) => <SelectItem key={p.id} value={p.id} disabled={Number(p.estoque || 0) < 1}>{p.nome} · {p.estoque || 0} disponíveis</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {form.produto_id && <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm"><Package className="h-4 w-4 text-primary" /> Saldo disponível: <strong>{produtos.find((p: any) => p.id === form.produto_id)?.estoque || 0} vazios</strong></div>}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="grid gap-2">
                      <Label>Quantidade</Label>
                      <Input type="number" min="1" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Garantia recebida (R$)</Label>
                      <Input type="number" min="0" step="0.01" value={form.deposito} onChange={(e) => setForm({ ...form, deposito: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Prazo de devolução (dias)</Label>
                      <Input type="number" min="1" value={form.prazo_dias} onChange={(e) => setForm({ ...form, prazo_dias: e.target.value })} />
                    </div>
                  </div>
                  {form.modalidade === "formal" && <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
                    <div className="grid gap-2"><Label>Responsável pelo recebimento *</Label><Input value={form.responsavel_entrega} onChange={(e) => setForm({ ...form, responsavel_entrega: e.target.value })} placeholder="Nome de quem receberá" /></div>
                    <div className="grid gap-2"><Label>Documento ou referência</Label><Input value={form.documento_referencia} onChange={(e) => setForm({ ...form, documento_referencia: e.target.value })} placeholder="CPF/CNPJ ou nº do contrato" /></div>
                    <div className="grid gap-2 sm:col-span-2"><Label>Local de entrega *</Label><Input value={form.local_entrega} onChange={(e) => setForm({ ...form, local_entrega: e.target.value })} placeholder="Endereço ou unidade de instalação" /></div>
                    <div className="grid gap-2 sm:col-span-2"><Label>Finalidade</Label><Input value={form.finalidade} onChange={(e) => setForm({ ...form, finalidade: e.target.value })} placeholder="Ex.: abastecimento da cozinha" /></div>
                  </div>}
                  <div className="grid gap-2">
                    <Label>Observações sobre o vasilhame</Label>
                    <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Estado de conservação, identificação, combinação de retirada..." />
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm"><Info className="mr-2 inline h-4 w-4" />Ao registrar, o sistema retira {form.quantidade || 0} vasilhame(s) vazio(s) do estoque. Na devolução, repõe apenas os recebidos.</div>
                  <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={() => criarComodato.mutate()} disabled={!form.cliente_id || !form.produto_id || criarComodato.isPending}>{criarComodato.isPending ? "Registrando..." : "Registrar e baixar do estoque"}</Button></div>
                </div>
              </DialogContent>
            </Dialog>
          }
        />

        {/* KPIs */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
          <EstoqueKpiCard icon={Package} label="Vasilhames Emprestados" value={totalQtd} tone="primary" />
          <EstoqueKpiCard icon={Users} label="Clientes" value={clientesUnicos} tone="info" />
          <EstoqueKpiCard icon={AlertTriangle} label="Vencidos" value={vencidos} tone={vencidos > 0 ? "destructive" : "secondary"} />
          <EstoqueKpiCard icon={CheckCircle} label="Em Depósitos" value={`R$ ${totalDeposito.toLocaleString("pt-BR")}`} tone="success" />
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar cliente ou produto..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
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
          <CardContent className="px-3 sm:px-6">
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {filtrados.length === 0 && <p className="text-center py-8 text-muted-foreground">Nenhum comodato encontrado</p>}
              {filtrados.map((c: any) => {
                const vencido = c.status === "ativo" && c.prazo_devolucao && parseLocalDate(c.prazo_devolucao) < new Date();
                const diasRestantes = c.prazo_devolucao ? differenceInDays(parseLocalDate(c.prazo_devolucao), new Date()) : null;
                return (
                  <div key={c.id} className={`border rounded-lg p-3 ${vencido ? "border-destructive/30 bg-destructive/5" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.clientes?.nome || "—"}</p>
                        <p className="text-xs text-muted-foreground">{c.produtos?.nome || "—"} · {c.modalidade === "rapido" ? "Rápido" : "Formal"}</p>
                        <p className="text-xs text-muted-foreground">{c.quantidade - Number(c.quantidade_devolvida || 0)} de {c.quantidade} pendente(s)</p>
                      </div>
                      {c.status === "ativo" ? (vencido ? <Badge variant="destructive" className="text-xs shrink-0">Vencido</Badge> : <Badge className="text-xs shrink-0">Ativo</Badge>) : <Badge variant="secondary" className="text-xs shrink-0">Devolvido</Badge>}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>Depósito: R$ {(c.deposito || 0).toFixed(2)}</span>
                      <span>Prazo: {c.prazo_devolucao ? format(parseLocalDate(c.prazo_devolucao), "dd/MM/yy") : "—"}{diasRestantes !== null && c.status === "ativo" && ` (${diasRestantes > 0 ? `${diasRestantes}d` : `${Math.abs(diasRestantes)}d atrás`})`}</span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => imprimirComprovante(c)}><Printer className="mr-1 h-3.5 w-3.5" /> {c.modalidade === "rapido" ? "Comprovante" : "Termo"}</Button>
                      {c.status === "ativo" && <Button variant="outline" size="sm" className="flex-1" onClick={() => abrirDevolucao(c)} disabled={devolverComodato.isPending}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Devolver</Button>}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vasilhame</TableHead>
                    <TableHead className="text-center">Pendente / total</TableHead>
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
                        <TableCell className="text-center">{c.quantidade - Number(c.quantidade_devolvida || 0)} / {c.quantidade}<span className="block text-xs text-muted-foreground">{c.modalidade === "rapido" ? "Rápido" : "Formal"}</span></TableCell>
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
                          {c.status === "ativo" ? (vencido ? <Badge variant="destructive">Vencido</Badge> : <Badge>Ativo</Badge>) : <Badge variant="secondary">Devolvido</Badge>}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => imprimirComprovante(c)}><Printer className="mr-1 h-3.5 w-3.5" /> {c.modalidade === "rapido" ? "Comprovante" : "Termo"}</Button>
                            {c.status === "ativo" && <Button variant="ghost" size="sm" onClick={() => abrirDevolucao(c)} disabled={devolverComodato.isPending}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Devolver</Button>}
                          </div>
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

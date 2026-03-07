import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Wallet, Search, Plus, AlertCircle, CheckCircle2, Clock, MoreHorizontal,
  Pencil, Trash2, DollarSign, Download, MapPin, User, Filter, X,
  CreditCard, Banknote, FileText, Handshake, Flame, Receipt, CheckSquare,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { ConferenciaCartao } from "@/components/financeiro/ConferenciaCartao";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format } from "date-fns";
import { getBrasiliaDateString } from "@/lib/utils";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SmartImportButtons } from "@/components/import/SmartImportButtons";
import { ImportReviewDialog } from "@/components/import/ImportReviewDialog";
import { criarMovimentacaoBancaria } from "@/services/paymentRoutingService";

interface ContaReceber {
  id: string;
  cliente: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: string;
  forma_pagamento: string | null;
  observacoes: string | null;
  created_at: string;
  pedido_id: string | null;
  endereco_cliente?: string | null;
  bairro_cliente?: string | null;
}

const FORMAS_PAGAMENTO = ["Boleto", "PIX", "Transferência", "Dinheiro", "Cartão", "Cheque"];

// Mapeamento de forma_pagamento para abas
function getTabFromForma(forma: string | null): string {
  if (!forma) return "outros";
  const f = forma.toLowerCase();
  if (f.includes("débito") || f.includes("debito") || f.includes("cartao_debito") || f.includes("crédito") || f.includes("credito") || f.includes("cartao_credito") || f === "cartão") return "cartoes";
  if (f === "pix_maquininha" || f.includes("pix maquininha")) return "pix_maquininha";
  if (f.includes("cheque")) return "cheques";
  if (f.includes("fiado")) return "fiado";
  if (f.includes("boleto")) return "boletos";
  if (f.includes("vale") || f.includes("vale_gas")) return "vale_gas";
  return "outros";
}

export default function ContasReceber() {
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroNome, setFiltroNome] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [receberDialogOpen, setReceberDialogOpen] = useState(false);
  const [receberConta, setReceberConta] = useState<ContaReceber | null>(null);
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("pendente");
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState("todos");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { unidadeAtual } = useUnidade();

  // Bulk liquidation states
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkFormaPagamento, setBulkFormaPagamento] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Import states
  const [importItems, setImportItems] = useState<Array<{
    cliente: string; descricao: string; valor: number; vencimento: string; forma_pagamento: string; observacoes: string;
  }>>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importSaving, setImportSaving] = useState(false);

  const handleImportData = (data: any) => {
    const items = data?.recebiveis || [data];
    setImportItems(items.map((d: any) => ({
      cliente: d.cliente || "", descricao: d.descricao || "", valor: d.valor || 0,
      vencimento: d.vencimento || "", forma_pagamento: d.forma_pagamento || "", observacoes: d.observacoes || "",
    })));
    setImportDialogOpen(true);
    toast.success(`${items.length} recebível(is) identificado(s)!`);
  };

  const saveImportedReceivables = async () => {
    const valid = importItems.filter(d => d.cliente && d.valor > 0);
    if (valid.length === 0) return;
    setImportSaving(true);
    try {
      const rows = valid.map(d => ({
        cliente: d.cliente, descricao: d.descricao, valor: d.valor,
        vencimento: d.vencimento || getBrasiliaDateString(),
        forma_pagamento: d.forma_pagamento || null, observacoes: d.observacoes || null,
        unidade_id: unidadeAtual?.id || null,
      }));
      const { error } = await supabase.from("contas_receber").insert(rows);
      if (error) throw error;
      toast.success(`${valid.length} recebível(is) importado(s)!`);
      setImportDialogOpen(false); setImportItems([]); fetchContas();
    } catch (err: any) {
      toast.error("Erro ao importar: " + (err.message || "erro"));
    } finally { setImportSaving(false); }
  };

  const [form, setForm] = useState({
    cliente: "", descricao: "", valor: "", vencimento: "", forma_pagamento: "", observacoes: "",
  });

  const [receberForm, setReceberForm] = useState({
    formasPagamento: [{ forma: "", valor: "" }] as { forma: string; valor: string }[],
  });

  const resetForm = () => setForm({ cliente: "", descricao: "", valor: "", vencimento: "", forma_pagamento: "", observacoes: "" });

  const fetchContas = async () => {
    setLoading(true);
    let query = supabase
      .from("contas_receber")
      .select("*, pedidos(cliente_id, endereco_entrega, clientes(nome, endereco, bairro))")
      .order("vencimento", { ascending: true });
    if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
    const { data, error } = await query;
    if (error) { toast.error("Erro ao carregar recebíveis"); console.error(error); }
    else {
      setContas((data || []).map((c: any) => ({
        id: c.id, cliente: c.cliente, descricao: c.descricao, valor: c.valor,
        vencimento: c.vencimento, status: c.status, forma_pagamento: c.forma_pagamento,
        observacoes: c.observacoes, created_at: c.created_at, pedido_id: c.pedido_id,
        endereco_cliente: c.pedidos?.endereco_entrega || c.pedidos?.clientes?.endereco || null,
        bairro_cliente: c.pedidos?.clientes?.bairro || null,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchContas(); }, [unidadeAtual]);

  const handleSubmit = async () => {
    if (!form.cliente || !form.descricao || !form.valor || !form.vencimento) {
      toast.error("Preencha os campos obrigatórios"); return;
    }
    const payload = {
      cliente: form.cliente, descricao: form.descricao,
      valor: parseFloat(form.valor), vencimento: form.vencimento,
      forma_pagamento: form.forma_pagamento || null,
      observacoes: form.observacoes || null,
      unidade_id: unidadeAtual?.id || null,
    };
    if (editId) {
      const { error } = await supabase.from("contas_receber").update(payload).eq("id", editId);
      if (error) { toast.error("Erro ao atualizar"); } 
      else { toast.success("Atualizado!"); setDialogOpen(false); setEditId(null); resetForm(); fetchContas(); }
    } else {
      const { error } = await supabase.from("contas_receber").insert(payload);
      if (error) { toast.error("Erro ao criar"); } 
      else { toast.success("Recebível criado!"); setDialogOpen(false); resetForm(); fetchContas(); }
    }
  };

  const handleEdit = (conta: ContaReceber) => {
    setEditId(conta.id);
    setForm({
      cliente: conta.cliente, descricao: conta.descricao,
      valor: String(conta.valor), vencimento: conta.vencimento,
      forma_pagamento: conta.forma_pagamento || "", observacoes: conta.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("contas_receber").delete().eq("id", deleteId);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Excluído!"); fetchContas(); }
    setDeleteId(null);
  };

  const openReceberDialog = (conta: ContaReceber) => {
    setReceberConta(conta);
    setReceberForm({
      formasPagamento: [{ forma: conta.forma_pagamento || "", valor: String(conta.valor) }],
    });
    setReceberDialogOpen(true);
  };

  // Ao confirmar recebimento, roteia corretamente cada forma de pagamento:
  // Dinheiro → Caixa da Loja | PIX → Conta Bancária | Cartão → Novo recebível
  const handleReceber = async () => {
    if (!receberConta) return;
    const totalRecebido = receberForm.formasPagamento.reduce((sum, f) => sum + (parseFloat(f.valor) || 0), 0);
    const valorConta = Number(receberConta.valor);
    if (totalRecebido <= 0) { toast.error("Informe o valor recebido"); return; }
    if (totalRecebido > valorConta + 0.01) { toast.error("Valor excede o da conta"); return; }

    const isParcial = totalRecebido < valorConta - 0.01;
    const formasStr = receberForm.formasPagamento
      .filter(f => f.forma && parseFloat(f.valor) > 0)
      .map(f => `${f.forma}: R$ ${parseFloat(f.valor).toFixed(2)}`)
      .join(", ");

    // Rotear cada forma de pagamento para o destino correto
    const { data: { user } } = await supabase.auth.getUser();
    for (const fp of receberForm.formasPagamento) {
      const valor = parseFloat(fp.valor) || 0;
      if (valor <= 0 || !fp.forma) continue;
      const formaLower = fp.forma.toLowerCase();
      const ref = receberConta.pedido_id?.slice(0, 8) || receberConta.id.slice(0, 8);

      if (formaLower === "dinheiro") {
        // Dinheiro → Caixa da Loja
        await supabase.from("movimentacoes_caixa").insert({
          tipo: "entrada",
          descricao: `Pgto Fiado #${ref} - Dinheiro`,
          valor,
          categoria: "Recebimento Fiado",
          status: "aprovada",
          pedido_id: receberConta.pedido_id || null,
          unidade_id: unidadeAtual?.id || null,
        });
      } else if (formaLower === "pix") {
        // PIX → Conta Bancária
        const contaId = await getContaPrincipal();
        if (contaId) {
          await criarMovimentacaoBancaria({
            contaBancariaId: contaId,
            valor,
            descricao: `Pgto Fiado #${ref} - PIX`,
            categoria: "recebimento_fiado",
            unidadeId: unidadeAtual?.id,
            userId: user?.id,
            pedidoId: receberConta.pedido_id || undefined,
          });
        }
      } else {
        // Cartão/outros → Creditar direto na conta bancária
        const contaId = await getContaPrincipal();
        if (contaId) {
          await criarMovimentacaoBancaria({
            contaBancariaId: contaId,
            valor,
            descricao: `Pgto Fiado #${ref} - ${fp.forma}`,
            categoria: "recebimento_fiado",
            unidadeId: unidadeAtual?.id,
            userId: user?.id,
            pedidoId: receberConta.pedido_id || undefined,
          });
        }
      }
    }

    if (isParcial) {
      const restante = valorConta - totalRecebido;
      const obs = `${receberConta.observacoes || ""}\nRecebido parcial R$ ${totalRecebido.toFixed(2)} em ${format(new Date(), "dd/MM/yyyy")} (${formasStr})`.trim();
      const { error } = await supabase.from("contas_receber").update({ valor: restante, observacoes: obs }).eq("id", receberConta.id);
      if (error) { toast.error("Erro ao processar"); return; }
      toast.success(`Recebido R$ ${totalRecebido.toFixed(2)} — Restante: R$ ${restante.toFixed(2)}`);
    } else {
      const { error } = await supabase.from("contas_receber").update({
        status: "recebida", forma_pagamento: formasStr || receberConta.forma_pagamento,
      }).eq("id", receberConta.id);
      if (error) { toast.error("Erro ao confirmar"); return; }
      toast.success("Conta recebida! Valores roteados para caixa/banco.");
    }
    setReceberDialogOpen(false);
    fetchContas();
  };

  // Helper para buscar conta principal
  const getContaPrincipal = async () => {
    const { data } = await supabase.from("contas_bancarias").select("id")
      .eq("ativo", true).eq("unidade_id", unidadeAtual?.id || "").limit(1).maybeSingle();
    return data?.id || null;
  };

  // Bulk liquidation handler
  const handleBulkReceber = async () => {
    if (!bulkFormaPagamento || selectedContas.length === 0) {
      toast.error("Selecione a forma de pagamento"); return;
    }
    setBulkProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const formaLower = bulkFormaPagamento.toLowerCase();
      const contaId = formaLower !== "dinheiro" ? await getContaPrincipal() : null;
      let successCount = 0;

      for (const conta of selectedContas) {
        if (conta.status === "recebida") continue;
        const valor = Number(conta.valor);
        const ref = conta.pedido_id?.slice(0, 8) || conta.id.slice(0, 8);

        // Route payment
        if (formaLower === "dinheiro") {
          await supabase.from("movimentacoes_caixa").insert({
            tipo: "entrada",
            descricao: `Pgto Lote #${ref} - Dinheiro`,
            valor,
            categoria: "Recebimento Fiado",
            status: "aprovada",
            pedido_id: conta.pedido_id || null,
            unidade_id: unidadeAtual?.id || null,
          });
        } else if (contaId) {
          await criarMovimentacaoBancaria({
            contaBancariaId: contaId,
            valor,
            descricao: `Pgto Lote #${ref} - ${bulkFormaPagamento}`,
            categoria: "recebimento_fiado",
            unidadeId: unidadeAtual?.id,
            userId: user?.id,
            pedidoId: conta.pedido_id || undefined,
          });
        }

        // Mark as received
        const { error } = await supabase.from("contas_receber").update({
          status: "recebida",
          forma_pagamento: bulkFormaPagamento,
        }).eq("id", conta.id);

        if (!error) successCount++;
      }

      toast.success(`${successCount} conta(s) liquidada(s) com sucesso!`);
      setBulkDialogOpen(false);
      setBulkFormaPagamento("");
      setSelectedIds(new Set());
      fetchContas();
    } catch (err: any) {
      toast.error("Erro ao liquidar em lote: " + (err.message || "erro"));
    } finally {
      setBulkProcessing(false);
    }
  };

  const addFormaPagamento = () => {
    setReceberForm(prev => ({
      ...prev, formasPagamento: [...prev.formasPagamento, { forma: "", valor: "" }],
    }));
  };
  const removeFormaPagamento = (idx: number) => {
    setReceberForm(prev => ({
      ...prev, formasPagamento: prev.formasPagamento.filter((_, i) => i !== idx),
    }));
  };
  const updateFormaPagamento = (idx: number, field: "forma" | "valor", value: string) => {
    setReceberForm(prev => ({
      ...prev, formasPagamento: prev.formasPagamento.map((f, i) => i === idx ? { ...f, [field]: value } : f),
    }));
  };

  const hoje = getBrasiliaDateString();

  // Filtragem base (nome, data, status) — por padrão mostra apenas pendentes/vencidas
  const baseFiltered = contas.filter(c => {
    const matchNome = !filtroNome || c.cliente.toLowerCase().includes(filtroNome.toLowerCase());
    const matchDataIni = !dataInicial || c.vencimento >= dataInicial;
    const matchDataFim = !dataFinal || c.vencimento <= dataFinal;
    const vencida = c.status === "pendente" && c.vencimento < hoje;
    const statusAtual = c.status === "recebida" ? "recebida" : vencida ? "vencida" : "pendente";
    const matchStatus = filtroStatus === "todos" || statusAtual === filtroStatus
      || (filtroStatus === "pendente" && statusAtual === "vencida"); // pendente inclui vencidas
    return matchNome && matchDataIni && matchDataFim && matchStatus;
  });

  // Filtragem por aba
  const filtered = useMemo(() => {
    if (activeTab === "todos") return baseFiltered;
    if (activeTab === "conferencia") return []; // handled by ConferenciaCartao component
    return baseFiltered.filter(c => getTabFromForma(c.forma_pagamento) === activeTab);
  }, [baseFiltered, activeTab]);

  // Totais globais (independente da aba)
  const totalPendente = contas.filter(c => c.status === "pendente" && c.vencimento >= hoje).reduce((a, c) => a + Number(c.valor), 0);
  const totalVencido = contas.filter(c => c.status === "pendente" && c.vencimento < hoje).reduce((a, c) => a + Number(c.valor), 0);
  const totalRecebido = contas.filter(c => c.status === "recebida").reduce((a, c) => a + Number(c.valor), 0);

  // Contadores por aba
  const countByTab = useMemo(() => {
    const pendentes = contas.filter(c => c.status !== "recebida");
    const counts: Record<string, number> = { cartoes: 0, pix_maquininha: 0, cheques: 0, fiado: 0, boletos: 0, vale_gas: 0, outros: 0 };
    pendentes.forEach(c => {
      const tab = getTabFromForma(c.forma_pagamento);
      if (counts[tab] !== undefined) counts[tab]++;
    });
    return counts;
  }, [contas]);

  const hasActiveFilters = filtroNome || dataInicial || dataFinal || filtroStatus !== "pendente";
  const clearAllFilters = () => { setFiltroNome(""); setDataInicial(""); setDataFinal(""); setFiltroStatus("pendente"); };

  // Multi-select helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  };
  const selectedContas = filtered.filter(c => selectedIds.has(c.id));
  const selectedTotal = selectedContas.reduce((s, c) => s + Number(c.valor), 0);
  const canBulkReceber = selectedContas.length > 0 && selectedContas.every(c => c.status !== "recebida");

  const exportToExcel = () => {
    const data = filtered.map(c => ({
      Cliente: c.cliente, Descrição: c.descricao, "Forma Pgto": c.forma_pagamento || "—",
      Vencimento: format(new Date(c.vencimento + "T12:00:00"), "dd/MM/yyyy"),
      Valor: `R$ ${Number(c.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      Status: c.status === "recebida" ? "Recebida" : c.vencimento < hoje ? "Vencida" : "Pendente",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recebíveis");
    XLSX.writeFile(wb, `contas_receber_${format(new Date(), "ddMMyyyy_HHmm")}.xlsx`);
    toast.success("Excel exportado!");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("Contas a Receber", 14, 15);
    doc.setFontSize(10); doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 22);
    const tableData = filtered.map(c => [
      c.cliente, c.descricao, c.forma_pagamento || "—",
      format(new Date(c.vencimento + "T12:00:00"), "dd/MM/yyyy"),
      `R$ ${Number(c.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      c.status === "recebida" ? "Recebida" : c.vencimento < hoje ? "Vencida" : "Pendente",
    ]);
    autoTable(doc, {
      head: [["Cliente", "Descrição", "Forma", "Vencimento", "Valor", "Status"]],
      body: tableData, startY: 30, styles: { fontSize: 9 },
      headStyles: { fillColor: [51, 65, 85] },
    });
    doc.save(`contas_receber_${format(new Date(), "ddMMyyyy_HHmm")}.pdf`);
    toast.success("PDF exportado!");
  };

  const renderTabBadge = (key: string) => {
    const count = countByTab[key] || 0;
    if (count === 0) return null;
    return <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1 text-[10px]">{count}</Badge>;
  };

  const renderTable = () => (
    <>
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 mb-3">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {selectedIds.size} selecionado(s) — R$ {selectedTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
          <div className="ml-auto flex gap-2">
            {canBulkReceber && (
              <Button size="sm" variant="default" className="gap-1.5" onClick={() => {
                if (selectedContas.length === 1) {
                  openReceberDialog(selectedContas[0]);
                } else {
                  setBulkFormaPagamento("");
                  setBulkDialogOpen(true);
                }
              }}>
                <DollarSign className="h-4 w-4" />Liquidar ({selectedContas.length})
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3.5 w-3.5 mr-1" />Limpar seleção
            </Button>
          </div>
        </div>
      )}
      {loading ? (
        <p className="text-center py-8 text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">Nenhum recebível nesta categoria</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Descrição</TableHead>
                <TableHead className="hidden sm:table-cell">Forma</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-12">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(conta => {
                const vencida = conta.status === "pendente" && conta.vencimento < hoje;
                const displayStatus = vencida ? "Vencida" : conta.status === "recebida" ? "Recebida" : "Pendente";
                return (
                  <TableRow key={conta.id} data-state={selectedIds.has(conta.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(conta.id)}
                        onCheckedChange={() => toggleSelect(conta.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{conta.cliente}</p>
                      <p className="text-xs text-muted-foreground md:hidden">{conta.descricao}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{conta.descricao}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="text-xs">{conta.forma_pagamento || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                      {format(new Date(conta.vencimento + "T12:00:00"), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="font-medium text-xs sm:text-sm whitespace-nowrap">
                      R$ {Number(conta.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={displayStatus === "Recebida" ? "default" : displayStatus === "Vencida" ? "destructive" : "secondary"} className="text-[10px] sm:text-xs">
                        {displayStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border border-border shadow-lg z-50">
                          {conta.status !== "recebida" && (
                            <DropdownMenuItem onClick={() => openReceberDialog(conta)}>
                              <DollarSign className="h-4 w-4 mr-2" />Liquidar / Receber
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleEdit(conta)}>
                            <Pencil className="h-4 w-4 mr-2" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(conta.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="px-3 py-2 text-xs text-muted-foreground border-t">
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </>
  );

  return (
    <MainLayout>
      <Header title="Contas a Receber" subtitle="Recebíveis unificados por categoria" />
      <div className="p-3 md:p-6 space-y-4 md:space-y-6">

        {/* Dashboard resumo estilo PagBank */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">💰 O que vendi (a receber)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-bold">
                R$ {(totalPendente + totalVencido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Total em aberto</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">⏳ O que vou receber</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-bold text-warning">
                R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Pendente (a vencer)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">✅ O que recebi</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl sm:text-2xl font-bold text-success">
                R$ {totalRecebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Liquidado</p>
            </CardContent>
          </Card>
        </div>

        {totalVencido > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <span className="text-sm">
              <strong className="text-destructive">R$ {totalVencido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> em recebíveis vencidos. Ação necessária!
            </span>
          </div>
        )}

        {/* Actions bar */}
        <div className="flex items-center gap-2 justify-between flex-wrap">
          <div className="flex items-center gap-2">
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditId(null); resetForm(); } }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Novo</Button>
              </DialogTrigger>
              <SmartImportButtons edgeFunctionName="parse-receivables-import" onDataExtracted={handleImportData} />
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editId ? "Editar Recebível" : "Novo Recebível"}</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div><Label>Cliente *</Label><Input value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} /></div>
                  <div><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Valor *</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} /></div>
                    <div><Label>Vencimento *</Label><Input type="date" value={form.vencimento} onChange={e => setForm({ ...form, vencimento: e.target.value })} /></div>
                  </div>
                  <div>
                    <Label>Forma de Pagamento</Label>
                    <Select value={form.forma_pagamento} onValueChange={v => setForm({ ...form, forma_pagamento: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {FORMAS_PAGAMENTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={2} /></div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => { setDialogOpen(false); setEditId(null); resetForm(); }}>Cancelar</Button>
                    <Button onClick={handleSubmit}>{editId ? "Atualizar" : "Salvar"}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-1.5">
              <Download className="h-4 w-4" /><span className="hidden sm:inline">Excel</span>
            </Button>
            <Button variant="outline" size="sm" onClick={exportToPDF} className="gap-1.5">
              <Download className="h-4 w-4" /><span className="hidden sm:inline">PDF</span>
            </Button>
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-1.5"
            >
              <Filter className="h-4 w-4" />Filtros
              {hasActiveFilters && <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-[10px]">!</Badge>}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters}><X className="h-3.5 w-3.5" /></Button>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 rounded-lg bg-muted/30 border border-border">
            <div>
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <Input placeholder="Buscar..." value={filtroNome} onChange={e => setFiltroNome(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">De</Label>
              <Input type="date" value={dataInicial} onChange={e => setDataInicial(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Input type="date" value={dataFinal} onChange={e => setDataFinal(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="vencida">Vencidas</SelectItem>
                  <SelectItem value="recebida">Recebidas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Tabs por tipo */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50">
            <TabsTrigger value="todos" className="text-xs gap-1">
              <Wallet className="h-3.5 w-3.5" />Todos
            </TabsTrigger>
            <TabsTrigger value="cartoes" className="text-xs gap-1">
              <CreditCard className="h-3.5 w-3.5" />Cartões{renderTabBadge("cartoes")}
            </TabsTrigger>
            <TabsTrigger value="pix_maquininha" className="text-xs gap-1">
              <Banknote className="h-3.5 w-3.5" />PIX Maq.{renderTabBadge("pix_maquininha")}
            </TabsTrigger>
            <TabsTrigger value="cheques" className="text-xs gap-1">
              <FileText className="h-3.5 w-3.5" />Cheques{renderTabBadge("cheques")}
            </TabsTrigger>
            <TabsTrigger value="fiado" className="text-xs gap-1">
              <Handshake className="h-3.5 w-3.5" />Fiado{renderTabBadge("fiado")}
            </TabsTrigger>
            <TabsTrigger value="boletos" className="text-xs gap-1">
              <Receipt className="h-3.5 w-3.5" />Boletos{renderTabBadge("boletos")}
            </TabsTrigger>
            <TabsTrigger value="vale_gas" className="text-xs gap-1">
              <Flame className="h-3.5 w-3.5" />Vale Gás{renderTabBadge("vale_gas")}
            </TabsTrigger>
            <TabsTrigger value="conferencia" className="text-xs gap-1">
              <CreditCard className="h-3.5 w-3.5" />Conferência
            </TabsTrigger>
          </TabsList>

          {/* All data tabs share the same table */}
          {["todos", "cartoes", "pix_maquininha", "cheques", "fiado", "boletos", "vale_gas"].map(tab => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <Card>
                <CardContent className="p-0 md:p-6 md:pt-4">
                  {renderTable()}
                </CardContent>
              </Card>
            </TabsContent>
          ))}

          <TabsContent value="conferencia" className="mt-4">
            <ConferenciaCartao />
          </TabsContent>
        </Tabs>

        {/* Dialog Receber */}
        <Dialog open={receberDialogOpen} onOpenChange={setReceberDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Liquidar / Receber</DialogTitle></DialogHeader>
            {receberConta && (
              <div className="space-y-4 pt-2">
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-sm font-medium">{receberConta.cliente}</p>
                  <p className="text-xs text-muted-foreground">{receberConta.descricao}</p>
                  <p className="text-lg font-bold">R$ {Number(receberConta.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Formas de Pagamento</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addFormaPagamento}>+ Forma</Button>
                  </div>
                  {receberForm.formasPagamento.map((fp, idx) => (
                    <div key={idx} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Select value={fp.forma} onValueChange={v => updateFormaPagamento(idx, "forma", v)}>
                          <SelectTrigger><SelectValue placeholder="Forma" /></SelectTrigger>
                          <SelectContent>
                            {FORMAS_PAGAMENTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-[120px]">
                        <Input type="number" step="0.01" placeholder="Valor" value={fp.valor}
                          onChange={e => updateFormaPagamento(idx, "valor", e.target.value)} />
                      </div>
                      {receberForm.formasPagamento.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeFormaPagamento(idx)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <p className="text-sm text-muted-foreground">
                    Total: <span className="font-medium text-foreground">
                      R$ {receberForm.formasPagamento.reduce((s, f) => s + (parseFloat(f.valor) || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    {receberForm.formasPagamento.reduce((s, f) => s + (parseFloat(f.valor) || 0), 0) < Number(receberConta.valor) - 0.01 && (
                      <span className="ml-2 text-warning">(parcial)</span>
                    )}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  Ao confirmar, o valor será creditado automaticamente na conta bancária principal da unidade.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setReceberDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleReceber}>Confirmar Recebimento</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Confirm Delete */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir recebível?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <ImportReviewDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        title="Importar Contas a Receber"
        items={importItems}
        onUpdateItem={(index, field, value) => {
          setImportItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
        }}
        onRemoveItem={(index) => {
          setImportItems(prev => prev.filter((_, i) => i !== index));
        }}
        onConfirm={saveImportedReceivables}
        saving={importSaving}
        columns={[
          { key: "cliente", label: "Cliente" },
          { key: "descricao", label: "Descrição" },
          { key: "valor", label: "Valor", type: "number" as const },
          { key: "vencimento", label: "Vencimento", type: "date" as const },
          { key: "forma_pagamento", label: "Forma Pgto" },
        ]}
      />
    </MainLayout>
  );
}

import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
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
  Wallet, Search, Plus, AlertCircle, CheckCircle2, Clock, MoreHorizontal,
  Pencil, Trash2, DollarSign, Download, X,
  Banknote, CheckSquare, RefreshCw, Eye, SlidersHorizontal,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { isFormaAVista, getFormaCategoria, FORMA_LABELS, type FormaCategoria } from "@/lib/financeiro/formaPagamento";
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
import { useAuth } from "@/contexts/AuthContext";
import { EmitirBoletoAsaasDialog } from "@/components/financeiro/EmitirBoletoAsaasDialog";
import { ClienteAutocompleteInput } from "@/components/clientes/ClienteAutocompleteInput";
import { useFormasPagamentoCustom } from "@/hooks/useFormasPagamentoCustom";

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
  vale_gas_id?: string | null;
  vale_gas_parceiro_id?: string | null;
  origem?: string | null;
  vale_numero?: number | null;
  vale_codigo?: string | null;
  parceiro_nome?: string | null;
  endereco_cliente?: string | null;
  bairro_cliente?: string | null;
  data_venda?: string | null;
  data_recebimento?: string | null;
  asaas_charge_id?: string | null;
  linha_digitavel?: string | null;
  boleto_url?: string | null;
  pix_qrcode?: string | null;
  pix_copia_cola?: string | null;
}

const FORMAS_PAGAMENTO_BUILTIN = ["Boleto", "PIX", "Transferência", "Dinheiro", "Cartão", "Cheque", "Vale Gás"];

// Categorias de filtro disponíveis na barra unificada
const FORMA_FILTER_OPTIONS: { value: FormaCategoria; label: string; grupo: "a_vista" | "a_prazo" | "outros" }[] = [
  { value: "dinheiro", label: "Dinheiro", grupo: "a_vista" },
  { value: "pix", label: "PIX", grupo: "a_vista" },
  { value: "pix_maquininha", label: "PIX Maquininha", grupo: "a_prazo" },
  { value: "cartao_debito", label: "Cartão Débito", grupo: "a_prazo" },
  { value: "cartao_credito", label: "Cartão Crédito", grupo: "a_prazo" },
  { value: "boleto", label: "Boleto", grupo: "a_prazo" },
  { value: "fiado", label: "Fiado", grupo: "a_prazo" },
  { value: "cheque", label: "Cheque", grupo: "a_prazo" },
  { value: "vale_gas", label: "Vale Gás", grupo: "a_prazo" },
  { value: "gas_do_povo", label: "Gás do Povo", grupo: "a_prazo" },
  { value: "transferencia", label: "Transferência", grupo: "a_prazo" },
  { value: "outros", label: "Outros", grupo: "outros" },
];

type StatusFiltro = "a_receber" | "vencida" | "recebida";

function isBoletoForma(f: string | null | undefined): boolean {
  return !!f && f.toLowerCase().includes("boleto");
}
function getBoletoEmissaoStatus(c: { forma_pagamento: string | null; asaas_charge_id?: string | null; status: string }): "pendente_emissao" | "emitido" | null {
  if (!isBoletoForma(c.forma_pagamento)) return null;
  if (c.status === "recebida") return null;
  return c.asaas_charge_id ? "emitido" : "pendente_emissao";
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
  const [filtroStatus, setFiltroStatus] = useState<Set<StatusFiltro>>(new Set(["a_receber", "vencida"]));
  const [filtroFormas, setFiltroFormas] = useState<Set<FormaCategoria>>(new Set());
  const [conferenciaDialogOpen, setConferenciaDialogOpen] = useState(false);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { unidadeAtual } = useUnidade();
  const { data: formasCustom = [] } = useFormasPagamentoCustom({ onlyActive: true });
  const FORMAS_PAGAMENTO = useMemo(
    () => [
      ...FORMAS_PAGAMENTO_BUILTIN.map((f) => ({ value: f, label: f })),
      ...formasCustom.map((c) => ({ value: c.slug, label: `${c.icone} ${c.nome}` })),
    ],
    [formasCustom],
  );

  // Bulk liquidation states
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkFormaPagamento, setBulkFormaPagamento] = useState("");
  const [bulkDataRecebimento, setBulkDataRecebimento] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Edit data_recebimento (admin/gestor only)
  const { hasAnyRole, profile, user } = useAuth();
  const podeEditarDataRecebimento = hasAnyRole(["admin", "gestor"]);
  const [editDataRecDialogOpen, setEditDataRecDialogOpen] = useState(false);
  const [editDataRecConta, setEditDataRecConta] = useState<ContaReceber | null>(null);
  const [asaasDialogOpen, setAsaasDialogOpen] = useState(false);
  const [asaasConta, setAsaasConta] = useState<ContaReceber | null>(null);
  const [detalheConta, setDetalheConta] = useState<ContaReceber | null>(null);
  const [editDataRecValue, setEditDataRecValue] = useState("");
  const [editDataRecSaving, setEditDataRecSaving] = useState(false);

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
    dataRecebimento: "",
  });

  const resetForm = () => setForm({ cliente: "", descricao: "", valor: "", vencimento: "", forma_pagamento: "", observacoes: "" });

  const fetchContas = async () => {
    setLoading(true);
    let query = supabase
      .from("contas_receber")
      .select("*, pedidos(cliente_id, created_at, endereco_entrega, clientes(nome, endereco, bairro)), vale_gas(numero, codigo), vale_gas_parceiros:vale_gas_parceiro_id(nome)")
      .order("vencimento", { ascending: true });
    if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
    const { data, error } = await query;
    if (error) { toast.error("Erro ao carregar recebíveis"); console.error(error); }
    else {
      setContas((data || []).map((c: any) => ({
        id: c.id, cliente: c.cliente, descricao: c.descricao, valor: c.valor,
        vencimento: c.vencimento, status: c.status, forma_pagamento: c.forma_pagamento,
        observacoes: c.observacoes, created_at: c.created_at, pedido_id: c.pedido_id,
        vale_gas_id: c.vale_gas_id, vale_gas_parceiro_id: c.vale_gas_parceiro_id,
        origem: c.origem, vale_numero: c.vale_gas?.numero || null,
        vale_codigo: c.vale_gas?.codigo || null,
        parceiro_nome: c.vale_gas_parceiros?.nome || null,
        endereco_cliente: c.pedidos?.endereco_entrega || c.pedidos?.clientes?.endereco || null,
        bairro_cliente: c.pedidos?.clientes?.bairro || null,
        data_venda: c.pedidos?.created_at || c.created_at || null,
        data_recebimento: c.data_recebimento || null,
        asaas_charge_id: c.asaas_charge_id || null,
        linha_digitavel: c.linha_digitavel || null,
        boleto_url: c.boleto_url || null,
        pix_qrcode: c.pix_qrcode || null,
        pix_copia_cola: c.pix_copia_cola || null,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchContas(); }, [unidadeAtual]);

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const sincronizarAsaas = async (conta: ContaReceber) => {
    if (!conta.asaas_charge_id) {
      toast.error("Esta cobrança ainda não foi emitida no Asaas.");
      return;
    }
    setSyncingId(conta.id);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-api", {
        body: { action: "get_charge", id: conta.asaas_charge_id },
      });
      if (error) throw error;
      const charge = (data as any)?.charge;
      if (!charge) throw new Error("Cobrança não retornada pelo Asaas.");
      const pagas = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];
      if (pagas.includes(charge.status)) {
        const update: Record<string, any> = {
          status: "recebida",
          data_recebimento: charge.paymentDate || charge.clientPaymentDate || getBrasiliaDateString(),
        };
        const { error: upErr } = await supabase.from("contas_receber").update(update as any).eq("id", conta.id);
        if (upErr) throw upErr;
        toast.success("Pagamento confirmado e baixado!");
        fetchContas();
      } else if (charge.status === "OVERDUE") {
        toast.info("Asaas informa que o boleto está vencido.");
      } else {
        toast.info(`Status no Asaas: ${charge.status}. Ainda não confirmado.`);
      }
    } catch (err: any) {
      toast.error("Erro ao sincronizar: " + (err.message || "erro"));
    } finally {
      setSyncingId(null);
    }
  };

  const handleSubmit = async () => {
    if (!form.cliente || !form.descricao || !form.valor || !form.vencimento) {
      toast.error("Preencha os campos obrigatórios"); return;
    }
    const autoBaixa = isFormaAVista(form.forma_pagamento);
    const payload: any = {
      cliente: form.cliente, descricao: form.descricao,
      valor: parseFloat(form.valor), vencimento: form.vencimento,
      forma_pagamento: form.forma_pagamento || null,
      observacoes: form.observacoes || null,
      unidade_id: unidadeAtual?.id || null,
      ...(autoBaixa && !editId ? { status: "recebida", data_recebimento: form.vencimento || getBrasiliaDateString() } : {}),
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
      dataRecebimento: getBrasiliaDateString(),
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
    const dataRec = receberForm.dataRecebimento || getBrasiliaDateString();
    if (!dataRec) { toast.error("Informe a data do recebimento"); return; }
    const dataVenda = (receberConta.data_venda || receberConta.created_at || "").slice(0, 10);
    const hojeStr = getBrasiliaDateString();
    if (dataVenda && dataRec < dataVenda) {
      toast.error(`A data do recebimento não pode ser anterior à data da venda (${format(new Date(dataVenda + "T12:00:00"), "dd/MM/yyyy")}).`);
      return;
    }
    if (dataRec > hojeStr) {
      toast.error("A data do recebimento não pode ser posterior a hoje.");
      return;
    }
    const dataRecFmt = format(new Date(dataRec + "T12:00:00"), "dd/MM/yyyy");

    const isParcial = totalRecebido < valorConta - 0.01;
    const formasStr = receberForm.formasPagamento
      .filter(f => f.forma && parseFloat(f.valor) > 0)
      .map(f => `${f.forma}: R$ ${parseFloat(f.valor).toFixed(2)}`)
      .join(", ");
    const refTipo = receberConta.forma_pagamento === "vale_gas" ? "Vale Gás" : "Fiado";

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
          descricao: `Pgto ${refTipo} #${ref} - Dinheiro`,
          valor,
          categoria: receberConta.forma_pagamento === "vale_gas" ? "Recebimento Vale Gás" : "Recebimento Fiado",
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
            descricao: `Pgto ${refTipo} #${ref} - PIX`,
            categoria: receberConta.forma_pagamento === "vale_gas" ? "recebimento_vale_gas" : "recebimento_fiado",
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
            descricao: `Pgto ${refTipo} #${ref} - ${fp.forma}`,
            categoria: receberConta.forma_pagamento === "vale_gas" ? "recebimento_vale_gas" : "recebimento_fiado",
            unidadeId: unidadeAtual?.id,
            userId: user?.id,
            pedidoId: receberConta.pedido_id || undefined,
          });
        }
      }
    }

    if (isParcial) {
      const restante = valorConta - totalRecebido;
      const obs = `${receberConta.observacoes || ""}\nRecebido parcial R$ ${totalRecebido.toFixed(2)} em ${dataRecFmt} (${formasStr})`.trim();
      const { error } = await supabase.from("contas_receber").update({ valor: restante, observacoes: obs }).eq("id", receberConta.id);
      if (error) { toast.error("Erro ao processar"); return; }
      toast.success(`Recebido R$ ${totalRecebido.toFixed(2)} — Restante: R$ ${restante.toFixed(2)}`);
    } else {
      const { error } = await supabase.from("contas_receber").update({
        status: "recebida", forma_pagamento: formasStr || receberConta.forma_pagamento,
        data_recebimento: dataRec,
      }).eq("id", receberConta.id);
      if (error) { toast.error("Erro ao confirmar"); return; }
      toast.success(`Conta recebida em ${dataRecFmt}!`);
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
    const dataRec = bulkDataRecebimento || getBrasiliaDateString();
    const hojeStr = getBrasiliaDateString();
    if (dataRec > hojeStr) {
      toast.error("A data do recebimento não pode ser posterior a hoje.");
      return;
    }
    const maiorDataVenda = selectedContas.reduce<string>((acc, c) => {
      const d = (c.data_venda || c.created_at || "").slice(0, 10);
      return d > acc ? d : acc;
    }, "");
    if (maiorDataVenda && dataRec < maiorDataVenda) {
      toast.error(`A data do recebimento não pode ser anterior à data da venda mais recente (${format(new Date(maiorDataVenda + "T12:00:00"), "dd/MM/yyyy")}).`);
      return;
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
          data_recebimento: dataRec,
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

  const openEditDataRecDialog = (conta: ContaReceber) => {
    setEditDataRecConta(conta);
    setEditDataRecValue((conta.data_recebimento || getBrasiliaDateString()).slice(0, 10));
    setEditDataRecDialogOpen(true);
  };

  const handleSalvarEditDataRec = async () => {
    if (!editDataRecConta) return;
    const nova = editDataRecValue;
    if (!nova) { toast.error("Informe a data"); return; }
    const dataVenda = (editDataRecConta.data_venda || editDataRecConta.created_at || "").slice(0, 10);
    const hojeStr = getBrasiliaDateString();
    if (dataVenda && nova < dataVenda) {
      toast.error(`A data não pode ser anterior à data da venda (${format(new Date(dataVenda + "T12:00:00"), "dd/MM/yyyy")}).`);
      return;
    }
    if (nova > hojeStr) {
      toast.error("A data não pode ser posterior a hoje.");
      return;
    }
    const antiga = editDataRecConta.data_recebimento
      ? format(new Date(editDataRecConta.data_recebimento + "T12:00:00"), "dd/MM/yyyy")
      : "—";
    const novaFmt = format(new Date(nova + "T12:00:00"), "dd/MM/yyyy");
    if (antiga === novaFmt) {
      toast.info("A data informada é a mesma já registrada.");
      return;
    }
    setEditDataRecSaving(true);
    try {
      const autor = profile?.full_name || profile?.email || user?.email || "usuário";
      const agora = format(new Date(), "dd/MM/yyyy HH:mm");
      const linha = `[Data de recebimento alterada de ${antiga} para ${novaFmt} por ${autor} em ${agora}]`;
      const obs = `${editDataRecConta.observacoes || ""}\n${linha}`.trim();
      const { error } = await supabase
        .from("contas_receber")
        .update({ data_recebimento: nova, observacoes: obs })
        .eq("id", editDataRecConta.id);
      if (error) throw error;
      toast.success("Data de recebimento atualizada!");
      setEditDataRecDialogOpen(false);
      setEditDataRecConta(null);
      fetchContas();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "erro"));
    } finally {
      setEditDataRecSaving(false);
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

  const diasEntre = (a: string, b: string) => {
    const d1 = new Date(a + "T12:00:00").getTime();
    const d2 = new Date(b + "T12:00:00").getTime();
    return Math.round((d1 - d2) / 86400000);
  };
  const agingLabel = (conta: ContaReceber) => {
    if (conta.status === "recebida") {
      return conta.data_recebimento
        ? { text: `recebido em ${format(new Date(conta.data_recebimento + "T12:00:00"), "dd/MM/yyyy")}`, cls: "text-muted-foreground" }
        : null;
    }
    const dias = diasEntre(hoje, conta.vencimento);
    if (dias > 0) return { text: `${dias} dia${dias > 1 ? "s" : ""} em aberto`, cls: "text-destructive font-medium" };
    if (dias === 0) return { text: "vence hoje", cls: "text-warning" };
    return { text: `vence em ${-dias} dia${-dias > 1 ? "s" : ""}`, cls: "text-muted-foreground" };
  };


  // Filtragem unificada (busca + período + status + formas)
  const baseFiltered = useMemo(() => {
    const termo = filtroNome.toLowerCase();
    return contas.filter(c => {
      const matchNome = !filtroNome
        || c.cliente.toLowerCase().includes(termo)
        || (c.parceiro_nome || "").toLowerCase().includes(termo)
        || (c.descricao || "").toLowerCase().includes(termo)
        || String(c.vale_numero || "").includes(termo)
        || (c.vale_codigo || "").toLowerCase().includes(termo);
      const matchDataIni = !dataInicial || c.vencimento >= dataInicial;
      const matchDataFim = !dataFinal || c.vencimento <= dataFinal;

      const vencida = c.status === "pendente" && c.vencimento < hoje;
      const statusAtual: StatusFiltro = c.status === "recebida"
        ? "recebida"
        : vencida ? "vencida" : "a_receber";
      const matchStatus = filtroStatus.size === 0 || filtroStatus.has(statusAtual);

      const matchForma = filtroFormas.size === 0
        || filtroFormas.has(getFormaCategoria(c.forma_pagamento));

      return matchNome && matchDataIni && matchDataFim && matchStatus && matchForma;
    });
  }, [contas, filtroNome, dataInicial, dataFinal, filtroStatus, filtroFormas, hoje]);

  const filtered = baseFiltered;

  // KPIs respeitam os filtros ativos
  const totalPendente = useMemo(() => baseFiltered.filter(c => c.status === "pendente" && c.vencimento >= hoje).reduce((a, c) => a + Number(c.valor), 0), [baseFiltered, hoje]);
  const totalVencido = useMemo(() => baseFiltered.filter(c => c.status === "pendente" && c.vencimento < hoje).reduce((a, c) => a + Number(c.valor), 0), [baseFiltered, hoje]);
  const totalRecebido = useMemo(() => baseFiltered.filter(c => c.status === "recebida").reduce((a, c) => a + Number(c.valor), 0), [baseFiltered]);
  const totalAberto = totalPendente + totalVencido;
  const countAberto = baseFiltered.filter(c => c.status !== "recebida").length;
  const countVencido = baseFiltered.filter(c => c.status === "pendente" && c.vencimento < hoje).length;
  const countPendente = baseFiltered.filter(c => c.status === "pendente" && c.vencimento >= hoje).length;
  const countRecebido = baseFiltered.filter(c => c.status === "recebida").length;

  const defaultStatus: Set<StatusFiltro> = new Set(["a_receber", "vencida"]);
  const hasActiveFilters =
    !!filtroNome || !!dataInicial || !!dataFinal ||
    filtroFormas.size > 0 ||
    filtroStatus.size !== defaultStatus.size ||
    [...filtroStatus].some(s => !defaultStatus.has(s));
  const clearAllFilters = () => {
    setFiltroNome(""); setDataInicial(""); setDataFinal("");
    setFiltroStatus(new Set(["a_receber", "vencida"]));
    setFiltroFormas(new Set());
  };

  const toggleStatus = (s: StatusFiltro) => setFiltroStatus(prev => {
    const next = new Set(prev);
    if (next.has(s)) next.delete(s); else next.add(s);
    return next;
  });
  const toggleForma = (f: FormaCategoria) => setFiltroFormas(prev => {
    const next = new Set(prev);
    if (next.has(f)) next.delete(f); else next.add(f);
    return next;
  });

  const aplicarPresetPeriodo = (preset: "hoje" | "7d" | "mes_atual" | "mes_passado" | "30d" | "90d" | "ano" | "limpar") => {
    const d = new Date();
    const iso = (date: Date) => date.toISOString().slice(0, 10);
    if (preset === "limpar") { setDataInicial(""); setDataFinal(""); return; }
    if (preset === "hoje") { const s = iso(d); setDataInicial(s); setDataFinal(s); return; }
    if (preset === "7d") { const ini = new Date(d); ini.setDate(d.getDate() - 7); setDataInicial(iso(ini)); setDataFinal(iso(d)); return; }
    if (preset === "30d") { const ini = new Date(d); ini.setDate(d.getDate() - 30); setDataInicial(iso(ini)); setDataFinal(iso(d)); return; }
    if (preset === "90d") { const ini = new Date(d); ini.setDate(d.getDate() - 90); setDataInicial(iso(ini)); setDataFinal(iso(d)); return; }
    if (preset === "mes_atual") {
      setDataInicial(iso(new Date(d.getFullYear(), d.getMonth(), 1)));
      setDataFinal(iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)));
      return;
    }
    if (preset === "mes_passado") {
      setDataInicial(iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)));
      setDataFinal(iso(new Date(d.getFullYear(), d.getMonth(), 0)));
      return;
    }
    if (preset === "ano") {
      setDataInicial(iso(new Date(d.getFullYear(), 0, 1)));
      setDataFinal(iso(new Date(d.getFullYear(), 11, 31)));
      return;
    }
  };


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

  // (renderTabBadge removido — abas por forma foram substituídas pelo filtro unificado)


  const getReceberRowClass = (displayStatus: string) => {
    const base = "group border-b border-border/60 transition-colors hover:bg-muted/40 data-[state=selected]:bg-primary/5 [&>td]:h-14 [&>td]:py-2.5";
    if (displayStatus === "Recebida") return `${base} [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-success`;
    if (displayStatus === "Vencida") return `${base} [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-destructive`;
    return `${base} [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-success`;
  };

  const quickStatusValue = (() => {
    if (filtroStatus.size === 0) return "todos";
    if (filtroStatus.size === defaultStatus.size && [...filtroStatus].every(s => defaultStatus.has(s))) return "abertas";
    if (filtroStatus.size === 1) return [...filtroStatus][0];
    return "personalizado";
  })();

  const quickPeriodValue = (() => {
    if (!dataInicial && !dataFinal) return "todos";
    if (dataInicial === hoje && dataFinal === hoje) return "hoje";
    return "personalizado";
  })();

  const handleQuickStatusChange = (value: string) => {
    if (value === "todos") setFiltroStatus(new Set(["a_receber", "vencida", "recebida"]));
    else if (value === "abertas") setFiltroStatus(new Set(["a_receber", "vencida"]));
    else if (value === "personalizado") setAdvancedSearchOpen(true);
    else setFiltroStatus(new Set([value as StatusFiltro]));
  };

  const handleQuickPeriodChange = (value: string) => {
    if (value === "todos") { setDataInicial(""); setDataFinal(""); return; }
    if (value === "hoje") { aplicarPresetPeriodo("hoje"); return; }
    if (value === "7d") { aplicarPresetPeriodo("7d"); return; }
    if (value === "mes_atual") { aplicarPresetPeriodo("mes_atual"); return; }
    setAdvancedSearchOpen(true);
  };

  const getTituloRecebivel = (conta: ContaReceber) => {
    if (conta.vale_numero) return `V${String(conta.vale_numero).padStart(5, "0")}`;
    if (conta.pedido_id) return `P${String(conta.pedido_id).slice(-6)}`;
    return conta.id.slice(0, 8).toUpperCase();
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
                  setBulkDataRecebimento(getBrasiliaDateString());
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
        <EmptyState
          icon={Wallet}
          title="Nenhum recebível encontrado"
          description="Ajuste os filtros ou cadastre um novo recebível para acompanhar cobranças e vencimentos."
          action={{ label: "Novo recebível", onClick: () => setDialogOpen(true), icon: Plus }}
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map(conta => {
              const vencida = conta.status === "pendente" && conta.vencimento < hoje;
              const displayStatus = vencida ? "Vencida" : conta.status === "recebida" ? "Recebida" : "Pendente";
              return (
                <div
                  key={conta.id}
                  className="mobile-record-card transition hover:border-primary/40 hover:shadow-md data-[state=selected]:border-primary/50 data-[state=selected]:bg-primary/5"
                  data-state={selectedIds.has(conta.id) ? "selected" : undefined}
                  onClick={() => setDetalheConta(conta)}
                >
                  <div className="mobile-record-card-header">
                    <div className="flex items-center gap-2 min-w-0">
                      <Checkbox
                        checked={selectedIds.has(conta.id)}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => toggleSelect(conta.id)}
                      />
                      <div className="min-w-0">
                        <p className="mobile-record-card-title line-clamp-2">{conta.parceiro_nome || conta.cliente}</p>
                        {conta.endereco_cliente && (
                          <p className="mobile-record-card-meta truncate">
                            {conta.endereco_cliente}{conta.bairro_cliente ? ` — ${conta.bairro_cliente}` : ""}
                          </p>
                        )}
                        <p className="mobile-record-card-meta truncate">{conta.descricao}</p>
                        {conta.vale_numero && <p className="text-[10px] text-muted-foreground">Vale nº {conta.vale_numero}</p>}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border border-border shadow-lg z-50" onClick={(e) => e.stopPropagation()}>
                        {conta.status !== "recebida" && <DropdownMenuItem onClick={() => openReceberDialog(conta)}><DollarSign className="h-4 w-4 mr-2" />Liquidar / Receber</DropdownMenuItem>}
                        {conta.status !== "recebida" && (
                          <DropdownMenuItem onClick={() => { setAsaasConta(conta); setAsaasDialogOpen(true); }}>
                            <Banknote className="h-4 w-4 mr-2" />
                            {conta.asaas_charge_id ? "Ver boleto / PIX (Asaas)" : "Emitir boleto / PIX (Asaas)"}
                          </DropdownMenuItem>
                        )}
                        {conta.asaas_charge_id && conta.boleto_url && (
                          <DropdownMenuItem onClick={() => window.open(conta.boleto_url!, "_blank", "noopener,noreferrer")}>
                            <Download className="h-4 w-4 mr-2" />Baixar 2ª via do boleto
                          </DropdownMenuItem>
                        )}
                        {conta.asaas_charge_id && conta.status !== "recebida" && (
                          <DropdownMenuItem disabled={syncingId === conta.id} onClick={() => sincronizarAsaas(conta)}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${syncingId === conta.id ? "animate-spin" : ""}`} />
                            Sincronizar com Asaas
                          </DropdownMenuItem>
                        )}
                        {conta.status === "recebida" && podeEditarDataRecebimento && (
                          <DropdownMenuItem onClick={() => openEditDataRecDialog(conta)}>
                            <Pencil className="h-4 w-4 mr-2" />Editar data de recebimento
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleEdit(conta)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(conta.id)}><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={displayStatus === "Recebida" ? "default" : displayStatus === "Vencida" ? "destructive" : "secondary"} className="text-[10px]">{displayStatus}</Badge>
                      {conta.forma_pagamento && <Badge variant="outline" className="text-[10px]">{conta.forma_pagamento}</Badge>}
                      {(() => {
                        const be = getBoletoEmissaoStatus(conta);
                        if (be === "pendente_emissao") return <Badge variant="warning" className="text-[10px]"><Clock className="h-2.5 w-2.5" />Pendente de emissão</Badge>;
                        if (be === "emitido") return <Badge variant="info" className="text-[10px]"><CheckCircle2 className="h-2.5 w-2.5" />Boleto emitido</Badge>;
                        return null;
                      })()}
                    </div>
                    <span className="font-bold text-sm">R$ {Number(conta.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/45 pt-3">
                    <p className="text-[10px] text-muted-foreground">
                      {conta.data_venda && <>Venda: {format(new Date(conta.data_venda), "dd/MM/yyyy")} · </>}
                      Venc: {format(new Date(conta.vencimento + "T12:00:00"), "dd/MM/yyyy")}
                    </p>
                    {(() => { const a = agingLabel(conta); return a ? <span className={`text-[10px] ${a.cls}`}>{a.text}</span> : null; })()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden table-card-shell md:block">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="border-b bg-muted/75 hover:bg-muted/75 [&_th]:h-11 [&_th]:border-0 [&_th]:text-[11px] [&_th]:font-extrabold [&_th]:uppercase [&_th]:tracking-[0.02em] [&_th]:text-foreground">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-[120px]">Nº Título</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="w-[150px]">Vencimento</TableHead>
                  <TableHead className="w-[140px]">Valor</TableHead>
                  <TableHead className="w-[130px]">Situação</TableHead>
                  <TableHead className="w-[170px]">Forma de Pagamento</TableHead>
                  <TableHead className="w-[92px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(conta => {
                  const vencida = conta.status === "pendente" && conta.vencimento < hoje;
                  const displayStatus = vencida ? "Vencida" : conta.status === "recebida" ? "Recebida" : "A vencer";
                  return (
                    <TableRow
                      key={conta.id}
                      className={`${getReceberRowClass(displayStatus)} cursor-pointer`}
                      data-state={selectedIds.has(conta.id) ? "selected" : undefined}
                      onClick={() => setDetalheConta(conta)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selectedIds.has(conta.id)} onCheckedChange={() => toggleSelect(conta.id)} />
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="font-semibold text-primary hover:underline"
                          onClick={(e) => { e.stopPropagation(); setDetalheConta(conta); }}
                        >
                          {getTituloRecebivel(conta)}
                        </button>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-semibold text-foreground">{conta.parceiro_nome || conta.cliente}</p>
                        <p className="max-w-[260px] truncate text-xs text-muted-foreground">
                          {conta.descricao || conta.endereco_cliente || "Sem descrição"}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        <div>{format(new Date(conta.vencimento + "T12:00:00"), "dd/MM/yyyy")}</div>
                        {(() => { const a = agingLabel(conta); return a ? <div className={`text-[10px] ${a.cls}`}>{a.text}</div> : null; })()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm font-semibold text-foreground">
                        R$ {Number(conta.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={displayStatus === "Recebida" ? "default" : displayStatus === "Vencida" ? "destructive" : "secondary"}
                          className={`text-xs ${displayStatus === "A vencer" ? "bg-success/10 text-success hover:bg-success/10" : ""}`}
                        >
                          {displayStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">{conta.forma_pagamento || "—"}</span>
                          {(() => {
                            const be = getBoletoEmissaoStatus(conta);
                            if (be === "pendente_emissao") return <span className="text-[10px] text-warning">Boleto pendente</span>;
                            if (be === "emitido") return <span className="text-[10px] text-primary">Boleto emitido</span>;
                            return null;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetalheConta(conta)}>
                            <Eye className="h-4 w-4" />
                          </Button>
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
                              {conta.status !== "recebida" && (
                                <DropdownMenuItem onClick={() => { setAsaasConta(conta); setAsaasDialogOpen(true); }}>
                                  <Banknote className="h-4 w-4 mr-2" />
                                  {conta.asaas_charge_id ? "Ver boleto / PIX (Asaas)" : "Emitir boleto / PIX (Asaas)"}
                                </DropdownMenuItem>
                              )}
                              {conta.asaas_charge_id && conta.boleto_url && (
                                <DropdownMenuItem onClick={() => window.open(conta.boleto_url!, "_blank", "noopener,noreferrer")}>
                                  <Download className="h-4 w-4 mr-2" />Baixar 2ª via do boleto
                                </DropdownMenuItem>
                              )}
                              {conta.asaas_charge_id && conta.status !== "recebida" && (
                                <DropdownMenuItem disabled={syncingId === conta.id} onClick={() => sincronizarAsaas(conta)}>
                                  <RefreshCw className={`h-4 w-4 mr-2 ${syncingId === conta.id ? "animate-spin" : ""}`} />
                                  Sincronizar com Asaas
                                </DropdownMenuItem>
                              )}
                              {conta.status === "recebida" && podeEditarDataRecebimento && (
                                <DropdownMenuItem onClick={() => openEditDataRecDialog(conta)}>
                                  <Pencil className="h-4 w-4 mr-2" />Editar data de recebimento
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
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
              <span>Mostrando {filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
              <span>{hasActiveFilters ? "Filtros aplicados" : "Sem filtros ativos"}</span>
            </div>
          </div>
        </>
      )}
    </>
  );

  return (
    <MainLayout>
      <Header title="Contas a Receber" subtitle="Recebíveis unificados por categoria" />
      <div className="p-3 md:p-6 space-y-4 md:space-y-6">

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { title: "A Receber (Total)", value: totalAberto, count: countAberto, tone: "primary", icon: Wallet, detail: "Total em aberto" },
            { title: "Vencidas", value: totalVencido, count: countVencido, tone: "destructive", icon: AlertCircle, detail: "Exigem cobrança" },
            { title: "A Vencer", value: totalPendente, count: countPendente, tone: "success", icon: Clock, detail: "Dentro do prazo" },
            { title: "Recebidos (Mês)", value: totalRecebido, count: countRecebido, tone: "info", icon: CheckCircle2, detail: "Liquidado no filtro" },
          ].map((card) => {
            const Icon = card.icon;
            const valueClass = card.tone === "destructive" ? "text-destructive" : card.tone === "success" ? "text-success" : "";
            const iconClass = card.tone === "destructive" ? "status-card-icon-destructive" : card.tone === "success" ? "status-card-icon-success" : "status-card-icon-primary";
            return (
              <Card key={card.title} className="kpi-card">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{card.title}</p>
                    <p className={`mt-2 text-xl font-bold sm:text-2xl ${valueClass}`}>
                      R$ {card.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{card.count} título{card.count === 1 ? "" : "s"} · {card.detail}</p>
                  </div>
                  <div className={`status-card-icon ${iconClass} h-10 w-10 shrink-0`}>
                    <Icon />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {totalVencido > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <span className="text-sm">
              <strong className="text-destructive">R$ {totalVencido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> em recebíveis vencidos. Ação necessária!
            </span>
          </div>
        )}

        {/* Painel operacional */}
        <div className="rounded-xl border bg-card/90 p-3 shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Button variant="outline" className="h-10 gap-2" onClick={() => setConferenciaDialogOpen(true)}>
                  <CheckSquare className="h-4 w-4" />Conferência de cartão
                </Button>
                <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditId(null); resetForm(); } }}>
                  <DialogTrigger asChild>
                    <Button className="h-10 gap-2"><Plus className="h-4 w-4" />Novo recebível</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editId ? "Editar Recebível" : "Novo Recebível"}</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  {!editId && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">Importar com IA</p>
                          <p className="text-xs text-muted-foreground">Leia um arquivo ou imagem e revise os recebíveis encontrados.</p>
                        </div>
                      </div>
                      <SmartImportButtons edgeFunctionName="parse-receivables-import" onDataExtracted={handleImportData} />
                    </div>
                  )}
                  <div>
                    <Label>Cliente *</Label>
                    <ClienteAutocompleteInput
                      value={form.cliente}
                      onChange={(nome) => setForm({ ...form, cliente: nome })}
                    />
                  </div>
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

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 gap-2">
                      <Download className="h-4 w-4" />Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={exportToExcel}><Download className="h-4 w-4 mr-2" />Exportar Excel</DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToPDF}><Download className="h-4 w-4 mr-2" />Exportar PDF</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(240px,1fr)_180px_190px_auto] md:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 pl-9"
                  placeholder="Buscar cliente, título, pedido ou descrição..."
                  value={filtroNome}
                  onChange={(e) => setFiltroNome(e.target.value)}
                />
              </div>
              <Select value={quickStatusValue} onValueChange={handleQuickStatusChange}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Situação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="abertas">Situação: abertas</SelectItem>
                  <SelectItem value="todos">Situação: todas</SelectItem>
                  <SelectItem value="vencida">Vencidas</SelectItem>
                  <SelectItem value="a_receber">A vencer</SelectItem>
                  <SelectItem value="recebida">Recebidas</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={quickPeriodValue} onValueChange={handleQuickPeriodChange}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Vencimento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Vencimento: todos</SelectItem>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="mes_atual">Mês atual</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="h-10 gap-2" onClick={() => setAdvancedSearchOpen(true)}>
                <SlidersHorizontal className="h-4 w-4" />Filtros
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{filtered.length} registro{filtered.length !== 1 ? "s" : ""} no filtro atual</span>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <Button variant="ghost" onClick={clearAllFilters} className="h-8 gap-1 px-2 text-xs">
                    <X className="h-3.5 w-3.5" /> Limpar filtros
                  </Button>
                )}
              </div>
            </div>

            <Dialog open={advancedSearchOpen} onOpenChange={setAdvancedSearchOpen}>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader><DialogTitle>Busca avançada</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Busca geral</Label>
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar cliente, descrição, vale..."
                        value={filtroNome}
                        onChange={e => setFiltroNome(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Vencimento inicial</Label>
                      <Input type="date" value={dataInicial} onChange={e => setDataInicial(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Vencimento final</Label>
                      <Input type="date" value={dataFinal} onChange={e => setDataFinal(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Atalhos de período</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { k: "hoje", l: "Hoje" },
                        { k: "7d", l: "Últimos 7 dias" },
                        { k: "mes_atual", l: "Mês atual" },
                        { k: "mes_passado", l: "Mes passado" },
                        { k: "30d", l: "Últimos 30 dias" },
                        { k: "90d", l: "Últimos 90 dias" },
                        { k: "ano", l: "Este ano" },
                        { k: "limpar", l: "Sem periodo" },
                      ].map(p => (
                        <Button key={p.k} variant="outline" size="sm" type="button" onClick={() => aplicarPresetPeriodo(p.k as any)}>{p.l}</Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <div className="rounded-lg border p-2">
                        {([
                          { k: "a_receber", l: "A receber", icon: Clock },
                          { k: "vencida", l: "Vencidas", icon: AlertCircle },
                          { k: "recebida", l: "Recebidas", icon: CheckCircle2 },
                        ] as const).map(s => {
                          const Icon = s.icon;
                          return (
                            <button key={s.k} type="button" onClick={() => toggleStatus(s.k)}
                              className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent">
                              <Checkbox checked={filtroStatus.has(s.k)} className="pointer-events-none" />
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              {s.l}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Forma de pagamento</Label>
                      <div className="max-h-52 overflow-y-auto rounded-lg border p-2">
                        {FORMA_FILTER_OPTIONS.map(o => (
                          <button key={o.value} type="button" onClick={() => toggleForma(o.value)}
                            className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent">
                            <Checkbox checked={filtroFormas.has(o.value)} className="pointer-events-none" />
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={clearAllFilters}>Limpar</Button>
                    <Button onClick={() => setAdvancedSearchOpen(false)}><Search className="h-4 w-4 mr-2" />Aplicar busca</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Chips de filtros ativos */}
            {(filtroNome || dataInicial || dataFinal || filtroFormas.size > 0 || filtroStatus.size !== 2 || ![...filtroStatus].every(s => s === "a_receber" || s === "vencida")) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {filtroNome && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  "{filtroNome}"
                  <button onClick={() => setFiltroNome("")} className="hover:bg-background rounded p-0.5"><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {(dataInicial || dataFinal) && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  {dataInicial && format(new Date(dataInicial + "T12:00:00"), "dd/MM/yy")} → {dataFinal && format(new Date(dataFinal + "T12:00:00"), "dd/MM/yy")}
                  <button onClick={() => { setDataInicial(""); setDataFinal(""); }} className="hover:bg-background rounded p-0.5"><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {[...filtroStatus].map(s => (
                <Badge key={s} variant="secondary" className="gap-1 pr-1">
                  {s === "a_receber" ? "A Receber" : s === "vencida" ? "Vencidas" : "Recebidas"}
                  <button onClick={() => toggleStatus(s)} className="hover:bg-background rounded p-0.5"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              {[...filtroFormas].map(f => (
                <Badge key={f} variant="outline" className="gap-1 pr-1">
                  {FORMA_LABELS[f]}
                  <button onClick={() => toggleForma(f)} className="hover:bg-background rounded p-0.5"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
          )}
          </div>
        </div>

        <Card>
          <CardContent className="p-0 md:p-4">
            {renderTable()}
          </CardContent>
        </Card>

        <Dialog open={conferenciaDialogOpen} onOpenChange={setConferenciaDialogOpen}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
            <DialogHeader>
              <DialogTitle>Conferência de cartão</DialogTitle>
            </DialogHeader>
            <ConferenciaCartao />
          </DialogContent>
        </Dialog>

        <Dialog open={!!detalheConta} onOpenChange={(open) => !open && setDetalheConta(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            {detalheConta && (() => {
              const vencida = detalheConta.status === "pendente" && detalheConta.vencimento < hoje;
              const displayStatus = vencida ? "Vencida" : detalheConta.status === "recebida" ? "Recebida" : "Pendente";
              const boletoStatus = getBoletoEmissaoStatus(detalheConta);
              return (
                <>
                  <DialogHeader>
                    <DialogTitle>Detalhes do recebivel</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4 pt-2">
                    <div className="rounded-xl border bg-muted/30 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm text-muted-foreground">Cliente</p>
                          <p className="truncate text-lg font-semibold">{detalheConta.parceiro_nome || detalheConta.cliente}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{detalheConta.descricao}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-2xl font-bold">R$ {Number(detalheConta.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                          <Badge variant={displayStatus === "Recebida" ? "default" : displayStatus === "Vencida" ? "destructive" : "secondary"}>{displayStatus}</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Vencimento</p>
                        <p className="font-medium">{format(new Date(detalheConta.vencimento + "T12:00:00"), "dd/MM/yyyy")}</p>
                        {(() => { const a = agingLabel(detalheConta); return a ? <p className={`text-xs ${a.cls}`}>{a.text}</p> : null; })()}
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Forma</p>
                        <p className="font-medium">{detalheConta.forma_pagamento || "-"}</p>
                        {boletoStatus === "pendente_emissao" && <Badge variant="warning" className="mt-1 text-[10px]">Pendente de emissao</Badge>}
                        {boletoStatus === "emitido" && <Badge variant="info" className="mt-1 text-[10px]">Boleto emitido</Badge>}
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Data da venda</p>
                        <p className="font-medium">{detalheConta.data_venda ? format(new Date(detalheConta.data_venda), "dd/MM/yyyy") : "-"}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Referencia</p>
                        <p className="font-medium">{detalheConta.vale_numero ? `Vale ${detalheConta.vale_numero}` : detalheConta.pedido_id ? `Pedido ${detalheConta.pedido_id}` : "-"}</p>
                      </div>
                    </div>

                    {detalheConta.endereco_cliente && (
                      <div className="rounded-lg border p-3 text-sm">
                        <p className="text-xs text-muted-foreground">Endereco</p>
                        <p>{detalheConta.endereco_cliente}{detalheConta.bairro_cliente ? ` - ${detalheConta.bairro_cliente}` : ""}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {detalheConta.status !== "recebida" && (
                        <Button onClick={() => { const conta = detalheConta; setDetalheConta(null); openReceberDialog(conta); }}>
                          <DollarSign className="h-4 w-4 mr-2" />Liquidar / Receber
                        </Button>
                      )}
                      {detalheConta.status !== "recebida" && (
                        <Button variant="outline" onClick={() => { setAsaasConta(detalheConta); setDetalheConta(null); setAsaasDialogOpen(true); }}>
                          <Banknote className="h-4 w-4 mr-2" />
                          {detalheConta.asaas_charge_id ? "Ver boleto / PIX" : "Emitir boleto / PIX"}
                        </Button>
                      )}
                      {detalheConta.asaas_charge_id && detalheConta.boleto_url && (
                        <Button variant="outline" onClick={() => window.open(detalheConta.boleto_url!, "_blank", "noopener,noreferrer")}>
                          <Download className="h-4 w-4 mr-2" />Baixar 2a via
                        </Button>
                      )}
                      {detalheConta.asaas_charge_id && detalheConta.status !== "recebida" && (
                        <Button variant="outline" disabled={syncingId === detalheConta.id} onClick={() => sincronizarAsaas(detalheConta)}>
                          <RefreshCw className={`h-4 w-4 mr-2 ${syncingId === detalheConta.id ? "animate-spin" : ""}`} />Sincronizar Asaas
                        </Button>
                      )}
                      {detalheConta.status === "recebida" && podeEditarDataRecebimento && (
                        <Button variant="outline" onClick={() => { const conta = detalheConta; setDetalheConta(null); openEditDataRecDialog(conta); }}>
                          <Pencil className="h-4 w-4 mr-2" />Editar data
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => { const conta = detalheConta; setDetalheConta(null); handleEdit(conta); }}>
                        <Pencil className="h-4 w-4 mr-2" />Editar
                      </Button>
                      <Button variant="destructive" onClick={() => { setDeleteId(detalheConta.id); setDetalheConta(null); }}>
                        <Trash2 className="h-4 w-4 mr-2" />Excluir
                      </Button>
                    </div>
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>


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
                <div>
                  <Label className="text-sm">Data do Recebimento *</Label>
                  <Input
                    type="date"
                    className="mt-1"
                    min={(receberConta.data_venda || receberConta.created_at || "").slice(0, 10) || undefined}
                    max={getBrasiliaDateString()}
                    value={receberForm.dataRecebimento}
                    onChange={e => setReceberForm(prev => ({ ...prev, dataRecebimento: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Entre a data da venda e hoje.
                  </p>
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

        {/* Bulk Liquidation Dialog */}
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Liquidar em Lote</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <p className="text-sm font-medium">{selectedContas.length} conta(s) selecionada(s)</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {selectedContas.map(c => (
                    <div key={c.id} className="flex justify-between text-xs">
                      <span className="truncate mr-2">{c.cliente} — {c.descricao}</span>
                      <span className="font-medium whitespace-nowrap">R$ {Number(c.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-lg font-bold">R$ {selectedTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div>
                <Label>Forma de Pagamento (aplicada a todas)</Label>
                <Select value={bulkFormaPagamento} onValueChange={setBulkFormaPagamento}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data do Recebimento *</Label>
                <Input
                  type="date"
                  className="mt-1"
                  min={selectedContas.reduce<string>((acc, c) => {
                    const d = (c.data_venda || c.created_at || "").slice(0, 10);
                    return d > acc ? d : acc;
                  }, "") || undefined}
                  max={getBrasiliaDateString()}
                  value={bulkDataRecebimento}
                  onChange={e => setBulkDataRecebimento(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Entre a data da venda mais recente do lote e hoje.
                </p>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                Todas as contas serão marcadas como recebidas e o valor será creditado automaticamente no destino correto (Dinheiro → Caixa, outros → Conta Bancária).
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleBulkReceber} disabled={bulkProcessing || !bulkFormaPagamento}>
                  {bulkProcessing ? "Processando..." : `Liquidar ${selectedContas.length} conta(s)`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Editar data de recebimento (admin/gestor) */}
        <Dialog open={editDataRecDialogOpen} onOpenChange={setEditDataRecDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Editar data de recebimento</DialogTitle></DialogHeader>
            {editDataRecConta && (
              <div className="space-y-4 pt-2">
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-sm font-medium">{editDataRecConta.cliente}</p>
                  <p className="text-xs text-muted-foreground">{editDataRecConta.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    Data atual: {editDataRecConta.data_recebimento
                      ? format(new Date(editDataRecConta.data_recebimento + "T12:00:00"), "dd/MM/yyyy")
                      : "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm">Nova data *</Label>
                  <Input
                    type="date"
                    className="mt-1"
                    min={(editDataRecConta.data_venda || editDataRecConta.created_at || "").slice(0, 10) || undefined}
                    max={getBrasiliaDateString()}
                    value={editDataRecValue}
                    onChange={e => setEditDataRecValue(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    A alteração será registrada nas observações da conta.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditDataRecDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSalvarEditDataRec} disabled={editDataRecSaving}>
                    {editDataRecSaving ? "Salvando..." : "Salvar"}
                  </Button>
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
      {asaasConta && (
        <EmitirBoletoAsaasDialog
          open={asaasDialogOpen}
          onOpenChange={setAsaasDialogOpen}
          conta={asaasConta as any}
          onSuccess={fetchContas}
        />
      )}
    </MainLayout>
  );
}

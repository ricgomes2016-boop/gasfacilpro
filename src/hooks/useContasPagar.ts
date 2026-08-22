import { useState, useEffect, useRef } from "react";
import { getBrasiliaDateString } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { resolveCategoriaDespesaNome, useCategoriasDespesa } from "@/hooks/useCategoriasDespesa";
import { normalizeFinanceText } from "@/lib/financeiro/financeiroClassificacao";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ContaPagar {
  id: string;
  fornecedor: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: string;
  categoria: string | null;
  observacoes: string | null;
  created_at: string;
  boleto_url: string | null;
  boleto_codigo_barras: string | null;
  boleto_linha_digitavel: string | null;
  /** Campos reais da tabela usados na listagem */
  data_pagamento?: string | null;
  forma_pagamento?: string | null;
  origem?: string | null;
  parcela_numero?: number | null;
  parcela_total?: number | null;
  grupo_parcela_id?: string | null;
  compra_id?: string | null;
  conta_bancaria_id?: string | null;
  unidade_id?: string | null;
}

export type StatusContaPagar = "paga" | "vencida" | "pendente";

/** Status normalizado (reconhece "paga"/"pago") + vencimento vs. hoje. */
export function getStatusContaPagar(
  conta: Pick<ContaPagar, "status" | "vencimento">,
  hoje: string,
): StatusContaPagar {
  const s = normalizeFinanceText(conta.status);
  if (s === "paga" || s === "pago" || s === "quitada" || s === "quitado") return "paga";
  if (conta.vencimento && conta.vencimento < hoje) return "vencida";
  return "pendente";
}

export const isContaPaga = (conta: Pick<ContaPagar, "status">) => {
  const s = normalizeFinanceText(conta.status);
  return s === "paga" || s === "pago" || s === "quitada" || s === "quitado";
};

export interface FornecedorCadastro {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  tipo: string | null;
  ativo: boolean | null;
}

export const FORMAS_PAGAMENTO = ["Boleto", "PIX", "Transferência", "Dinheiro", "Cartão", "Cheque"];

const EMPTY_FORM = { fornecedor: "", descricao: "", valor: "", vencimento: "", categoria: "", observacoes: "" };


export function useContasPagar() {
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const { categorias: categoriasDB, nomes: categoriasNomes } = useCategoriasDespesa();
  const hoje = getBrasiliaDateString();

  // ------- Core data -------
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fornecedoresCadastro, setFornecedoresCadastro] = useState<FornecedorCadastro[]>([]);

  // ------- UI / dialog state -------
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pagarDialogOpen, setPagarDialogOpen] = useState(false);
  const [pagarConta, setPagarConta] = useState<ContaPagar | null>(null);
  const [pagamentoEmLoteIds, setPagamentoEmLoteIds] = useState<Set<string>>(new Set());
  const [selecionadasPagamentoIds, setSelecionadasPagamentoIds] = useState<Set<string>>(new Set());
  const [resumoOpen, setResumoOpen] = useState(false);
  const [agrupar, setAgrupar] = useState(false);
  const [unificarDialogOpen, setUnificarDialogOpen] = useState(false);
  const [parcelamentoOpen, setParcelamentoOpen] = useState(false);

  // ------- Filters -------
  const mesAtual = getMesAtualRange();
  const [dataInicial, setDataInicial] = useState(mesAtual.inicio);
  const [dataFinal, setDataFinal] = useState(mesAtual.fim);
  const [filtroStatus, setFiltroStatus] = useState("abertas");
  const [filtroFornecedor, setFiltroFornecedor] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");

  /** Restaura o período de competência (vencimento) para o mês atual. */
  const aplicarMesAtual = () => {
    const r = getMesAtualRange();
    setDataInicial(r.inicio);
    setDataFinal(r.fim);
  };
  const isMesAtual = dataInicial === mesAtual.inicio && dataFinal === mesAtual.fim;

  // ------- Forms -------
  const [form, setForm] = useState(EMPTY_FORM);
  const [pagarForm, setPagarForm] = useState<{ formasPagamento: { forma: string; valor: string; origemTipo: string; origemId: string }[] }>({
    formasPagamento: [{ forma: "", valor: "", origemTipo: "", origemId: "" }],
  });
  const [contasBancarias, setContasBancarias] = useState<Array<{ id: string; nome: string; banco: string; saldo_atual: number }>>([]);


  // ------- Consolidation -------
  const [selectedFornecedor, setSelectedFornecedor] = useState<string | null>(null);
  const [selectedContasIds, setSelectedContasIds] = useState<Set<string>>(new Set());
  const [unificarVencimento, setUnificarVencimento] = useState("");
  const [unificarObservacoes, setUnificarObservacoes] = useState("");

  // ------- Boleto -------
  const [boletoDialogOpen, setBoletoDialogOpen] = useState(false);
  const [boletoProcessing, setBoletoProcessing] = useState(false);
  const [boletoPreview, setBoletoPreview] = useState<string | null>(null);
  const [boletoData, setBoletoData] = useState<any>(null);
  const [boletoFile, setBoletoFile] = useState<File | null>(null);
  const [viewBoletoUrl, setViewBoletoUrl] = useState<string | null>(null);
  const [viewBoletoConta, setViewBoletoConta] = useState<ContaPagar | null>(null);
  const boletoInputRef = useRef<HTMLInputElement>(null);
  const boletoPdfInputRef = useRef<HTMLInputElement>(null);

  // ------- Photo AI -------
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [extractedExpenses, setExtractedExpenses] = useState<Array<{
    fornecedor: string; descricao: string; valor: number; vencimento: string; categoria: string; observacoes: string | null;
  }>>([]);
  const [reviewMode, setReviewMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ------- Voice -------
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);
  const recognitionRef = useRef<any>(null);

  // ===================== DATA FETCHING =====================

  const fetchContas = async () => {
    setLoading(true);
    let query = supabase.from("contas_pagar").select("*").order("vencimento", { ascending: true });
    if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
    const { data, error } = await query;
    if (error) {
      toast.error("Erro ao carregar contas");
      console.error(error);
      setLoadError(error.message || "Falha ao carregar contas a pagar");
    } else {
      setLoadError(null);
      setContas((data as ContaPagar[]) || []);
    }
    setLoading(false);
  };


  const fetchContasBancarias = async () => {
    let q = supabase.from("contas_bancarias").select("id, nome, banco, saldo_atual").eq("ativo", true).order("nome");
    if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
    const { data } = await q;
    setContasBancarias((data as any) || []);
  };

  const fetchFornecedores = async () => {
    const { data, error } = await supabase
      .from("fornecedores")
      .select("id,razao_social,nome_fantasia,cnpj,tipo,ativo")
      .eq("ativo", true)
      .order("razao_social");
    if (error) {
      console.error(error);
      return;
    }
    setFornecedoresCadastro((data as FornecedorCadastro[]) || []);
  };

  useEffect(() => { fetchContas(); fetchContasBancarias(); fetchFornecedores(); }, [unidadeAtual]);


  // ===================== COMPUTED (derived state) =====================

  const fornecedoresUnicos = [...new Set([
    ...fornecedoresCadastro.map(f => f.razao_social),
    ...contas.map(c => c.fornecedor),
  ])].sort();
  const categoriasUnicas = [...new Set(contas.map(c => c.categoria).filter(Boolean))].sort() as string[];

  /**
   * Escopo da visão SEM o filtro de status — base correta para KPIs.
   * Assim o card "Pagas" nunca zera só porque a tabela está em "Abertas".
   */
  const scopeFiltered = contas.filter(c => {
    const termo = search.trim().toLowerCase();
    const matchSearch = !termo ||
      c.fornecedor.toLowerCase().includes(termo) ||
      c.descricao.toLowerCase().includes(termo) ||
      (c.observacoes || "").toLowerCase().includes(termo);
    const matchDataIni = !dataInicial || c.vencimento >= dataInicial;
    const matchDataFim = !dataFinal || c.vencimento <= dataFinal;
    const matchFornecedor = filtroFornecedor === "todos" || c.fornecedor === filtroFornecedor;
    const matchCategoria = filtroCategoria === "todos" || (c.categoria || "") === filtroCategoria;
    return matchSearch && matchDataIni && matchDataFim && matchFornecedor && matchCategoria;
  });

  const matchesStatusFiltro = (c: ContaPagar) => {
    const statusAtual = getStatusContaPagar(c, hoje);
    return (
      filtroStatus === "todos" ||
      (filtroStatus === "abertas" && statusAtual !== "paga") ||
      statusAtual === filtroStatus
    );
  };

  const filtered = scopeFiltered.filter(matchesStatusFiltro);

  const totalPendente = scopeFiltered.filter(c => getStatusContaPagar(c, hoje) === "pendente").reduce((a, c) => a + Number(c.valor), 0);
  const totalVencido = scopeFiltered.filter(c => getStatusContaPagar(c, hoje) === "vencida").reduce((a, c) => a + Number(c.valor), 0);
  const totalPago = scopeFiltered.filter(c => isContaPaga(c)).reduce((a, c) => a + Number(c.valor), 0);
  const totalAberto = totalPendente + totalVencido;


  const hasActiveFilters = !!(dataInicial || dataFinal || filtroStatus !== "abertas" || filtroFornecedor !== "todos" || filtroCategoria !== "todos");

  const resumoPorFornecedor = (() => {
    const pendentes = contas.filter(c => !isContaPaga(c));
    const grouped: Record<string, { total: number; count: number; vencidas: number }> = {};
    pendentes.forEach(c => {
      if (!grouped[c.fornecedor]) grouped[c.fornecedor] = { total: 0, count: 0, vencidas: 0 };
      grouped[c.fornecedor].total += Number(c.valor);
      grouped[c.fornecedor].count++;
      if (c.vencimento < hoje) grouped[c.fornecedor].vencidas++;
    });
    return Object.entries(grouped)
      .map(([fornecedor, data]) => ({ fornecedor, ...data }))
      .sort((a, b) => b.total - a.total);
  })();

  const fornecedoresComMultiplas = (() => {
    const pendentes = contas.filter(c => c.status === "pendente");
    const grouped: Record<string, ContaPagar[]> = {};
    pendentes.forEach(c => {
      const key = c.fornecedor.trim().toLowerCase();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    });
    return Object.entries(grouped)
      .filter(([, items]) => items.length >= 2)
      .map(([, items]) => ({
        fornecedor: items[0].fornecedor,
        contas: items,
        total: items.reduce((s, c) => s + Number(c.valor), 0),
      }))
      .sort((a, b) => b.total - a.total);
  })();

  const groupedFiltered = (() => {
    if (!agrupar) return null;
    const groups: Record<string, ContaPagar[]> = {};
    filtered.forEach(c => {
      if (!groups[c.fornecedor]) groups[c.fornecedor] = [];
      groups[c.fornecedor].push(c);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  })();

  const contasSelecionadasPagamento = contas.filter(c => selecionadasPagamentoIds.has(c.id));
  const totalSelecionadoPagamento = contasSelecionadasPagamento.reduce((s, c) => s + Number(c.valor), 0);
  const contasPagaveisFiltradas = filtered.filter(c => !isContaPaga(c));
  const todasPagaveisSelecionadas = contasPagaveisFiltradas.length > 0 && contasPagaveisFiltradas.every(c => selecionadasPagamentoIds.has(c.id));

  // ===================== CRUD =====================

  const resetForm = () => setForm(EMPTY_FORM);

  const handleSubmit = async () => {
    if (!form.fornecedor || !form.descricao || !form.valor || !form.vencimento) {
      toast.error("Preencha os campos obrigatórios"); return;
    }
    const categoriaCadastro = resolveCategoriaDespesaNome(form.categoria, categoriasDB);
    if (!categoriaCadastro) {
      toast.error("Selecione uma categoria de despesa cadastrada"); return;
    }
    const payload = {
      fornecedor: form.fornecedor, descricao: form.descricao,
      valor: parseFloat(form.valor), vencimento: form.vencimento,
      categoria: categoriaCadastro, observacoes: form.observacoes || null,
      unidade_id: unidadeAtual?.id || null,
    };
    if (editId) {
      const { error } = await supabase.from("contas_pagar").update(payload).eq("id", editId);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Conta atualizada!"); setDialogOpen(false); setEditId(null); resetForm(); fetchContas();
    } else {
      const { error } = await supabase.from("contas_pagar").insert(payload);
      if (error) { toast.error("Erro ao criar conta"); return; }
      toast.success("Conta criada!"); setDialogOpen(false); resetForm(); fetchContas();
    }
  };

  const handleEdit = (conta: ContaPagar) => {
    setEditId(conta.id);
    setForm({
      fornecedor: conta.fornecedor, descricao: conta.descricao,
      valor: String(conta.valor), vencimento: conta.vencimento,
      categoria: conta.categoria || "", observacoes: conta.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("contas_pagar").delete().eq("id", deleteId);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Conta excluída!"); fetchContas(); }
    setDeleteId(null);
  };

  // ===================== PAGAR =====================

  const openPagarDialog = (conta: ContaPagar) => {
    setPagamentoEmLoteIds(new Set());
    setPagarConta(conta);
    setPagarForm({ formasPagamento: [{ forma: "", valor: String(conta.valor), origemTipo: "", origemId: "" }] });
    setPagarDialogOpen(true);
  };

  const togglePagamentoSelection = (id: string) => {
    setSelecionadasPagamentoIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllPagamentoSelection = () => {
    setSelecionadasPagamentoIds(prev => {
      const next = new Set(prev);
      if (contasPagaveisFiltradas.every(c => next.has(c.id))) contasPagaveisFiltradas.forEach(c => next.delete(c.id));
      else contasPagaveisFiltradas.forEach(c => next.add(c.id));
      return next;
    });
  };

  const clearPagamentoSelection = () => setSelecionadasPagamentoIds(new Set());

  const openPagarSelecionadasDialog = () => {
    if (contasSelecionadasPagamento.length === 0) { toast.error("Selecione ao menos uma conta pendente"); return; }
    const selecionadasAbertas = contasSelecionadasPagamento.filter(c => !isContaPaga(c));
    if (selecionadasAbertas.length === 0) { toast.error("As contas selecionadas já estão pagas"); return; }
    const total = selecionadasAbertas.reduce((s, c) => s + Number(c.valor), 0);
    setPagamentoEmLoteIds(new Set(selecionadasAbertas.map(c => c.id)));
    setPagarConta({ ...selecionadasAbertas[0], fornecedor: `${selecionadasAbertas.length} contas selecionadas`, descricao: "Pagamento em lote", valor: total });
    setPagarForm({ formasPagamento: [{ forma: "", valor: String(total), origemTipo: "", origemId: "" }] });
    setPagarDialogOpen(true);
  };

  const handlePagar = async () => {
    if (!pagarConta) return;
    const totalPago = pagarForm.formasPagamento.reduce((sum, f) => sum + (parseFloat(f.valor) || 0), 0);
    const isLote = pagamentoEmLoteIds.size > 0;
    const contasLote = contas.filter(c => pagamentoEmLoteIds.has(c.id));
    const valorConta = isLote ? contasLote.reduce((s, c) => s + Number(c.valor), 0) : Number(pagarConta.valor);
    if (totalPago <= 0) { toast.error("Informe o valor pago"); return; }
    if (totalPago > valorConta + 0.01) { toast.error("Valor pago excede o valor da conta"); return; }

    const formasValidas = pagarForm.formasPagamento.filter(f => f.forma && parseFloat(f.valor) > 0);
    for (const f of formasValidas) {
      if (!f.origemTipo) { toast.error(`Informe de qual conta sairá o pagamento (${f.forma})`); return; }
      if (f.origemTipo === "banco" && !f.origemId) { toast.error("Selecione a conta bancária"); return; }
    }

    const isParcial = totalPago < valorConta - 0.01;
    const formasStr = formasValidas.map(f => `${f.forma}: R$ ${parseFloat(f.valor).toFixed(2)}`).join(", ");

    if (isLote && isParcial) { toast.error("Pagamento em lote precisa quitar o total selecionado"); return; }

    const payload = formasValidas.map(f => ({
      forma: f.forma,
      valor: parseFloat(f.valor),
      origem_tipo: f.origemTipo,
      origem_id: f.origemId || null,
    }));

    if (isLote) {
      // Rateia proporcionalmente cada conta do lote nas mesmas formas — paga via RPC uma a uma
      for (const c of contasLote) {
        const proporcao = Number(c.valor) / valorConta;
        const pags = payload.map(p => ({ ...p, valor: Number((p.valor * proporcao).toFixed(2)) }));
        const { error } = await supabase.rpc("registrar_pagamento_conta_pagar" as any, {
          p_conta_id: c.id, p_pagamentos: pags, p_quitar: true,
        });
        if (error) { toast.error(`Erro ao pagar ${c.fornecedor}: ${error.message}`); return; }
      }
      toast.success(`${contasLote.length} contas pagas! Saldos atualizados.`);
      setSelecionadasPagamentoIds(new Set());
      setPagamentoEmLoteIds(new Set());
    } else if (isParcial) {
      const restante = valorConta - totalPago;
      const { error } = await supabase.rpc("registrar_pagamento_conta_pagar" as any, {
        p_conta_id: pagarConta.id, p_pagamentos: payload, p_quitar: false,
      });
      if (error) { toast.error(`Erro: ${error.message}`); return; }
      const obs = `${pagarConta.observacoes || ""}\nPago parcial R$ ${totalPago.toFixed(2)} em ${format(new Date(), "dd/MM/yyyy")} (${formasStr})`.trim();
      await supabase.from("contas_pagar").update({ valor: restante, observacoes: obs }).eq("id", pagarConta.id);
      toast.success(`Pago R$ ${totalPago.toFixed(2)} — Restante: R$ ${restante.toFixed(2)}`);
    } else {
      const { error } = await supabase.rpc("registrar_pagamento_conta_pagar" as any, {
        p_conta_id: pagarConta.id, p_pagamentos: payload, p_quitar: true,
      });
      if (error) { toast.error(`Erro ao confirmar pagamento: ${error.message}`); return; }
      toast.success("Conta paga! Saldo atualizado.");
    }
    setPagarDialogOpen(false);
    fetchContas();
  };

  const addFormaPagamento = () => setPagarForm(prev => ({ ...prev, formasPagamento: [...prev.formasPagamento, { forma: "", valor: "", origemTipo: "", origemId: "" }] }));
  const removeFormaPagamento = (idx: number) => setPagarForm(prev => ({ ...prev, formasPagamento: prev.formasPagamento.filter((_, i) => i !== idx) }));
  const updateFormaPagamento = (idx: number, field: "forma" | "valor" | "origemTipo" | "origemId", value: string) =>
    setPagarForm(prev => ({ ...prev, formasPagamento: prev.formasPagamento.map((f, i) => {
      if (i !== idx) return f;
      const next = { ...f, [field]: value };
      if (field === "forma") {
        // Auto-detect origem tipo by forma
        const formaLow = value.toLowerCase();
        if (formaLow.includes("dinheiro")) { next.origemTipo = "caixa"; next.origemId = ""; }
        else if (formaLow.includes("cartão") || formaLow.includes("cartao")) { next.origemTipo = "cartao"; next.origemId = ""; }
        else { next.origemTipo = "banco"; }
      }
      return next;
    }) }));


  // ===================== FILTERS =====================

  const clearAllFilters = () => {
    setDataInicial(""); setDataFinal(""); setFiltroStatus("abertas");
    setFiltroFornecedor("todos"); setFiltroCategoria("todos");
  };

  // ===================== CONSOLIDATION =====================

  const openUnificarDialog = () => {
    setSelectedFornecedor(null); setSelectedContasIds(new Set());
    setUnificarVencimento(""); setUnificarObservacoes("");
    setUnificarDialogOpen(true);
  };

  const selectFornecedor = (fornecedor: string) => {
    setSelectedFornecedor(fornecedor);
    const grupo = fornecedoresComMultiplas.find(f => f.fornecedor === fornecedor);
    if (grupo) {
      setSelectedContasIds(new Set(grupo.contas.map(c => c.id)));
      const d = new Date(); d.setDate(d.getDate() + 7);
      setUnificarVencimento(d.toISOString().split("T")[0]);
    }
  };

  const toggleContaSelection = (id: string) => {
    setSelectedContasIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleUnificar = async () => {
    if (!selectedFornecedor || selectedContasIds.size < 2) { toast.error("Selecione ao menos 2 contas para unificar"); return; }
    if (!unificarVencimento) { toast.error("Informe a data de vencimento"); return; }
    const grupo = fornecedoresComMultiplas.find(f => f.fornecedor === selectedFornecedor);
    if (!grupo) return;
    const contasSelecionadas = grupo.contas.filter(c => selectedContasIds.has(c.id));
    const totalUnificado = contasSelecionadas.reduce((s, c) => s + Number(c.valor), 0);
    const detalhes = contasSelecionadas.map(c =>
      `• ${c.descricao} — R$ ${Number(c.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (venc. ${format(new Date(c.vencimento + "T12:00:00"), "dd/MM/yyyy")})`
    ).join("\n");
    const obsUnificada = `${unificarObservacoes ? unificarObservacoes + "\n\n" : ""}--- Detalhamento ---\n${detalhes}`;
    const { error: insertError } = await supabase.from("contas_pagar").insert({
      fornecedor: selectedFornecedor, descricao: `Conta unificada (${contasSelecionadas.length} itens)`,
      valor: totalUnificado, vencimento: unificarVencimento,
      categoria: contasSelecionadas[0].categoria || null, observacoes: obsUnificada,
      unidade_id: unidadeAtual?.id || null,
    });
    if (insertError) { toast.error("Erro ao criar conta unificada"); return; }
    await supabase.from("contas_pagar")
      .update({ status: "paga", observacoes: `Unificada em ${format(new Date(), "dd/MM/yyyy")}` })
      .in("id", contasSelecionadas.map(c => c.id));
    toast.success(`${contasSelecionadas.length} contas unificadas! Total: R$ ${totalUnificado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    setUnificarDialogOpen(false);
    fetchContas();
  };

  // ===================== BOLETO =====================

  const handleBoletoCapture = async (e: React.ChangeEvent<HTMLInputElement>, isPdf = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBoletoFile(file); setBoletoDialogOpen(true); setBoletoProcessing(true); setBoletoData(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      if (!isPdf) setBoletoPreview(base64); else setBoletoPreview(null);
      try {
        const { data, error } = await supabase.functions.invoke("parse-boleto", { body: { imageBase64: base64, isPdf } });
        if (error) throw error;
        setBoletoData({
          fornecedor: data.fornecedor || "", descricao: data.descricao || "",
          valor: data.valor || 0, vencimento: data.vencimento || "",
          codigo_barras: data.codigo_barras || "", linha_digitavel: data.linha_digitavel || "",
          categoria: resolveCategoriaDespesaNome(data.categoria, categoriasDB), observacoes: data.observacoes || "",
        });
        toast.success("Boleto lido com sucesso!");
      } catch { toast.error("Erro ao ler o boleto. Tente novamente."); }
      finally { setBoletoProcessing(false); }
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = "";
  };

  const handleSaveBoleto = async () => {
    if (!boletoData?.fornecedor || !boletoData?.valor) { toast.error("Fornecedor e valor são obrigatórios"); return; }
    const categoriaBoleto = resolveCategoriaDespesaNome(boletoData.categoria, categoriasDB);
    if (!categoriaBoleto) { toast.error("Selecione uma categoria de despesa cadastrada para o boleto"); return; }
    let boletoUrl: string | null = null;
    if (boletoFile) {
      if (!empresa?.id) { toast.error("Empresa não identificada para salvar o boleto"); return; }
      const ext = boletoFile.name.split(".").pop() || "pdf";
      const fileName = `${empresa.id}/boletos/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("boletos").upload(fileName, boletoFile);
      if (!uploadError) {
        boletoUrl = fileName;
      }
    }
    const { error } = await supabase.from("contas_pagar").insert({
      fornecedor: boletoData.fornecedor, descricao: boletoData.descricao,
      valor: boletoData.valor, vencimento: boletoData.vencimento || getBrasiliaDateString(),
      categoria: categoriaBoleto, observacoes: boletoData.observacoes || null,
      boleto_url: boletoUrl, boleto_codigo_barras: boletoData.codigo_barras || null,
      boleto_linha_digitavel: boletoData.linha_digitavel || null,
      unidade_id: unidadeAtual?.id || null,
    });
    if (error) { toast.error("Erro ao salvar boleto"); return; }
    toast.success("Boleto importado com sucesso!");
    setBoletoDialogOpen(false); setBoletoData(null); setBoletoFile(null); setBoletoPreview(null);
    fetchContas();
  };

  const handleViewBoleto = async (conta: ContaPagar) => {
    setViewBoletoConta(conta);
    if (conta.boleto_url) {
      const urlParts = conta.boleto_url.split("/boletos/");
      const storagePath = urlParts.length > 1 ? decodeURIComponent(urlParts[1]) : conta.boleto_url;
      if (!/^https?:\/\//i.test(storagePath)) {
        const { data } = await supabase.storage.from("boletos").createSignedUrl(storagePath, 3600);
        setViewBoletoUrl(data?.signedUrl || conta.boleto_url);
      } else { setViewBoletoUrl(conta.boleto_url); }
    }
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado!"); };

  // ===================== PHOTO AI =====================

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setPhotoPreview(base64); setPhotoDialogOpen(true);
      setPhotoProcessing(true); setReviewMode(false); setExtractedExpenses([]);
      try {
        const { data, error } = await supabase.functions.invoke("parse-expense-photo", { body: { imageBase64: base64 } });
        if (error) throw error;
        const despesas = data?.despesas || [data];
        setExtractedExpenses(despesas.map((d: any) => ({
          fornecedor: d.fornecedor || "", descricao: d.descricao || "",
          valor: d.valor || 0, vencimento: d.vencimento || "",
          categoria: resolveCategoriaDespesaNome(d.categoria, categoriasDB), observacoes: d.observacoes || null,
        })));
        setReviewMode(true);
        toast.success(`${despesas.length} despesa(s) identificada(s)!`);
      } catch { toast.error("Erro ao processar a imagem. Tente novamente."); }
      finally { setPhotoProcessing(false); }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSaveExtracted = async () => {
    const valid = extractedExpenses.filter(d => d.fornecedor && d.valor > 0 && resolveCategoriaDespesaNome(d.categoria, categoriasDB));
    if (valid.length === 0) { toast.error("Nenhuma despesa válida para salvar"); return; }
    const { error } = await supabase.from("contas_pagar").insert(valid.map(d => ({
      fornecedor: d.fornecedor, descricao: d.descricao, valor: d.valor,
      vencimento: d.vencimento || getBrasiliaDateString(), categoria: resolveCategoriaDespesaNome(d.categoria, categoriasDB),
      observacoes: d.observacoes || null, unidade_id: unidadeAtual?.id || null,
    })));
    if (error) { toast.error("Erro ao salvar despesas"); return; }
    toast.success(`${valid.length} despesa(s) salva(s) com sucesso!`);
    setPhotoDialogOpen(false); setExtractedExpenses([]); setPhotoPreview(null);
    fetchContas();
  };

  const updateExtractedField = (idx: number, field: string, value: any) =>
    setExtractedExpenses(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));

  const removeExtracted = (idx: number) =>
    setExtractedExpenses(prev => prev.filter((_, i) => i !== idx));

  // ===================== VOICE =====================

  const startVoiceListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { toast.error("Seu navegador não suporta reconhecimento de voz"); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR"; recognition.continuous = false;
    recognition.interimResults = true; recognition.maxAlternatives = 1;
    recognition.onstart = () => { setVoiceListening(true); setVoiceText(""); setVoiceDialogOpen(true); };
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      setVoiceText(transcript);
    };
    recognition.onend = () => setVoiceListening(false);
    recognition.onerror = (event: any) => {
      setVoiceListening(false);
      if (event.error === "not-allowed") toast.error("Permissão de microfone negada");
      else if (event.error !== "aborted") toast.error("Erro no reconhecimento de voz");
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoiceListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setVoiceListening(false);
  };

  const processVoiceCommand = async () => {
    if (!voiceText.trim()) { toast.error("Nenhum texto capturado"); return; }
    setVoiceProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-expense-voice", { body: { text: voiceText } });
      if (error) throw error;
      const despesas = data?.despesas || [data];
      setExtractedExpenses(despesas.map((d: any) => ({
        fornecedor: d.fornecedor || "", descricao: d.descricao || "",
        valor: d.valor || 0, vencimento: d.vencimento || "",
        categoria: resolveCategoriaDespesaNome(d.categoria, categoriasDB), observacoes: d.observacoes || null,
      })));
      setReviewMode(true); setVoiceDialogOpen(false); setPhotoDialogOpen(true);
      toast.success(`${despesas.length} despesa(s) identificada(s) por voz!`);
    } catch { toast.error("Erro ao interpretar o comando de voz"); }
    finally { setVoiceProcessing(false); }
  };

  // ===================== EXPORT =====================

  const exportToExcel = () => {
    const data = filtered.map(c => ({
      Fornecedor: c.fornecedor, Descrição: c.descricao, Categoria: c.categoria || "—",
      Vencimento: format(new Date(c.vencimento + "T12:00:00"), "dd/MM/yyyy"),
      Valor: `R$ ${Number(c.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      Status: { paga: "Paga", vencida: "Vencida", pendente: "Pendente" }[getStatusContaPagar(c, hoje)],
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas a Pagar");
    XLSX.writeFile(wb, `contas_pagar_${format(new Date(), "ddMMyyyy_HHmm")}.xlsx`);
    toast.success("Arquivo Excel exportado!");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("Contas a Pagar", 14, 15);
    doc.setFontSize(10); doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 22);
    autoTable(doc, {
      head: [["Fornecedor", "Descrição", "Categoria", "Vencimento", "Valor", "Status"]],
      body: filtered.map(c => [
        c.fornecedor, c.descricao, c.categoria || "—",
        format(new Date(c.vencimento + "T12:00:00"), "dd/MM/yyyy"),
        `R$ ${Number(c.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        { paga: "Paga", vencida: "Vencida", pendente: "Pendente" }[getStatusContaPagar(c, hoje)],
      ]),
      startY: 30, styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [51, 65, 85], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    doc.save(`contas_pagar_${format(new Date(), "ddMMyyyy_HHmm")}.pdf`);
    toast.success("PDF exportado!");
  };

  return {
    // data
    contas, loading, loadError, categoriasNomes, fornecedoresCadastro, hoje,
    // computed
    filtered, scopeFiltered, matchesStatusFiltro, totalPendente, totalVencido, totalPago, totalAberto,
    resumoPorFornecedor, fornecedoresComMultiplas, groupedFiltered,
    fornecedoresUnicos, categoriasUnicas, hasActiveFilters,
    // filters
    search, setSearch, dataInicial, setDataInicial, dataFinal, setDataFinal,
    filtroStatus, setFiltroStatus, filtroFornecedor, setFiltroFornecedor,
    filtroCategoria, setFiltroCategoria, clearAllFilters, agrupar, setAgrupar,
    // CRUD form
    dialogOpen, setDialogOpen, editId, setEditId, form, setForm, resetForm,
    handleSubmit, handleEdit, deleteId, setDeleteId, handleDelete,
    // pagar
    pagarDialogOpen, setPagarDialogOpen, pagarConta, pagarForm, openPagarDialog,
    handlePagar, addFormaPagamento, removeFormaPagamento, updateFormaPagamento,
    selecionadasPagamentoIds, contasSelecionadasPagamento, totalSelecionadoPagamento,
    todasPagaveisSelecionadas, togglePagamentoSelection, toggleAllPagamentoSelection,
    clearPagamentoSelection, openPagarSelecionadasDialog, pagamentoEmLoteIds,
    // resumo
    resumoOpen, setResumoOpen,
    // unificar
    unificarDialogOpen, setUnificarDialogOpen, selectedFornecedor, selectedContasIds,
    unificarVencimento, setUnificarVencimento, unificarObservacoes, setUnificarObservacoes,
    openUnificarDialog, selectFornecedor, toggleContaSelection, handleUnificar,
    parcelamentoOpen, setParcelamentoOpen,
    // boleto
    boletoDialogOpen, setBoletoDialogOpen, boletoProcessing, boletoPreview,
    boletoData, setBoletoData, boletoInputRef, boletoPdfInputRef,
    viewBoletoUrl, setViewBoletoUrl, viewBoletoConta, setViewBoletoConta,
    handleBoletoCapture, handleSaveBoleto, handleViewBoleto, copyToClipboard,
    // photo AI
    photoDialogOpen, setPhotoDialogOpen, photoProcessing, photoPreview,
    extractedExpenses, reviewMode, fileInputRef,
    handlePhotoCapture, handleSaveExtracted, updateExtractedField, removeExtracted,
    // voice
    voiceListening, voiceText, voiceProcessing, voiceDialogOpen, setVoiceDialogOpen,
    startVoiceListening, stopVoiceListening, processVoiceCommand,
    // export
    exportToExcel, exportToPDF,
    // refresh
    fetchContas,
    // contas bancárias para origem do pagamento
    contasBancarias,
  };

}

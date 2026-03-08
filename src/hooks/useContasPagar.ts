import { useState, useEffect, useRef } from "react";
import { getBrasiliaDateString } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
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
}

export interface CategoriaDesp {
  id: string;
  nome: string;
  grupo: string;
  ativo: boolean;
}

export const FORMAS_PAGAMENTO = ["Boleto", "PIX", "Transferência", "Dinheiro", "Cartão", "Cheque"];
export const CATEGORIAS_FALLBACK = ["Fornecedores", "Frota", "Infraestrutura", "Utilidades", "RH", "Compras", "Outros"];

const EMPTY_FORM = { fornecedor: "", descricao: "", valor: "", vencimento: "", categoria: "", observacoes: "" };

export function useContasPagar() {
  const { unidadeAtual } = useUnidade();
  const hoje = getBrasiliaDateString();

  // ------- Core data -------
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriasDB, setCategoriasDB] = useState<CategoriaDesp[]>([]);

  // ------- UI / dialog state -------
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pagarDialogOpen, setPagarDialogOpen] = useState(false);
  const [pagarConta, setPagarConta] = useState<ContaPagar | null>(null);
  const [resumoOpen, setResumoOpen] = useState(false);
  const [agrupar, setAgrupar] = useState(false);
  const [unificarDialogOpen, setUnificarDialogOpen] = useState(false);
  const [parcelamentoOpen, setParcelamentoOpen] = useState(false);

  // ------- Filters -------
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroFornecedor, setFiltroFornecedor] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");

  // ------- Forms -------
  const [form, setForm] = useState(EMPTY_FORM);
  const [pagarForm, setPagarForm] = useState<{ formasPagamento: { forma: string; valor: string }[] }>({
    formasPagamento: [{ forma: "", valor: "" }],
  });

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
    if (error) { toast.error("Erro ao carregar contas"); console.error(error); }
    else setContas((data as ContaPagar[]) || []);
    setLoading(false);
  };

  const fetchCategorias = async () => {
    const { data } = await supabase.from("categorias_despesa").select("id,nome,grupo,ativo").eq("ativo", true).order("ordem");
    if (data) setCategoriasDB(data as CategoriaDesp[]);
  };

  useEffect(() => { fetchContas(); fetchCategorias(); }, [unidadeAtual]);

  // ===================== COMPUTED (derived state) =====================

  const categoriasNomes = categoriasDB.length > 0
    ? categoriasDB.filter(c => c.ativo).map(c => c.nome)
    : CATEGORIAS_FALLBACK;

  const fornecedoresUnicos = [...new Set(contas.map(c => c.fornecedor))].sort();
  const categoriasUnicas = [...new Set(contas.map(c => c.categoria).filter(Boolean))].sort() as string[];

  const filtered = contas.filter(c => {
    const matchSearch = c.fornecedor.toLowerCase().includes(search.toLowerCase()) ||
      c.descricao.toLowerCase().includes(search.toLowerCase());
    const matchDataIni = !dataInicial || c.vencimento >= dataInicial;
    const matchDataFim = !dataFinal || c.vencimento <= dataFinal;
    const isVencida = (c.status === "pendente" || c.status === "vencida") && c.vencimento < hoje;
    const statusAtual = c.status === "paga" ? "paga" : isVencida ? "vencida" : c.status;
    const matchStatus = filtroStatus === "todos" || statusAtual === filtroStatus;
    const matchFornecedor = filtroFornecedor === "todos" || c.fornecedor === filtroFornecedor;
    const matchCategoria = filtroCategoria === "todos" || (c.categoria || "") === filtroCategoria;
    return matchSearch && matchDataIni && matchDataFim && matchStatus && matchFornecedor && matchCategoria;
  });

  const totalPendente = filtered.filter(c => c.status === "pendente" && c.vencimento >= hoje).reduce((a, c) => a + Number(c.valor), 0);
  const totalVencido = filtered.filter(c => (c.status === "pendente" || c.status === "vencida") && c.vencimento < hoje).reduce((a, c) => a + Number(c.valor), 0);
  const totalPago = filtered.filter(c => c.status === "paga").reduce((a, c) => a + Number(c.valor), 0);
  const totalAberto = totalPendente + totalVencido;

  const hasActiveFilters = !!(dataInicial || dataFinal || filtroStatus !== "todos" || filtroFornecedor !== "todos" || filtroCategoria !== "todos");

  const resumoPorFornecedor = (() => {
    const pendentes = contas.filter(c => c.status !== "paga");
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

  // ===================== CRUD =====================

  const resetForm = () => setForm(EMPTY_FORM);

  const handleSubmit = async () => {
    if (!form.fornecedor || !form.descricao || !form.valor || !form.vencimento) {
      toast.error("Preencha os campos obrigatórios"); return;
    }
    const payload = {
      fornecedor: form.fornecedor, descricao: form.descricao,
      valor: parseFloat(form.valor), vencimento: form.vencimento,
      categoria: form.categoria || null, observacoes: form.observacoes || null,
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
    setPagarConta(conta);
    setPagarForm({ formasPagamento: [{ forma: "", valor: String(conta.valor) }] });
    setPagarDialogOpen(true);
  };

  const handlePagar = async () => {
    if (!pagarConta) return;
    const totalPago = pagarForm.formasPagamento.reduce((sum, f) => sum + (parseFloat(f.valor) || 0), 0);
    const valorConta = Number(pagarConta.valor);
    if (totalPago <= 0) { toast.error("Informe o valor pago"); return; }
    if (totalPago > valorConta + 0.01) { toast.error("Valor pago excede o valor da conta"); return; }

    const isParcial = totalPago < valorConta - 0.01;
    const formasStr = pagarForm.formasPagamento
      .filter(f => f.forma && parseFloat(f.valor) > 0)
      .map(f => `${f.forma}: R$ ${parseFloat(f.valor).toFixed(2)}`).join(", ");

    if (isParcial) {
      const restante = valorConta - totalPago;
      const obs = `${pagarConta.observacoes || ""}\nPago parcial R$ ${totalPago.toFixed(2)} em ${format(new Date(), "dd/MM/yyyy")} (${formasStr})`.trim();
      const { error } = await supabase.from("contas_pagar").update({ valor: restante, observacoes: obs }).eq("id", pagarConta.id);
      if (error) { toast.error("Erro ao processar pagamento parcial"); return; }
      toast.success(`Pago R$ ${totalPago.toFixed(2)} — Restante: R$ ${restante.toFixed(2)}`);
    } else {
      const { error } = await supabase.from("contas_pagar").update({
        status: "paga",
        observacoes: formasStr ? `${pagarConta.observacoes || ""}\nPago via ${formasStr}`.trim() : pagarConta.observacoes,
      }).eq("id", pagarConta.id);
      if (error) { toast.error("Erro ao confirmar pagamento"); return; }
      toast.success("Conta paga integralmente!");
    }
    setPagarDialogOpen(false);
    fetchContas();
  };

  const addFormaPagamento = () => setPagarForm(prev => ({ ...prev, formasPagamento: [...prev.formasPagamento, { forma: "", valor: "" }] }));
  const removeFormaPagamento = (idx: number) => setPagarForm(prev => ({ ...prev, formasPagamento: prev.formasPagamento.filter((_, i) => i !== idx) }));
  const updateFormaPagamento = (idx: number, field: "forma" | "valor", value: string) =>
    setPagarForm(prev => ({ ...prev, formasPagamento: prev.formasPagamento.map((f, i) => i === idx ? { ...f, [field]: value } : f) }));

  // ===================== FILTERS =====================

  const clearAllFilters = () => {
    setDataInicial(""); setDataFinal(""); setFiltroStatus("todos");
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
          categoria: data.categoria || "Outros", observacoes: data.observacoes || "",
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
    let boletoUrl: string | null = null;
    if (boletoFile) {
      const ext = boletoFile.name.split(".").pop() || "pdf";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("boletos").upload(fileName, boletoFile);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("boletos").getPublicUrl(fileName);
        boletoUrl = urlData.publicUrl;
      }
    }
    const { error } = await supabase.from("contas_pagar").insert({
      fornecedor: boletoData.fornecedor, descricao: boletoData.descricao,
      valor: boletoData.valor, vencimento: boletoData.vencimento || getBrasiliaDateString(),
      categoria: boletoData.categoria || null, observacoes: boletoData.observacoes || null,
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
      if (urlParts.length > 1) {
        const { data } = await supabase.storage.from("boletos").createSignedUrl(urlParts[1], 3600);
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
          categoria: d.categoria || "Outros", observacoes: d.observacoes || null,
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
    const valid = extractedExpenses.filter(d => d.fornecedor && d.valor > 0);
    if (valid.length === 0) { toast.error("Nenhuma despesa válida para salvar"); return; }
    const { error } = await supabase.from("contas_pagar").insert(valid.map(d => ({
      fornecedor: d.fornecedor, descricao: d.descricao, valor: d.valor,
      vencimento: d.vencimento || getBrasiliaDateString(), categoria: d.categoria || null,
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
        categoria: d.categoria || "Outros", observacoes: d.observacoes || null,
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
      Status: c.status === "paga" ? "Paga" : (c.status === "pendente" || c.status === "vencida") && c.vencimento < hoje ? "Vencida" : "Pendente",
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
        c.status === "paga" ? "Paga" : (c.status === "pendente" || c.status === "vencida") && c.vencimento < hoje ? "Vencida" : "Pendente",
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
    contas, loading, categoriasNomes, hoje,
    // computed
    filtered, totalPendente, totalVencido, totalPago, totalAberto,
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
  };
}

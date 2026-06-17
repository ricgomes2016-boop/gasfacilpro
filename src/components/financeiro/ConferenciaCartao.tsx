import { useState, useEffect, useRef } from "react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  CreditCard, Plus, CheckCircle2, AlertCircle, Clock, Settings, Trash2, Search,
  DollarSign, TrendingDown, Filter, X, FileUp, Loader2, Smartphone, Banknote, QrCode,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDateString } from "@/lib/utils";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format, addDays } from "date-fns";
import { TerminalQRCodeDialog } from "./TerminalQRCodeDialog";
interface Operadora {
  id: string;
  nome: string;
  bandeira: string | null;
  taxa_debito: number;
  taxa_credito_vista: number;
  taxa_credito_parcelado: number;
  prazo_debito: number;
  prazo_credito: number;
  ativo: boolean;
}

interface ConferenciaItem {
  id: string;
  tipo: string;
  bandeira: string | null;
  valor_bruto: number;
  taxa_percentual: number;
  valor_taxa: number;
  valor_liquido_esperado: number;
  valor_liquido_recebido: number | null;
  data_venda: string;
  data_prevista_deposito: string | null;
  data_deposito_real: string | null;
  nsu: string | null;
  autorizacao: string | null;
  parcelas: number;
  status: string;
  observacoes: string | null;
  operadora_id: string | null;
  pedido_id: string | null;
  terminal_id: string | null;
  operadora_nome?: string;
  terminal_nome?: string;
}

const BANDEIRAS = ["Visa", "Mastercard", "Elo", "Hipercard", "Amex", "Outras"];

interface TerminalItem {
  id?: string;
  nome: string;
  numero_serie: string;
  modelo: string;
  isNew?: boolean;
}

export function ConferenciaCartao() {
  const { unidadeAtual } = useUnidade();
  const [activeTab, setActiveTab] = useState("conferencia");

  // Operadoras
  const [operadoras, setOperadoras] = useState<Operadora[]>([]);
  const [opDialogOpen, setOpDialogOpen] = useState(false);
  const [opEditId, setOpEditId] = useState<string | null>(null);
  const [opForm, setOpForm] = useState({
    nome: "", bandeira: "", taxa_debito: "", taxa_credito_vista: "",
    taxa_credito_parcelado: "", prazo_debito: "0", prazo_credito: "0",
    taxa_pix: "", prazo_pix: "0",
  });
  const [opDeleteId, setOpDeleteId] = useState<string | null>(null);
  const [qrTerminalId, setQrTerminalId] = useState<string | null>(null);

  // Terminais por operadora
  const [opTerminais, setOpTerminais] = useState<TerminalItem[]>([]);
  const [allTerminais, setAllTerminais] = useState<Record<string, TerminalItem[]>>({});

  // Conferencia
  const [itens, setItens] = useState<ConferenciaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confDialogOpen, setConfDialogOpen] = useState(false);
  const [confForm, setConfForm] = useState({
    tipo: "credito", bandeira: "", valor_bruto: "", operadora_id: "",
    nsu: "", autorizacao: "", parcelas: "1", data_venda: getBrasiliaDateString(),
    observacoes: "", terminal_id: "",
  });
  const [confirmarId, setConfirmarId] = useState<string | null>(null);
  const [valorRecebido, setValorRecebido] = useState("");
  const [dataDeposito, setDataDeposito] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroBandeira, setFiltroBandeira] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroTerminal, setFiltroTerminal] = useState("todos");
  const [deleteConfId, setDeleteConfId] = useState<string | null>(null);

  // Batch conciliation
  const [selectedConfIds, setSelectedConfIds] = useState<Set<string>>(new Set());
  const [conciliandoLote, setConciliandoLote] = useState(false);
  // PDF import
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<any[]>([]);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfOperadora, setPdfOperadora] = useState("");
  const [pdfImporting, setPdfImporting] = useState(false);

  const fetchOperadoras = async () => {
    let query = supabase.from("operadoras_cartao").select("*").eq("ativo", true);
    if (unidadeAtual?.id) query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
    const { data } = await query;
    const ops = (data as Operadora[]) || [];
    setOperadoras(ops);

    // Fetch terminais for all operadoras
    if (ops.length > 0) {
      const { data: termsData } = await supabase
        .from("terminais_cartao")
        .select("id, nome, numero_serie, modelo, operadora_id")
        .in("operadora_id", ops.map(o => o.id));
      const grouped: Record<string, TerminalItem[]> = {};
      (termsData || []).forEach((t: any) => {
        if (!grouped[t.operadora_id]) grouped[t.operadora_id] = [];
        grouped[t.operadora_id].push({ id: t.id, nome: t.nome, numero_serie: t.numero_serie || "", modelo: t.modelo || "" });
      });
      setAllTerminais(grouped);
    }
  };

  const fetchItens = async () => {
    setLoading(true);
    let query = supabase.from("conferencia_cartao")
      .select("*, operadoras_cartao(nome), terminais_cartao(nome)")
      .order("data_venda", { ascending: false });
    if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
    const { data, error } = await query;
    if (error) { toast.error("Erro ao carregar conferência"); console.error(error); }
    else {
      setItens((data || []).map((d: any) => ({
        ...d,
        operadora_nome: d.operadoras_cartao?.nome || "—",
        terminal_nome: d.terminais_cartao?.nome || null,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchOperadoras(); fetchItens(); }, [unidadeAtual]);

  // --- Operadoras CRUD ---
  const resetOpForm = () => {
    setOpForm({
      nome: "", bandeira: "", taxa_debito: "", taxa_credito_vista: "",
      taxa_credito_parcelado: "", prazo_debito: "0", prazo_credito: "0",
      taxa_pix: "", prazo_pix: "0",
    });
    setOpTerminais([]);
  };

  const addTerminalRow = () => {
    setOpTerminais(prev => [...prev, { nome: "", numero_serie: "", modelo: "", isNew: true }]);
  };

  const removeTerminalRow = (idx: number) => {
    setOpTerminais(prev => prev.filter((_, i) => i !== idx));
  };

  const updateTerminalRow = (idx: number, field: keyof TerminalItem, value: string) => {
    setOpTerminais(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const handleOpSubmit = async () => {
    if (!opForm.nome) { toast.error("Nome obrigatório"); return; }
    const payload = {
      nome: opForm.nome,
      bandeira: opForm.bandeira || null,
      taxa_debito: parseFloat(opForm.taxa_debito) || 0,
      taxa_credito_vista: parseFloat(opForm.taxa_credito_vista) || 0,
      taxa_credito_parcelado: parseFloat(opForm.taxa_credito_parcelado) || 0,
      prazo_debito: parseInt(opForm.prazo_debito) || 0,
      prazo_credito: parseInt(opForm.prazo_credito) || 0,
      taxa_pix: parseFloat(opForm.taxa_pix) || 0,
      prazo_pix: parseInt(opForm.prazo_pix) || 0,
      unidade_id: unidadeAtual?.id || null,
    };

    let operadoraId = opEditId;

    if (opEditId) {
      const { error } = await supabase.from("operadoras_cartao").update(payload).eq("id", opEditId);
      if (error) { toast.error("Erro ao atualizar"); return; }
    } else {
      const { data, error } = await supabase.from("operadoras_cartao").insert(payload).select("id").single();
      if (error) { toast.error("Erro ao criar"); return; }
      operadoraId = data.id;
    }

    // Save terminais
    if (operadoraId) {
      // Delete removed terminals (those in allTerminais but not in opTerminais)
      const existingIds = (allTerminais[operadoraId] || []).map(t => t.id).filter(Boolean);
      const keepIds = opTerminais.filter(t => t.id).map(t => t.id);
      const toDelete = existingIds.filter(id => !keepIds.includes(id));
      if (toDelete.length > 0) {
        await supabase.from("terminais_cartao").delete().in("id", toDelete as string[]);
      }

      // Insert new terminals
      const newTerminals = opTerminais.filter(t => t.isNew && t.nome.trim());
      if (newTerminals.length > 0) {
        const rows = newTerminals.map(t => ({
          nome: t.nome,
          numero_serie: t.numero_serie || null,
          modelo: t.modelo || null,
          operadora: opForm.nome,
          operadora_id: operadoraId,
          unidade_id: unidadeAtual?.id || null,
          status: "ativo",
        }));
        await supabase.from("terminais_cartao").insert(rows);
      }

      // Update existing terminals
      const existing = opTerminais.filter(t => t.id && !t.isNew);
      for (const t of existing) {
        await supabase.from("terminais_cartao").update({
          nome: t.nome,
          numero_serie: t.numero_serie || null,
          modelo: t.modelo || null,
        }).eq("id", t.id!);
      }
    }

    toast.success(opEditId ? "Operadora atualizada!" : "Operadora cadastrada!");
    setOpDialogOpen(false); setOpEditId(null); resetOpForm(); fetchOperadoras();
  };

  const handleOpDelete = async () => {
    if (!opDeleteId) return;
    const { error } = await supabase.from("operadoras_cartao").update({ ativo: false }).eq("id", opDeleteId);
    if (error) toast.error("Erro ao desativar");
    else { toast.success("Operadora desativada!"); fetchOperadoras(); }
    setOpDeleteId(null);
  };

  // --- Conferência CRUD ---
  const handleConfSubmit = async () => {
    const valorBruto = parseFloat(confForm.valor_bruto);
    if (!valorBruto || valorBruto <= 0) { toast.error("Informe o valor bruto"); return; }

    const operadora = operadoras.find(o => o.id === confForm.operadora_id);
    let taxaPct = 0;
    if (operadora) {
      if (confForm.tipo === "pix_maquininha") taxaPct = (operadora as any).taxa_pix || 0;
      else if (confForm.tipo === "debito") taxaPct = operadora.taxa_debito;
      else if (parseInt(confForm.parcelas) > 1) taxaPct = operadora.taxa_credito_parcelado;
      else taxaPct = operadora.taxa_credito_vista;
    }

    const valorTaxa = valorBruto * (taxaPct / 100);
    const valorLiquidoEsperado = valorBruto - valorTaxa;

    const prazo = operadora
      ? (confForm.tipo === "pix_maquininha" ? ((operadora as any).prazo_pix || 0) : confForm.tipo === "debito" ? operadora.prazo_debito : operadora.prazo_credito)
      : (confForm.tipo === "pix_maquininha" ? 0 : confForm.tipo === "debito" ? 0 : 0);
    const dataPrevista = addDays(new Date(confForm.data_venda), prazo);

    const payload = {
      tipo: confForm.tipo,
      bandeira: confForm.bandeira || null,
      valor_bruto: valorBruto,
      taxa_percentual: taxaPct,
      valor_taxa: valorTaxa,
      valor_liquido_esperado: valorLiquidoEsperado,
      data_venda: confForm.data_venda,
      data_prevista_deposito: format(dataPrevista, "yyyy-MM-dd"),
      nsu: confForm.nsu || null,
      autorizacao: confForm.autorizacao || null,
      parcelas: parseInt(confForm.parcelas) || 1,
      operadora_id: confForm.operadora_id || null,
      terminal_id: confForm.terminal_id || null,
      observacoes: confForm.observacoes || null,
      unidade_id: unidadeAtual?.id || null,
    };

    const { error } = await supabase.from("conferencia_cartao").insert(payload);
    if (error) { toast.error("Erro ao registrar"); console.error(error); return; }
    toast.success("Venda no cartão registrada!");
    setConfDialogOpen(false);
    setConfForm({
      tipo: "credito", bandeira: "", valor_bruto: "", operadora_id: "",
      nsu: "", autorizacao: "", parcelas: "1", data_venda: getBrasiliaDateString(),
      observacoes: "", terminal_id: "",
    });
    fetchItens();
  };

  const handleConfirmar = async () => {
    if (!confirmarId) return;
    const valor = parseFloat(valorRecebido);
    if (isNaN(valor) || valor <= 0) { toast.error("Informe o valor recebido"); return; }

    const item = itens.find(i => i.id === confirmarId);
    if (!item) return;

    const diff = Math.abs(valor - item.valor_liquido_esperado);
    const status = diff < 0.02 ? "confirmado" : "divergente";

    const { error } = await supabase.from("conferencia_cartao").update({
      valor_liquido_recebido: valor,
      data_deposito_real: dataDeposito || null,
      status,
    }).eq("id", confirmarId);

    if (error) { toast.error("Erro ao confirmar"); return; }
    toast.success(status === "confirmado" ? "Conferência confirmada!" : "Divergência detectada!");
    setConfirmarId(null); setValorRecebido(""); setDataDeposito(""); fetchItens();
  };

  const handleDeleteConf = async () => {
    if (!deleteConfId) return;
    const { error } = await supabase.from("conferencia_cartao").delete().eq("id", deleteConfId);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Registro excluído!"); fetchItens(); }
    setDeleteConfId(null);
  };

  const toggleConfSelect = (id: string) => {
    setSelectedConfIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // PDF Import
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > 10 * 1024 * 1024) {
      toast.error("PDF muito grande (máx 10MB)");
      return;
    }

    setPdfLoading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const resp = await supabase.functions.invoke("parse-card-statement-pdf", {
        body: { pdf_base64: base64 },
      });

      if (resp.error) throw resp.error;
      const { transacoes, operadora_detectada } = resp.data;

      if (!transacoes?.length) {
        toast.error("Nenhuma transação encontrada no PDF");
        return;
      }

      setPdfPreview(transacoes);
      if (operadora_detectada) {
        const match = operadoras.find(o => o.nome.toLowerCase().includes(operadora_detectada.toLowerCase()));
        if (match) setPdfOperadora(match.id);
      }
      setPdfDialogOpen(true);
      toast.success(`${transacoes.length} transação(ões) encontrada(s)!`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao processar PDF: " + (err.message || "erro desconhecido"));
    } finally {
      setPdfLoading(false);
    }
  };

  const importPdfTransactions = async () => {
    if (!pdfPreview.length) return;
    setPdfImporting(true);
    try {
      const op = operadoras.find(o => o.id === pdfOperadora);
      const rows = pdfPreview.map(t => {
        const valorBruto = Number(t.valor_bruto) || 0;
        let taxaPct = Number(t.taxa_percentual) || 0;
        let valorTaxa = Number(t.valor_taxa) || 0;
        let valorLiq = Number(t.valor_liquido) || 0;

        // If operator selected but no tax from PDF, calculate from operator
        if (op && taxaPct === 0) {
          const tipo = t.tipo || "credito";
          const parcelas = Number(t.parcelas) || 1;
          taxaPct = tipo === "debito" ? op.taxa_debito
            : parcelas > 1 ? op.taxa_credito_parcelado : op.taxa_credito_vista;
          valorTaxa = valorBruto * (taxaPct / 100);
          valorLiq = valorBruto - valorTaxa;
        }

        if (valorLiq === 0 && valorBruto > 0) valorLiq = valorBruto - valorTaxa;

        // Calculate deposit date
        let dataPrevista: string | null = null;
        if (t.data_deposito) {
          dataPrevista = t.data_deposito;
        } else if (op && t.data_venda) {
          const prazo = t.tipo === "debito" ? op.prazo_debito : op.prazo_credito;
          dataPrevista = format(addDays(new Date(t.data_venda), prazo), "yyyy-MM-dd");
        }

        return {
          tipo: t.tipo || "credito",
          bandeira: t.bandeira || null,
          valor_bruto: valorBruto,
          taxa_percentual: taxaPct,
          valor_taxa: valorTaxa,
          valor_liquido_esperado: valorLiq,
          data_venda: t.data_venda || getBrasiliaDateString(),
          data_prevista_deposito: dataPrevista,
          nsu: t.nsu || null,
          autorizacao: t.autorizacao || null,
          parcelas: Number(t.parcelas) || 1,
          operadora_id: pdfOperadora || null,
          observacoes: "Importado via PDF",
          unidade_id: unidadeAtual?.id || null,
        };
      });

      const { error } = await supabase.from("conferencia_cartao").insert(rows);
      if (error) throw error;

      toast.success(`${rows.length} transação(ões) importada(s)!`);
      setPdfDialogOpen(false);
      setPdfPreview([]);
      setPdfOperadora("");
      fetchItens();
    } catch (err: any) {
      toast.error("Erro ao importar: " + (err.message || "erro desconhecido"));
    } finally {
      setPdfImporting(false);
    }
  };


  const filtered = itens.filter(i => {
    if (filtroStatus !== "todos" && i.status !== filtroStatus) return false;
    if (filtroBandeira !== "todos" && i.bandeira !== filtroBandeira) return false;
    if (filtroTipo !== "todos" && i.tipo !== filtroTipo) return false;
    if (filtroTerminal !== "todos" && i.terminal_id !== filtroTerminal) return false;
    return true;
  });

  const hoje = getBrasiliaDateString();
  const totalBruto = filtered.reduce((a, i) => a + Number(i.valor_bruto), 0);
  const totalTaxas = filtered.reduce((a, i) => a + Number(i.valor_taxa), 0);
  const totalLiqEsperado = filtered.reduce((a, i) => a + Number(i.valor_liquido_esperado), 0);
  const totalPendente = filtered.filter(i => i.status === "pendente").reduce((a, i) => a + Number(i.valor_liquido_esperado), 0);
  const totalConfirmado = filtered.filter(i => i.status === "confirmado").reduce((a, i) => a + Number(i.valor_liquido_recebido || 0), 0);
  const totalDivergente = filtered.filter(i => i.status === "divergente").length;
  const aReceberHoje = itens.filter(i => i.data_prevista_deposito === hoje && i.status === "pendente")
    .reduce((a, i) => a + Number(i.valor_liquido_esperado), 0);

  const pendentesConf = filtered.filter(i => i.status === "pendente");

  const toggleConfSelectAll = () => {
    if (selectedConfIds.size === pendentesConf.length && pendentesConf.length > 0) {
      setSelectedConfIds(new Set());
    } else {
      setSelectedConfIds(new Set(pendentesConf.map(i => i.id)));
    }
  };

  const handleConciliarLote = async () => {
    if (selectedConfIds.size === 0) return;
    setConciliandoLote(true);
    let ok = 0;
    let fail = 0;
    for (const id of selectedConfIds) {
      const item = itens.find(i => i.id === id);
      if (!item || item.status !== "pendente") { fail++; continue; }
      const { error } = await supabase.from("conferencia_cartao").update({
        valor_liquido_recebido: item.valor_liquido_esperado,
        data_deposito_real: item.data_prevista_deposito || getBrasiliaDateString(),
        status: "confirmado",
      }).eq("id", id);
      if (error) fail++;
      else ok++;
    }
    setSelectedConfIds(new Set());
    setConciliandoLote(false);
    if (ok > 0) toast.success(`${ok} registro(s) conciliado(s) em lote!`);
    if (fail > 0) toast.error(`${fail} erro(s) na conciliação`);
    fetchItens();
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="conferencia" className="gap-1.5">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Conferência</span>
            <span className="sm:hidden">Conf.</span>
          </TabsTrigger>
          <TabsTrigger value="operadoras" className="gap-1.5">
            <Settings className="h-4 w-4" />
            Operadoras
          </TabsTrigger>
        </TabsList>

        {/* === CONFERÊNCIA === */}
        <TabsContent value="conferencia" className="space-y-4">
          <div className="flex items-center gap-2 justify-between flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" className="gap-2" onClick={() => setConfDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Registrar Venda Cartão</span>
                <span className="sm:hidden">Registrar</span>
              </Button>
              <Button size="sm" variant="pdf" className="gap-2" onClick={() => pdfInputRef.current?.click()} disabled={pdfLoading}>
                {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                <span className="hidden sm:inline">Importar PDF</span>
                <span className="sm:hidden">PDF</span>
              </Button>
              <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
              {selectedConfIds.size > 0 && (
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1.5"
                  onClick={handleConciliarLote}
                  disabled={conciliandoLote}
                >
                  {conciliandoLote ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  Conciliar {selectedConfIds.size} em lote
                </Button>
              )}
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 md:p-6 md:pb-2">
                <CardTitle className="text-xs md:text-sm font-medium">Total Bruto</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                <div className="text-lg md:text-2xl font-bold">R$ {totalBruto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 md:p-6 md:pb-2">
                <CardTitle className="text-xs md:text-sm font-medium">Taxas</CardTitle>
                <TrendingDown className="h-4 w-4 text-destructive hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                <div className="text-lg md:text-2xl font-bold text-destructive">R$ {totalTaxas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 md:p-6 md:pb-2">
                <CardTitle className="text-xs md:text-sm font-medium">Pendente</CardTitle>
                <Clock className="h-4 w-4 text-warning hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                <div className="text-lg md:text-2xl font-bold text-warning">R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                {aReceberHoje > 0 && (
                  <p className="text-[10px] md:text-xs text-primary">Hoje: R$ {aReceberHoje.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 md:p-6 md:pb-2">
                <CardTitle className="text-xs md:text-sm font-medium">Confirmado</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-success hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                <div className="text-lg md:text-2xl font-bold text-success">R$ {totalConfirmado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                {totalDivergente > 0 && (
                  <p className="text-[10px] md:text-xs text-destructive">{totalDivergente} divergência(s)</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="divergente">Divergente</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Tipos</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
                <SelectItem value="debito">Débito</SelectItem>
                <SelectItem value="pix_maquininha">PIX Maquininha</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroBandeira} onValueChange={setFiltroBandeira}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Bandeiras</SelectItem>
                {BANDEIRAS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroTerminal} onValueChange={setFiltroTerminal}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Maquininhas</SelectItem>
                {Object.values(allTerminais).flat().map(t => (
                  <SelectItem key={t.id} value={t.id!}>{t.nome}{t.numero_serie ? ` (${t.numero_serie})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0 md:p-6">
              {loading ? (
                <p className="text-center py-8 text-muted-foreground">Carregando...</p>
              ) : filtered.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhum registro de cartão</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedConfIds.size === pendentesConf.length && pendentesConf.length > 0}
                            onCheckedChange={toggleConfSelectAll}
                          />
                        </TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="hidden sm:table-cell">Bandeira</TableHead>
                        <TableHead className="hidden md:table-cell">Operadora</TableHead>
                        <TableHead>Bruto</TableHead>
                        <TableHead className="hidden sm:table-cell">Taxa</TableHead>
                        <TableHead>Líquido Esp.</TableHead>
                        <TableHead className="hidden lg:table-cell">Depósito Prev.</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(item => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.status === "pendente" ? (
                              <Checkbox
                                checked={selectedConfIds.has(item.id)}
                                onCheckedChange={() => toggleConfSelect(item.id)}
                              />
                            ) : <span className="w-4" />}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                            {format(new Date(item.data_venda + "T12:00:00"), "dd/MM/yy")}
                          </TableCell>
                          <TableCell>
                            {item.tipo === "gas_do_povo" ? (
                              <Badge className="text-[10px] sm:text-xs bg-info/15 text-info ring-1 ring-info/30 hover:bg-info/20">
                                🏛️ Gás do Povo
                              </Badge>
                            ) : (
                              <Badge variant={item.tipo === "credito" ? "default" : "secondary"} className="text-[10px] sm:text-xs">
                                {item.tipo === "credito" ? "Créd" : "Déb"}
                                {item.parcelas > 1 && ` ${item.parcelas}x`}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs">{item.bandeira || "—"}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs">{item.operadora_nome}</TableCell>
                          <TableCell className="font-medium text-xs sm:text-sm whitespace-nowrap">
                            R$ {Number(item.valor_bruto).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-destructive">
                            {Number(item.taxa_percentual).toFixed(2)}% (R$ {Number(item.valor_taxa).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                          </TableCell>
                          <TableCell className="font-medium text-xs sm:text-sm whitespace-nowrap">
                            R$ {Number(item.valor_liquido_esperado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs whitespace-nowrap">
                            {item.data_prevista_deposito
                              ? format(new Date(item.data_prevista_deposito + "T12:00:00"), "dd/MM/yy")
                              : "—"
                            }
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={item.status === "confirmado" ? "default" : item.status === "divergente" ? "destructive" : "secondary"}
                              className="text-[10px] sm:text-xs"
                            >
                              {item.status === "confirmado" ? "OK" : item.status === "divergente" ? "Diverg." : "Pend."}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-1 justify-end">
                              {item.status === "pendente" && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                  setConfirmarId(item.id);
                                  setValorRecebido(String(item.valor_liquido_esperado));
                                  setDataDeposito(item.data_prevista_deposito || "");
                                }}>
                                  <DollarSign className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfId(item.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {!loading && filtered.length > 0 && (
                <div className="px-3 md:px-0 py-3 text-xs text-muted-foreground border-t">
                  {filtered.length} registro(s) — Líquido total: R$ {totalLiqEsperado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === OPERADORAS === */}
        <TabsContent value="operadoras" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Configure operadoras, bandeiras e taxas</p>
            <Button size="sm" className="gap-2" onClick={() => { resetOpForm(); setOpEditId(null); setOpDialogOpen(true); }}>
              <Plus className="h-4 w-4" />Operadora
            </Button>
          </div>

          {operadoras.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma operadora cadastrada</p>
                <p className="text-xs mt-1">Cadastre para calcular taxas automaticamente</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {operadoras.map(op => (
                <Card key={op.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{op.nome}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {op.bandeira && <Badge variant="outline" className="text-[10px]">{op.bandeira}</Badge>}
                          {(allTerminais[op.id]?.length || 0) > 0 && (
                            <Badge variant="secondary" className="text-[10px] gap-0.5">
                              <Smartphone className="h-2.5 w-2.5" />
                              {allTerminais[op.id].length} terminal(is)
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                          setOpEditId(op.id);
                          setOpForm({
                            nome: op.nome, bandeira: op.bandeira || "",
                            taxa_debito: String(op.taxa_debito), taxa_credito_vista: String(op.taxa_credito_vista),
                            taxa_credito_parcelado: String(op.taxa_credito_parcelado),
                            prazo_debito: String(op.prazo_debito), prazo_credito: String(op.prazo_credito),
                            taxa_pix: String((op as any).taxa_pix || 0), prazo_pix: String((op as any).prazo_pix || 0),
                          });
                          setOpTerminais((allTerminais[op.id] || []).map(t => ({ ...t })));
                          setOpDialogOpen(true);
                        }}>
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setOpDeleteId(op.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2 rounded bg-muted/50">
                        <p className="text-muted-foreground">Débito</p>
                        <p className="font-medium">{Number(op.taxa_debito).toFixed(2)}%</p>
                        <p className="text-[10px] text-muted-foreground">D+{op.prazo_debito}</p>
                      </div>
                      <div className="p-2 rounded bg-muted/50">
                        <p className="text-muted-foreground">Créd. Vista</p>
                        <p className="font-medium">{Number(op.taxa_credito_vista).toFixed(2)}%</p>
                        <p className="text-[10px] text-muted-foreground">D+{op.prazo_credito}</p>
                      </div>
                      <div className="p-2 rounded bg-muted/50">
                        <p className="text-muted-foreground">Créd. Parc.</p>
                        <p className="font-medium">{Number(op.taxa_credito_parcelado).toFixed(2)}%</p>
                        <p className="text-[10px] text-muted-foreground">D+{op.prazo_credito}</p>
                      </div>
                      <div className="p-2 rounded bg-muted/50">
                        <p className="text-muted-foreground">PIX Maq.</p>
                        <p className="font-medium">{Number((op as any).taxa_pix || 0).toFixed(2)}%</p>
                        <p className="text-[10px] text-muted-foreground">D+{(op as any).prazo_pix || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Nova venda no cartão */}
      <Dialog open={confDialogOpen} onOpenChange={setConfDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar Venda no Cartão</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo *</Label>
                <Select value={confForm.tipo} onValueChange={v => setConfForm({ ...confForm, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credito">Crédito</SelectItem>
                    <SelectItem value="debito">Débito</SelectItem>
                    <SelectItem value="pix_maquininha">PIX Maquininha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bandeira</Label>
                <Select value={confForm.bandeira} onValueChange={v => setConfForm({ ...confForm, bandeira: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {BANDEIRAS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Bruto (R$) *</Label>
                <Input type="number" step="0.01" value={confForm.valor_bruto}
                  onChange={e => setConfForm({ ...confForm, valor_bruto: e.target.value })} />
              </div>
              <div>
                <Label>Operadora</Label>
                <Select value={confForm.operadora_id} onValueChange={v => setConfForm({ ...confForm, operadora_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {operadoras.map(op => <SelectItem key={op.id} value={op.id}>{op.nome}{op.bandeira ? ` (${op.bandeira})` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {confForm.operadora_id && (allTerminais[confForm.operadora_id]?.length || 0) > 0 && (
              <div>
                <Label>Maquininha (Terminal)</Label>
                <Select value={confForm.terminal_id} onValueChange={v => setConfForm({ ...confForm, terminal_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a maquininha" /></SelectTrigger>
                  <SelectContent>
                    {(allTerminais[confForm.operadora_id] || []).map(t => (
                      <SelectItem key={t.id} value={t.id!}>{t.nome}{t.numero_serie ? ` (${t.numero_serie})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {confForm.operadora_id && confForm.valor_bruto && (() => {
              const op = operadoras.find(o => o.id === confForm.operadora_id);
              if (!op) return null;
              const taxaPct = confForm.tipo === "debito" ? op.taxa_debito
                : parseInt(confForm.parcelas) > 1 ? op.taxa_credito_parcelado : op.taxa_credito_vista;
              const vb = parseFloat(confForm.valor_bruto) || 0;
              const taxaVal = vb * (taxaPct / 100);
              const liq = vb - taxaVal;
              const prazo = confForm.tipo === "debito" ? op.prazo_debito : op.prazo_credito;
              return (
                <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Taxa:</span><span className="text-destructive">{taxaPct.toFixed(2)}% = R$ {taxaVal.toFixed(2)}</span></div>
                  <div className="flex justify-between font-medium"><span>Líquido esperado:</span><span className="text-success">R$ {liq.toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Previsão depósito:</span><span>D+{prazo}</span></div>
                </div>
              );
            })()}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Parcelas</Label>
                <Input type="number" min="1" value={confForm.parcelas}
                  onChange={e => setConfForm({ ...confForm, parcelas: e.target.value })}
                  disabled={confForm.tipo === "debito"} />
              </div>
              <div>
                <Label>NSU</Label>
                <Input value={confForm.nsu} onChange={e => setConfForm({ ...confForm, nsu: e.target.value })} placeholder="Opcional" />
              </div>
              <div>
                <Label>Autorização</Label>
                <Input value={confForm.autorizacao} onChange={e => setConfForm({ ...confForm, autorizacao: e.target.value })} placeholder="Opcional" />
              </div>
            </div>
            <div>
              <Label>Data da Venda</Label>
              <Input type="date" value={confForm.data_venda} onChange={e => setConfForm({ ...confForm, data_venda: e.target.value })} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={confForm.observacoes} onChange={e => setConfForm({ ...confForm, observacoes: e.target.value })} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConfDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleConfSubmit}>Registrar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar recebimento */}
      <Dialog open={!!confirmarId} onOpenChange={() => { setConfirmarId(null); setValorRecebido(""); setDataDeposito(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirmar Recebimento</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Valor Recebido (R$)</Label>
              <Input type="number" step="0.01" value={valorRecebido} onChange={e => setValorRecebido(e.target.value)} />
            </div>
            <div>
              <Label>Data do Depósito</Label>
              <Input type="date" value={dataDeposito} onChange={e => setDataDeposito(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmarId(null)}>Cancelar</Button>
              <Button onClick={handleConfirmar}>Confirmar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Operadora */}
      <Dialog open={opDialogOpen} onOpenChange={v => { setOpDialogOpen(v); if (!v) { setOpEditId(null); resetOpForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{opEditId ? "Editar Operadora" : "Nova Operadora"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome *</Label><Input value={opForm.nome} onChange={e => setOpForm({ ...opForm, nome: e.target.value })} placeholder="Ex: Cielo" /></div>
              <div>
                <Label>Bandeira</Label>
                <Select value={opForm.bandeira} onValueChange={v => setOpForm({ ...opForm, bandeira: v })}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {BANDEIRAS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Taxa Débito (%)</Label><Input type="number" step="0.01" value={opForm.taxa_debito} onChange={e => setOpForm({ ...opForm, taxa_debito: e.target.value })} /></div>
              <div><Label>Taxa Créd. Vista (%)</Label><Input type="number" step="0.01" value={opForm.taxa_credito_vista} onChange={e => setOpForm({ ...opForm, taxa_credito_vista: e.target.value })} /></div>
              <div><Label>Taxa Créd. Parc. (%)</Label><Input type="number" step="0.01" value={opForm.taxa_credito_parcelado} onChange={e => setOpForm({ ...opForm, taxa_credito_parcelado: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prazo Débito (D+)</Label><Input type="number" min="0" value={opForm.prazo_debito} onChange={e => setOpForm({ ...opForm, prazo_debito: e.target.value })} placeholder="0" /></div>
              <div><Label>Prazo Crédito (D+)</Label><Input type="number" min="0" value={opForm.prazo_credito} onChange={e => setOpForm({ ...opForm, prazo_credito: e.target.value })} placeholder="0" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Taxa PIX Maquininha (%)</Label><Input type="number" step="0.01" min="0" value={opForm.taxa_pix} onChange={e => setOpForm({ ...opForm, taxa_pix: e.target.value })} placeholder="0.00" /></div>
              <div><Label>Prazo PIX Maq. (D+)</Label><Input type="number" min="0" value={opForm.prazo_pix} onChange={e => setOpForm({ ...opForm, prazo_pix: e.target.value })} placeholder="0" /></div>
            </div>

            {/* Terminais / Máquinas */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4" />
                  Terminais / Máquinas
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={addTerminalRow} className="gap-1 text-xs">
                  <Plus className="h-3 w-3" />Terminal
                </Button>
              </div>
              {opTerminais.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Nenhum terminal cadastrado. Clique em "+ Terminal" para adicionar.
                </p>
              ) : (
                <div className="space-y-2">
                  {opTerminais.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        <Input
                          placeholder="Nome/Apelido *"
                          className="h-8 text-xs"
                          value={t.nome}
                          onChange={e => updateTerminalRow(idx, "nome", e.target.value)}
                        />
                        <Input
                          placeholder="Nº Série/Terminal"
                          className="h-8 text-xs font-mono"
                          value={t.numero_serie}
                          onChange={e => updateTerminalRow(idx, "numero_serie", e.target.value)}
                        />
                        <Input
                          placeholder="Modelo"
                          className="h-8 text-xs"
                          value={t.modelo}
                          onChange={e => updateTerminalRow(idx, "modelo", e.target.value)}
                        />
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {t.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Gerar QR Code"
                            onClick={() => setQrTerminalId(t.id!)}
                          >
                            <QrCode className="h-3.5 w-3.5 text-primary" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removeTerminalRow(idx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setOpDialogOpen(false); setOpEditId(null); resetOpForm(); }}>Cancelar</Button>
              <Button onClick={handleOpSubmit}>{opEditId ? "Atualizar" : "Salvar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm deletes */}
      <AlertDialog open={!!opDeleteId} onOpenChange={() => setOpDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar operadora?</AlertDialogTitle>
            <AlertDialogDescription>A operadora será desativada e não aparecerá mais nas opções.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleOpDelete}>Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteConfId} onOpenChange={() => setDeleteConfId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConf}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: PDF Import Preview */}
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar Transações do PDF</DialogTitle>
            <DialogDescription>
              {pdfPreview.length} transação(ões) encontrada(s). Selecione a operadora e confirme.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Operadora (aplica taxas e prazos)</Label>
              <Select value={pdfOperadora} onValueChange={setPdfOperadora}>
                <SelectTrigger><SelectValue placeholder="Selecione a operadora" /></SelectTrigger>
                <SelectContent>
                  {operadoras.map(op => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.nome}{op.bandeira ? ` (${op.bandeira})` : ""} — D+{op.prazo_debito}/{op.prazo_credito}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="overflow-auto flex-1 border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-left font-medium">#</th>
                  <th className="p-2 text-left font-medium">Data</th>
                  <th className="p-2 text-left font-medium">Tipo</th>
                  <th className="p-2 text-left font-medium">Bandeira</th>
                  <th className="p-2 text-right font-medium">Bruto</th>
                  <th className="p-2 text-right font-medium">Taxa</th>
                  <th className="p-2 text-right font-medium">Líquido</th>
                  <th className="p-2 text-center font-medium">Parc.</th>
                </tr>
              </thead>
              <tbody>
                {pdfPreview.slice(0, 200).map((t, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 text-muted-foreground">{i + 1}</td>
                    <td className="p-2">{t.data_venda || "—"}</td>
                    <td className="p-2">
                      <Badge variant={t.tipo === "debito" ? "secondary" : "default"} className="text-[10px]">
                        {t.tipo === "debito" ? "Déb" : "Créd"}
                      </Badge>
                    </td>
                    <td className="p-2">{t.bandeira || "—"}</td>
                    <td className="p-2 text-right font-medium">R$ {Number(t.valor_bruto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right text-destructive">{Number(t.taxa_percentual || 0).toFixed(2)}%</td>
                    <td className="p-2 text-right font-medium text-success">R$ {Number(t.valor_liquido || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="p-2 text-center">{t.parcelas || 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total bruto: R$ {pdfPreview.reduce((a, t) => a + (Number(t.valor_bruto) || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            <span>Total líquido: R$ {pdfPreview.reduce((a, t) => a + (Number(t.valor_liquido) || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPdfDialogOpen(false)}>Cancelar</Button>
            <Button onClick={importPdfTransactions} disabled={pdfImporting}>
              {pdfImporting ? "Importando..." : `Importar ${pdfPreview.length} transação(ões)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Terminal QR Code Dialog */}
      {qrTerminalId && (
        <TerminalQRCodeDialog
          open={!!qrTerminalId}
          onClose={() => setQrTerminalId(null)}
          terminalId={qrTerminalId}
        />
      )}
    </div>
  );
}

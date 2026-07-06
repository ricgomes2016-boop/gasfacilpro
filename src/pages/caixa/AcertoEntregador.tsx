import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useFormasPagamentoCustom, useFormaPagamentoLabel } from "@/hooks/useFormasPagamentoCustom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User, Package, Wallet, Download, CreditCard, Banknote, Receipt, Minus, Pencil, Loader2, Save,
  QrCode, Keyboard, CheckCircle, AlertCircle, AlertTriangle, Plus, Trash2, FileText, Clock, History, Filter, Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDateString } from "@/lib/utils";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { QRCodeScanner } from "@/components/entregador/QRCodeScanner";
import { useToast } from "@/hooks/use-toast";
import { validarValeGasNoBanco } from "@/hooks/useValeGasValidation";
import { useValeGas } from "@/contexts/ValeGasContext";
import { rotearPagamentosVenda, PagamentoRoteamento } from "@/services/paymentRoutingService";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmitirBoletoAsaasDialog } from "@/components/financeiro/EmitirBoletoAsaasDialog";
import { CardOperatorSelectorModal } from "@/components/pagamento/CardOperatorSelectorModal";

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const paymentLabels: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  pix_maquininha: "PIX Maquininha",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  fiado: "Fiado",
  vale_gas: "Vale Gás",
  cheque: "Cheque",
  boleto: "Boleto",
  gas_do_povo: "Gás do Povo",
  Dinheiro: "Dinheiro",
  PIX: "PIX",
  "PIX Maquininha": "PIX Maquininha",
  "Cartão Crédito": "Cartão Crédito",
  "Cartão Débito": "Cartão Débito",
  "Vale Gás": "Vale Gás",
  Cheque: "Cheque",
  Boleto: "Boleto",
  "Gás do Povo": "Gás do Povo",
};

const FORMAS_PAGAMENTO_BUILTIN = [
  "Dinheiro", "PIX", "PIX Maquininha", "Cartão Crédito", "Cartão Débito", "Cheque", "Vale Gás", "Fiado", "Boleto", "Gás do Povo",
];

// Normaliza qualquer variação de forma de pagamento para uma chave canônica.
// Retorna "__invalido__" para valores ambíguos (cartao puro), desconhecidos (outros) ou vazios.
const FORMAS_CANONICAS = new Set([
  "dinheiro", "pix", "pix_maquininha", "cartao_credito", "cartao_debito", "cheque", "vale_gas", "fiado", "boleto", "gas_do_povo",
]);

function canonicalForma(raw: string): string {
  if (!raw) return "__invalido__";
  const s = raw
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\s+/g, "_");
  if (!s) return "__invalido__";

  // Mapeamentos diretos
  const direct: Record<string, string> = {
    dinheiro: "dinheiro",
    cash: "dinheiro",
    especie: "dinheiro",
    money: "dinheiro",
    pix: "pix",
    pix_maquininha: "pix_maquininha",
    pixmaquininha: "pix_maquininha",
    cartao_credito: "cartao_credito",
    credito: "cartao_credito",
    cartao_de_credito: "cartao_credito",
    cartaocredito: "cartao_credito",
    cartao_debito: "cartao_debito",
    debito: "cartao_debito",
    cartao_de_debito: "cartao_debito",
    cartaodebito: "cartao_debito",
    cheque: "cheque",
    vale_gas: "vale_gas",
    valegas: "vale_gas",
    vale: "vale_gas",
    fiado: "fiado",
    a_prazo: "fiado",
    aprazo: "fiado",
  };
  if (direct[s]) return direct[s];
  if (FORMAS_CANONICAS.has(s)) return s;
  // Formas customizadas: preserva o slug como está.
  if (s.startsWith("custom_avista_") || s.startsWith("custom_aprazo_")) return s;
  return "__invalido__";
}

// Parse robusto de valores monetários (aceita "R$ 1.234,56", "1234.56", "50.00", "1,234.56")
function parseValorBR(raw: string): number {
  if (!raw) return 0;
  let s = raw.toString().replace(/r\$/gi, "").replace(/\s/g, "").trim();
  if (!s) return 0;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // pt-BR: "1.234,56" — ponto é milhar, vírgula é decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // "1234,56" — só vírgula decimal
    s = s.replace(",", ".");
  }
  // só ponto: trata como decimal padrão ("50.00", "1234.56")
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

const CANAIS_VIRTUAIS = [
  { id: "__portaria__", nome: "🏪 Portaria", canal: "Portaria" },
  { id: "__pdv__", nome: "🖥️ PDV", canal: "PDV" },
  { id: "__gas_do_povo__", nome: "🔥 Gás do Povo", canal: "Gas_do_Povo" },
];

type FiltroStatus = "pendentes" | "acertados" | "todos";

interface PagamentoMultiplo {
  forma: string;
  valor: number;
  vale_gas_id?: string;
  vale_gas_parceiro_id?: string;
  vale_gas_parceiro_nome?: string;
  vale_gas_numero?: number;
  vale_gas_codigo?: string;
}

interface EditingEntrega {
  id: string;
  forma_pagamento: string;
  vale_gas_codigo: string;
  itens: { id: string; nome: string; quantidade: number; preco_unitario: number }[];
  pagamentos_multiplos: PagamentoMultiplo[];
}

export default function AcertoEntregador() {
  const { unidadeAtual } = useUnidade();
  const { data: formasCustom = [] } = useFormasPagamentoCustom({ onlyActive: true });
  const formaLabel = useFormaPagamentoLabel();
  const formasPagamento = useMemo(
    () => [
      ...FORMAS_PAGAMENTO_BUILTIN.map((f) => ({ value: f, label: f })),
      ...formasCustom.map((c) => ({ value: c.slug, label: `${c.icone} ${c.nome}` })),
    ],
    [formasCustom],
  );
  const { parceiros } = useValeGas();
  const { hasAnyRole } = useAuth();
  const { toast: toastHook } = useToast();
  const queryClient = useQueryClient();
  const hoje = getBrasiliaDateString();

  const [selectedId, setSelectedId] = useState("");
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [buscar, setBuscar] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("pendentes");

  // Auto-search when entregador changes
  const prevSelectedId = useRef(selectedId);
  useEffect(() => {
    if (selectedId && selectedId !== prevSelectedId.current) {
      prevSelectedId.current = selectedId;
      setBuscar(true);
      setAcertoConfirmado(false);
    }
  }, [selectedId]);
  const [editingEntrega, setEditingEntrega] = useState<EditingEntrega | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [valeGasModoManual, setValeGasModoManual] = useState(true);
  const [valeGasParceiroId, setValeGasParceiroId] = useState("");
  const [valeGasCodigoInput, setValeGasCodigoInput] = useState("");
  const [validandoValeGas, setValidandoValeGas] = useState(false);
  const [valeGasValidado, setValeGasValidado] = useState<{ parceiro: string; parceiroId?: string; numero?: number; codigo: string; valor: number; valido: boolean; valeId?: string } | null>(null);
  const [isConfirmingAcerto, setIsConfirmingAcerto] = useState(false);
  const [acertoConfirmado, setAcertoConfirmado] = useState(false);
  const [boletoPromptOpen, setBoletoPromptOpen] = useState(false);
  const [boletoConta, setBoletoConta] = useState<any>(null);
  const [boletoDialogOpen, setBoletoDialogOpen] = useState(false);

  const podeEditar = hasAnyRole(["admin", "gestor"]);

  // Entregadores
  const { data: entregadores = [] } = useQuery({
    queryKey: ["entregadores-ativos", unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual?.id) return [];
      const { data, error } = await supabase
        .from("entregadores")
        .select("id, nome")
        .eq("ativo", true)
        .eq("unidade_id", unidadeAtual.id)
        .order("nome");

      if (error) throw error;
      return data || [];
    },
    enabled: !!unidadeAtual?.id,
  });

  const canalVirtual = CANAIS_VIRTUAIS.find(c => c.id === selectedId);

  // Build status filter based on filtroStatus
  const getStatusFilter = () => {
    if (canalVirtual) {
      if (filtroStatus === "pendentes") return ["entregue", "pago"];
      if (filtroStatus === "acertados") return ["finalizado"];
      return ["entregue", "finalizado", "pago"];
    } else {
      if (filtroStatus === "pendentes") return ["entregue"];
      if (filtroStatus === "acertados") return ["finalizado"];
      return ["entregue", "finalizado"];
    }
  };

  // Entregas do período
  const { data: entregas = [], isLoading: loadingEntregas } = useQuery({
    queryKey: ["acerto-entregas", selectedId, dataInicio, dataFim, unidadeAtual?.id, filtroStatus],
    queryFn: async () => {
      if (!selectedId || !unidadeAtual?.id) return [];
      const statusList = getStatusFilter();
      let query = supabase
        .from("pedidos")
        .select(`
          id, numero_sequencial, created_at, data_entrega, valor_total, forma_pagamento, status, canal_venda, cliente_id,
          clientes (nome),
          pedido_itens (id, quantidade, preco_unitario, produtos (nome))
        `)
        .eq("unidade_id", unidadeAtual.id)
        .gte("data_entrega", dataInicio)
        .lte("data_entrega", dataFim)
        .in("status", statusList)
        .order("data_entrega", { ascending: true })
        .order("created_at", { ascending: true });

      if (canalVirtual) {
        if (canalVirtual.id === "__gas_do_povo__") {
          // Aceita variações: gas_do_povo, Gás do Povo, Gas Do Povo, etc.
          query = query.or(
            [
              "forma_pagamento.eq.gas_do_povo",
              "forma_pagamento.ilike.%gas%povo%",
              "forma_pagamento.ilike.%gás%povo%",
              "responsavel_acerto.eq.gas_do_povo",
            ].join(",")
          );
        } else {
          // Portaria/PDV: exclui pedidos do programa Gás do Povo (vão no canal próprio)
          query = query
            .eq("responsavel_acerto", canalVirtual.canal.toLowerCase())
            .not("forma_pagamento", "ilike", "%gas%povo%")
            .not("forma_pagamento", "ilike", "%gás%povo%");
        }
      } else {
        query = query.eq("entregador_id", selectedId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: buscar && !!selectedId && !!unidadeAtual?.id,
  });

  const { data: entregadoresPendentes = [], isLoading: loadingPendentes } = useQuery({
    queryKey: ["acerto-entregadores-pendentes", dataInicio, dataFim, unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual?.id) return [];
      const { data, error } = await supabase
        .from("pedidos")
        .select("id, valor_total, data_entrega, entregador_id, entregadores (id, nome)")
        .eq("unidade_id", unidadeAtual.id)
        .gte("data_entrega", dataInicio)
        .lte("data_entrega", dataFim)
        .in("status", ["entregue", "pago"])
        .not("entregador_id", "is", null);

      if (error) throw error;

      const map = new Map<string, { id: string; nome: string; pedidos: number; total: number }>();
      (data || []).forEach((pedido: any) => {
        if (!pedido.entregador_id) return;
        const atual = map.get(pedido.entregador_id) || {
          id: pedido.entregador_id,
          nome: pedido.entregadores?.nome || "Entregador não identificado",
          pedidos: 0,
          total: 0,
        };
        atual.pedidos += 1;
        atual.total += Number(pedido.valor_total || 0);
        map.set(pedido.entregador_id, atual);
      });

      return Array.from(map.values()).sort((a, b) => b.total - a.total);
    },
    enabled: !!unidadeAtual?.id,
  });

  // Despesas do entregador no período (não se aplica a canais virtuais)
  const { data: despesas = [], isLoading: loadingDespesas } = useQuery({
    queryKey: ["acerto-despesas", selectedId, dataInicio, dataFim, unidadeAtual?.id],
    queryFn: async () => {
      if (!selectedId || canalVirtual || !unidadeAtual?.id) return [];
      const { data, error } = await supabase
        .from("movimentacoes_caixa")
        .select("id, descricao, valor, categoria, created_at")
        .eq("unidade_id", unidadeAtual.id)
        .eq("entregador_id", selectedId)
        .eq("tipo", "saida")
        .gte("created_at", `${dataInicio}T00:00:00-03:00`)
        .lte("created_at", `${dataFim}T23:59:59-03:00`)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: buscar && !!selectedId && !canalVirtual && !!unidadeAtual?.id,
  });

  const handleBuscar = () => {
    if (!selectedId) {
      toast.error("Selecione um entregador ou canal");
      return;
    }
    setBuscar(true);
    setAcertoConfirmado(false);
  };

  // Open edit dialog
  const abrirEdicao = (entrega: any) => {
    const totalEntrega = Number(entrega.valor_total || 0);
    let pagamentos: PagamentoMultiplo[] = [];
    const fp = entrega.forma_pagamento || "";
    if (fp.startsWith("Múltiplos: ")) {
      const parts = fp.replace("Múltiplos: ", "").split(" + ");
      pagamentos = parts.map((part: string) => {
        const match = part.match(/^(.+?)\s+R\$(\d+[\.,]?\d*)$/);
        if (match) return { forma: match[1], valor: parseFloat(match[2].replace(",", ".")) };
        return { forma: part, valor: 0 };
      });
    } else if (fp.includes(", ")) {
      const parts = fp.split(", ");
      pagamentos = parts.map((part: string) => {
        const match = part.match(/^(.+?)\s+R\$(\d+[\.,]?\d*)$/);
        if (match) return { forma: match[1], valor: parseFloat(match[2].replace(",", ".")) };
        return { forma: part, valor: totalEntrega / parts.length };
      });
    } else if (fp) {
      pagamentos = [{ forma: fp, valor: totalEntrega }];
    } else {
      pagamentos = [{ forma: "Dinheiro", valor: totalEntrega }];
    }

    setEditingEntrega({
      id: entrega.id,
      forma_pagamento: fp,
      vale_gas_codigo: "",
      pagamentos_multiplos: pagamentos,
      itens: (entrega.pedido_itens || []).map((i: any) => ({
        id: i.id,
        nome: i.produtos?.nome || "Produto",
        quantidade: i.quantidade,
        preco_unitario: Number(i.preco_unitario),
      })),
    });
    setValeGasValidado(null);
    setValeGasParceiroId("");
    setValeGasCodigoInput("");
  };

  const validarValeGasAcerto = async (codigo: string) => {
    if (!valeGasParceiroId) {
      toastHook({ title: "Selecione o parceiro", description: "Escolha o parceiro antes de validar o número do vale.", variant: "destructive" });
      return;
    }
    setValidandoValeGas(true);
    try {
      const result = await validarValeGasNoBanco(codigo, valeGasParceiroId);
      if (result.valido) {
        const vale = { parceiro: result.parceiro, parceiroId: result.parceiroId, numero: result.numero, codigo: result.codigo, valor: result.valor, valido: true, valeId: result.valeId };
        setValeGasValidado(vale);
        if (editingEntrega) {
          setEditingEntrega({
            ...editingEntrega,
            vale_gas_codigo: result.codigo,
            pagamentos_multiplos: editingEntrega.pagamentos_multiplos.map((p) => p.forma === "Vale Gás" ? {
              ...p,
              vale_gas_id: result.valeId,
              vale_gas_parceiro_id: result.parceiroId,
              vale_gas_parceiro_nome: result.parceiro,
              vale_gas_numero: result.numero,
              vale_gas_codigo: result.codigo,
              valor: result.valor,
            } : p),
          });
        }
        toastHook({ title: "Vale Gás validado!", description: `Parceiro: ${result.parceiro} - Valor: R$ ${result.valor.toFixed(2)}` });
      } else {
        setValeGasValidado({ parceiro: "", codigo, valor: 0, valido: false });
        toastHook({ title: "Vale Gás inválido", description: result.erro || "Código não encontrado.", variant: "destructive" });
      }
    } catch {
      setValeGasValidado({ parceiro: "", codigo, valor: 0, valido: false });
      toastHook({ title: "Erro na validação", description: "Não foi possível validar o vale.", variant: "destructive" });
    } finally {
      setValidandoValeGas(false);
    }
  };

  const handleQRScanAcerto = (decodedText: string) => validarValeGasAcerto(decodedText);

  const updateEditItem = (index: number, field: "quantidade" | "preco_unitario", value: number) => {
    if (!editingEntrega) return;
    setEditingEntrega({
      ...editingEntrega,
      itens: editingEntrega.itens.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    });
  };

  const salvarEdicao = async () => {
    if (!editingEntrega) return;
    if (!unidadeAtual?.id) {
      toast.error("Selecione uma unidade antes de editar a entrega");
      return;
    }
    setIsSavingEdit(true);

    try {
      for (const item of editingEntrega.itens) {
        const { error } = await supabase
          .from("pedido_itens")
          .update({ quantidade: item.quantidade, preco_unitario: item.preco_unitario })
          .eq("id", item.id);
        if (error) throw error;
      }

      const novoTotal = editingEntrega.itens.reduce(
        (acc, item) => acc + item.quantidade * item.preco_unitario, 0
      );

      const pagamentos = editingEntrega.pagamentos_multiplos.filter(p => p.valor > 0);
      const pagamentoValeGas = pagamentos.find(p => p.forma === "Vale Gás");
      if (pagamentoValeGas && !pagamentoValeGas.vale_gas_id) {
        toast.error("Selecione o parceiro e valide o número do Vale Gás antes de salvar");
        setIsSavingEdit(false);
        return;
      }
      const totalPagamentos = pagamentos.reduce((a, p) => a + p.valor, 0);
      if (Math.abs(novoTotal - totalPagamentos) > 0.01) {
        toast.error("A soma dos pagamentos não confere com o total da entrega");
        setIsSavingEdit(false);
        return;
      }

      let formaPgtoSalvar: string;
      if (pagamentos.length === 1) {
        formaPgtoSalvar = pagamentos[0].forma;
      } else {
        formaPgtoSalvar = pagamentos
          .map(p => `${p.forma} R$${p.valor.toFixed(2)}`)
          .join(", ");
      }

      const { error } = await supabase
        .from("pedidos")
        .update({ forma_pagamento: formaPgtoSalvar, valor_total: novoTotal })
        .eq("id", editingEntrega.id)
        .eq("unidade_id", unidadeAtual.id);
      if (error) throw error;

      if (valeGasValidado?.valido && (valeGasValidado as any)?.valeId) {
        const novoValeId = (valeGasValidado as any).valeId as string;

        // Libera vales anteriormente vinculados a esta venda (exceto o que está sendo gravado agora)
        await (supabase as any)
          .from("vale_gas")
          .update({
            status: "disponivel",
            venda_id: null,
            cliente_id: null,
            cliente_nome: null,
            consumidor_nome: null,
            consumidor_telefone: null,
            data_utilizacao: null,
          })
          .eq("venda_id", editingEntrega.id)
          .neq("id", novoValeId);

        const { data: pedidoData } = await supabase
          .from("pedidos")
          .select("cliente_id, clientes(nome, telefone, endereco, bairro)")
          .eq("id", editingEntrega.id)
          .eq("unidade_id", unidadeAtual.id)
          .single();

        const clienteInfo = pedidoData?.clientes as any;
        await (supabase as any)
          .from("vale_gas")
          .update({
            status: "utilizado",
            data_utilizacao: new Date().toISOString(),
            cliente_id: pedidoData?.cliente_id || null,
            cliente_nome: clienteInfo?.nome || null,
            consumidor_nome: clienteInfo?.nome || null,
            consumidor_telefone: clienteInfo?.telefone || null,
            venda_id: editingEntrega.id,
          })
          .eq("id", novoValeId);
      }

      toast.success("Entrega atualizada com sucesso!");

      // Se há pagamento em Boleto, pergunta se deseja emitir agora via Asaas
      const temBoleto = pagamentos.some((p) => {
        const f = (p.forma || "").toString().trim().toLowerCase();
        return f === "boleto";
      });

      if (temBoleto) {
        const { data: cr } = await supabase
          .from("contas_receber")
          .select("id, cliente, descricao, valor, vencimento, pedido_id, asaas_charge_id, linha_digitavel, boleto_url, pix_qrcode, pix_copia_cola")
          .eq("pedido_id", editingEntrega.id)
          .eq("forma_pagamento", "boleto")
          .is("asaas_charge_id", null)
          .maybeSingle();

        if (cr) {
          setBoletoConta(cr);
          setBoletoPromptOpen(true);
        } else {
          toast.info("Boleto será disponível para emissão após Confirmar Acerto. Emita depois em Financeiro › Contas a Receber.");
        }
      }

      setEditingEntrega(null);
      queryClient.invalidateQueries({ queryKey: ["acerto-entregas"] });
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Métricas
  const metricas = useMemo(() => {
    const totalVendas = entregas.reduce((a, e) => a + Number(e.valor_total || 0), 0);
    const porForma: Record<string, number> = {};
    const entregasInvalidas: { id: string; forma_original: string; valor: number }[] = [];

    const parseMultiplos = (fp: string, total: number): { forma: string; valor: number }[] => {
      // Remove prefixos "Múltiplos:" e "multiplo:" (sem acento)
      const clean = fp.replace(/^m[uú]ltiplos?:\s*/i, "");
      const parts = clean.split(/\s*\+\s*|,\s*/).filter(Boolean);
      const out: { forma: string; valor: number }[] = [];
      let restante = total;
      const semValor: string[] = [];
      parts.forEach((part) => {
        const m = part.trim().match(/^(.+?)\s+R?\$?\s*([\d.,]+)$/);
        if (m) {
          const v = parseValorBR(m[2]);
          out.push({ forma: m[1].trim(), valor: v });
          restante -= v;
        } else {
          semValor.push(part.trim());
        }
      });
      if (semValor.length > 0) {
        const dividido = restante / semValor.length;
        semValor.forEach((forma) => out.push({ forma, valor: dividido }));
      }
      return out;
    };

    entregas.forEach((e) => {
      const fp = (e.forma_pagamento || "").trim();
      const total = Number(e.valor_total || 0);
      const isMultiplo = /^m[uú]ltiplos?:/i.test(fp) || fp.includes(",") || /\+/.test(fp);
      const items = isMultiplo
        ? parseMultiplos(fp, total)
        : [{ forma: fp, valor: total }];

      let temInvalido = false;
      items.forEach(({ forma, valor }) => {
        const canon = canonicalForma(forma);
        if (canon === "__invalido__") {
          temInvalido = true;
        } else {
          porForma[canon] = (porForma[canon] || 0) + valor;
        }
      });
      if (temInvalido) {
        entregasInvalidas.push({ id: e.id, forma_original: fp || "(vazio)", valor: total });
      }
    });

    const totalDespesas = despesas.reduce((a, d) => a + Number(d.valor || 0), 0);
    const saldoLiquido = totalVendas - totalDespesas;
    return { totalVendas, porForma, totalDespesas, saldoLiquido, entregasInvalidas };
  }, [entregas, despesas]);

  // Separar pendentes e acertados para contadores
  const contadores = useMemo(() => {
    const pendentes = entregas.filter(e => e.status === "entregue" || e.status === "pago").length;
    const acertados = entregas.filter(e => e.status === "finalizado").length;
    return { pendentes, acertados, total: entregas.length };
  }, [entregas]);

  // Resumo consolidado de produtos
  const resumoProdutos = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; total: number }>();
    entregas.forEach((e) => {
      (e.pedido_itens || []).forEach((item: any) => {
        const nome = item.produtos?.nome || "Produto";
        const cur = map.get(nome) || { nome, qtd: 0, total: 0 };
        cur.qtd += item.quantidade;
        cur.total += item.quantidade * Number(item.preco_unitario);
        map.set(nome, cur);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd);
  }, [entregas]);

  const nomeEntregador = canalVirtual?.canal || entregadores.find((e) => e.id === selectedId)?.nome || "";

  const normalizarFormaPagamento = (forma: string): string => {
    const canon = canonicalForma(forma);
    if (canon !== "__invalido__") return canon;
    // Fallback para variações conhecidas
    const map: Record<string, string> = {
      "Dinheiro": "dinheiro",
      "PIX": "pix",
      "PIX Maquininha": "pix_maquininha",
      "Cartão Crédito": "cartao_credito",
      "Cartão Débito": "cartao_debito",
      "Cheque": "cheque",
      "Vale Gás": "vale_gas",
      "Fiado": "fiado",
      "Boleto": "boleto",
      "Gás do Povo": "gas_do_povo",
    };
    return map[forma] || forma.toLowerCase().replace(/\s+/g, "_");
  };

  // Confirmar acerto
  const confirmarAcerto = async () => {
    if (!unidadeAtual?.id) {
      toast.error("Selecione uma unidade antes de confirmar o acerto");
      return;
    }
    const pendentes = entregas.filter(e => e.status === "entregue" || e.status === "pago");
    if (pendentes.length === 0) {
      toast.error("Nenhuma entrega pendente para confirmar");
      return;
    }
    if (metricas.entregasInvalidas.length > 0) {
      toast.error(`Existem ${metricas.entregasInvalidas.length} entrega(s) com forma de pagamento inválida. Edite cada pedido e selecione Cartão Crédito ou Cartão Débito antes de confirmar.`);
      return;
    }
    setIsConfirmingAcerto(true);
    const falhas: { numero: string; motivo: string }[] = [];
    let sucessos = 0;
    try {
      const { data: { user } } = await supabase.auth.getUser();

      for (const entrega of pendentes) {
        const numeroLabel = (entrega as any).numero_sequencial
          ? `#${(entrega as any).numero_sequencial}`
          : entrega.id.slice(-6);
        try {
          const fp = entrega.forma_pagamento || "";
          const totalEntrega = Number(entrega.valor_total) || 0;
          let pagamentos: PagamentoRoteamento[] = [];

          const isMultiplo = /^m[uú]ltiplos?:/i.test(fp) || fp.includes(", ") || /\+/.test(fp);
          if (isMultiplo) {
            const cleanFp = fp.replace(/^m[uú]ltiplos?:\s*/i, "");
            const parts = cleanFp.split(/,\s*|\s*\+\s*/).filter(Boolean);
            const parsed: { forma: string; valor: number | null }[] = parts.map((part: string) => {
              const match = part.trim().match(/^(.+?)\s+R?\$?\s*([\d.,]+)$/);
              if (match) {
                return { forma: normalizarFormaPagamento(match[1].trim()), valor: parseValorBR(match[2]) };
              }
              return { forma: normalizarFormaPagamento(part.trim()), valor: null };
            });
            const somaExplicita = parsed.reduce((a, p) => a + (p.valor ?? 0), 0);
            const semValor = parsed.filter((p) => p.valor === null);
            const restante = Math.max(0, totalEntrega - somaExplicita);
            const divididoEntreSemValor = semValor.length > 0 ? restante / semValor.length : 0;
            pagamentos = parsed.map((p) => ({
              forma: p.forma,
              valor: p.valor !== null ? p.valor : divididoEntreSemValor,
            }));
          } else if (fp) {
            pagamentos = [{ forma: normalizarFormaPagamento(fp), valor: totalEntrega }];
          } else {
            pagamentos = [{ forma: "dinheiro", valor: totalEntrega }];
          }

          if (pagamentos.some(p => p.forma === "vale_gas")) {
            const { data: valesUsados } = await (supabase as any)
              .from("vale_gas")
              .select("id, numero, codigo, parceiro_id, valor, vale_gas_parceiros:parceiro_id(nome)")
              .eq("venda_id", entrega.id)
              .order("data_utilizacao", { ascending: true });
            const lista = Array.isArray(valesUsados) ? valesUsados : [];
            if (lista.length) {
              const primeiro = lista[0];
              const somaVales = lista.reduce((s: number, v: any) => s + Number(v.valor || 0), 0);
              pagamentos = pagamentos.map((p) => p.forma === "vale_gas" ? {
                ...p,
                vale_gas_id: primeiro.id,
                vale_gas_parceiro_id: primeiro.parceiro_id,
                vale_gas_parceiro_nome: primeiro.vale_gas_parceiros?.nome,
                vale_gas_numero: primeiro.numero,
                vale_gas_codigo: primeiro.codigo,
                valor: somaVales || p.valor,
                vales: lista.map((v: any) => ({ id: v.id, numero: v.numero, codigo: v.codigo, valor: Number(v.valor || 0) })),
              } as any : p);
            }
          }

          const temValeGasSemVinculo = pagamentos.some(p => p.forma === "vale_gas" && !(p as any).vale_gas_id);
          if (temValeGasSemVinculo) {
            throw new Error("Vale Gás sem vínculo. Abra o pedido, edite a forma de pagamento e valide o número do vale antes de baixar o acerto.");
          }

          await rotearPagamentosVenda({
            pedidoId: entrega.id,
            pedidoNumero: (entrega as any).numero_sequencial ?? null,
            clienteId: entrega.cliente_id || null,
            clienteNome: entrega.clientes?.nome || "Cliente",
            pagamentos,
            unidadeId: unidadeAtual?.id || null,
            entregadorId: canalVirtual ? null : selectedId,
            userId: user?.id,
          });

          const { data: updated, error: updErr } = await supabase
            .from("pedidos")
            .update({ status: "finalizado" })
            .eq("id", entrega.id)
            .eq("unidade_id", unidadeAtual.id)
            .select("id")
            .maybeSingle();
          if (updErr) throw updErr;
          if (!updated) throw new Error("Status não atualizado (sem permissão ou linha não encontrada)");

          sucessos += 1;
        } catch (err: any) {
          console.error(`[Acerto] Falha pedido ${numeroLabel}:`, err);
          falhas.push({ numero: numeroLabel, motivo: err?.message || "erro desconhecido" });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["acerto-entregas"] });

      if (falhas.length === 0) {
        setAcertoConfirmado(true);
        toast.success(`Acerto confirmado! ${sucessos} entrega(s) roteadas financeiramente.`);
        setFiltroStatus("acertados");
      } else {
        const listaFalhas = falhas.map(f => f.numero).join(", ");
        toast.error(
          `${sucessos} de ${pendentes.length} pedido(s) finalizados. ${falhas.length} falharam: ${listaFalhas}`,
          { duration: 10000 }
        );
        if (sucessos > 0) setAcertoConfirmado(true);
      }
    } catch (err: any) {
      toast.error("Erro ao confirmar acerto: " + err.message);
    } finally {
      setIsConfirmingAcerto(false);
    }
  };


  // Exportar PDF do acerto
  const exportarPDF = () => {
    if (entregas.length === 0) {
      toast.error("Nenhuma entrega para exportar");
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(canalVirtual ? `Acerto ${canalVirtual.canal}` : "Acerto do Entregador", 14, 15);
    doc.setFontSize(10);
    doc.text(canalVirtual ? `Canal: ${canalVirtual.canal}` : `Entregador: ${nomeEntregador}`, 14, 22);
    doc.text(`Período: ${format(parseISO(dataInicio), "dd/MM/yyyy")} a ${format(parseISO(dataFim), "dd/MM/yyyy")}`, 14, 28);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 34);
    doc.text(`Filtro: ${filtroStatus === "pendentes" ? "Pendentes" : filtroStatus === "acertados" ? "Acertados" : "Todos"}`, 14, 40);

    autoTable(doc, {
      head: [["Métrica", "Valor"]],
      body: [
        ["Total Entregas", String(entregas.length)],
        ["Total Vendas", formatCurrency(metricas.totalVendas)],
        ...Object.entries(metricas.porForma).map(([forma, valor]) => [
          formaLabel(forma),
          formatCurrency(valor),
        ]),
        ["Total Despesas", formatCurrency(metricas.totalDespesas)],
        ["Saldo Líquido", formatCurrency(metricas.saldoLiquido)],
      ],
      startY: 46,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [51, 65, 85] },
    });

    let y = (doc as any).lastAutoTable?.finalY || 90;
    doc.setFontSize(12);
    doc.text("Produtos Vendidos", 14, y + 10);
    autoTable(doc, {
      head: [["Produto", "Qtd", "Total"]],
      body: resumoProdutos.map((p) => [p.nome, String(p.qtd), formatCurrency(p.total)]),
      startY: y + 14,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [51, 65, 85] },
    });

    y = (doc as any).lastAutoTable?.finalY || 140;
    doc.setFontSize(12);
    doc.text("Entregas Detalhadas", 14, y + 10);
    autoTable(doc, {
      head: [["Nº", "Data", "Cliente", "Itens", "Pagamento", "Status", "Valor"]],
      body: entregas.map((e) => [
        e.numero_sequencial ? `#${e.numero_sequencial}` : `#${String(e.id).slice(-6)}`,
        e.data_entrega ? format(parseISO(`${e.data_entrega}T12:00:00`), "dd/MM/yyyy") : format(parseISO(e.created_at), "dd/MM/yyyy"),
        e.clientes?.nome || "—",
        (e.pedido_itens || []).map((i: any) => `${i.quantidade}x ${i.produtos?.nome || "?"}`).join(", ") || "—",
        formaLabel(e.forma_pagamento),
        e.status === "finalizado" ? "Acertado" : "Pendente",
        formatCurrency(Number(e.valor_total || 0)),
      ]),
      startY: y + 14,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [51, 65, 85] },
    });


    if (despesas.length > 0) {
      y = (doc as any).lastAutoTable?.finalY || 180;
      doc.setFontSize(12);
      doc.text("Despesas", 14, y + 10);
      autoTable(doc, {
        head: [["Hora", "Descrição", "Categoria", "Valor"]],
        body: despesas.map((d) => [
          format(parseISO(d.created_at), "HH:mm"),
          d.descricao,
          d.categoria || "—",
          formatCurrency(Number(d.valor || 0)),
        ]),
        startY: y + 14,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [51, 65, 85] },
      });
    }

    y = (doc as any).lastAutoTable?.finalY || 220;
    doc.setFontSize(9);
    if (!canalVirtual) {
      doc.text("_____________________________", 14, y + 25);
      doc.text(`Assinatura: ${nomeEntregador}`, 14, y + 30);
    }
    doc.text("_____________________________", 120, y + 25);
    doc.text("Conferido por:", 120, y + 30);

    doc.save(`acerto-${nomeEntregador.replace(/\s/g, "-")}-${dataInicio}.pdf`);
    toast.success("PDF do acerto exportado!");
  };

  const isLoading = loadingEntregas || loadingDespesas;

  // Check if there are pendentes in current result set
  const temPendentes = entregas.some(e => e.status === "entregue" || e.status === "pago");

  return (
    <MainLayout>
      <Header title="Acerto Financeiro" subtitle="Conferência de entregas, portaria e PDV" />
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Filtros */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-6 items-end">
              <div className="col-span-2 sm:col-span-1 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Entregador / Canal</Label>
                <Select value={selectedId} onValueChange={(v) => { setSelectedId(v); setBuscar(false); setAcertoConfirmado(false); }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {CANAIS_VIRTUAIS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                    {entregadores.length > 0 && CANAIS_VIRTUAIS.length > 0 && (
                      <div className="my-1 h-px bg-border" />
                    )}
                    {entregadores.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Data Início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); setBuscar(false); }} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Data Fim</Label>
                <Input type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); setBuscar(false); }} className="h-9" />
              </div>
              <Button className="h-9 gap-2" onClick={handleBuscar} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
              <Button variant="outline" className="h-9 gap-2" onClick={exportarPDF} disabled={entregas.length === 0}>
                <Download className="h-4 w-4" />PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-5 w-5 text-warning" />
              Entregadores com acerto pendente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPendentes ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : entregadoresPendentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum entregador com pedido pendente de acerto neste período.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {entregadoresPendentes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setFiltroStatus("pendentes");
                      setBuscar(true);
                      setAcertoConfirmado(false);
                    }}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.nome}</p>
                      <p className="text-xs text-muted-foreground">{item.pedidos} pedido{item.pedidos > 1 ? "s" : ""} pendente{item.pedidos > 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{formatCurrency(item.total)}</p>
                      <Badge variant="outline" className="mt-1 text-[10px]">Ver acerto</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content */}
        {buscar && (
          <>
            {/* Status tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => setFiltroStatus("pendentes")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    filtroStatus === "pendentes"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Pendentes
                  {buscar && !isLoading && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] ml-0.5">
                      {entregas.filter(e => e.status !== "finalizado").length}
                    </Badge>
                  )}
                </button>
                <button
                  onClick={() => setFiltroStatus("acertados")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    filtroStatus === "acertados"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Acertados
                  {buscar && !isLoading && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] ml-0.5">
                      {entregas.filter(e => e.status === "finalizado").length}
                    </Badge>
                  )}
                </button>
                <button
                  onClick={() => setFiltroStatus("todos")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    filtroStatus === "todos"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  Todos
                </button>
              </div>
            </div>

            {/* Métricas */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
              <Card className="border-border/60">
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="rounded-lg bg-primary/10 p-2 shrink-0"><Package className="h-5 w-5 text-primary" /></div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Entregas</p>
                    <p className="text-lg font-bold">{isLoading ? "..." : entregas.length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="rounded-lg bg-success/10 p-2 shrink-0"><Wallet className="h-5 w-5 text-success" /></div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Total Vendas</p>
                    <p className="text-base font-bold truncate">{isLoading ? "..." : formatCurrency(metricas.totalVendas)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="rounded-lg bg-destructive/10 p-2 shrink-0"><Minus className="h-5 w-5 text-destructive" /></div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Despesas</p>
                    <p className="text-base font-bold truncate text-destructive">{isLoading ? "..." : formatCurrency(metricas.totalDespesas)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="rounded-lg bg-warning/10 p-2 shrink-0"><Receipt className="h-5 w-5 text-warning" /></div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Saldo Líquido</p>
                    <p className={`text-base font-bold truncate ${metricas.saldoLiquido >= 0 ? "text-success" : "text-destructive"}`}>
                      {isLoading ? "..." : formatCurrency(metricas.saldoLiquido)}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="rounded-lg bg-info/10 p-2 shrink-0"><CreditCard className="h-5 w-5 text-info" /></div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Formas Pgto</p>
                    <p className="text-lg font-bold">{isLoading ? "..." : Object.keys(metricas.porForma).length}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Resumo automático do acerto - only for pendentes */}
            {!isLoading && temPendentes && filtroStatus !== "acertados" && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    Resumo Automático do Acerto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">💰 O entregador deve devolver:</p>
                      <div className="space-y-1.5">
                        {Object.entries(metricas.porForma).map(([forma, valor]) => {
                          const isDinheiro = forma === "dinheiro";
                          return (
                            <div key={forma} className="flex justify-between text-sm">
                              <span className={isDinheiro ? "font-medium" : "text-muted-foreground"}>
                                {isDinheiro ? "💵" : "💳"} {formaLabel(forma)}
                              </span>
                              <span className={isDinheiro ? "font-bold" : ""}>{formatCurrency(valor)}</span>
                            </div>
                          );
                        })}
                      </div>
                      {metricas.totalDespesas > 0 && (
                        <div className="flex justify-between text-sm border-t pt-1.5 text-destructive">
                          <span>🧾 Despesas a descontar</span>
                          <span className="font-medium">- {formatCurrency(metricas.totalDespesas)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-lg bg-background p-4 border">
                      <p className="text-xs text-muted-foreground mb-1">Dinheiro em espécie a receber</p>
                      <p className="text-2xl font-bold text-primary">
                        {formatCurrency((metricas.porForma["dinheiro"] || 0) - metricas.totalDespesas)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">(Dinheiro − Despesas)</p>
                    </div>
                  </div>

                  {metricas.entregasInvalidas.length > 0 && (
                    <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                      <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {metricas.entregasInvalidas.length} entrega(s) com forma de pagamento inválida
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Formas como <b>"outros"</b> ou <b>"cartão"</b> sem indicar crédito/débito não são aceitas.
                        Edite cada pedido e selecione <b>Cartão Crédito</b> ou <b>Cartão Débito</b> antes de confirmar o acerto.
                      </p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {metricas.entregasInvalidas.map((inv) => {
                          const entrega = entregas.find((e) => e.id === inv.id);
                          return (
                            <div key={inv.id} className="flex items-center justify-between gap-2 rounded-md bg-background border px-2 py-1.5 text-xs">
                              <div className="min-w-0 flex-1">
                                <span className="font-medium">{entrega?.clientes?.nome || "Cliente"}</span>
                                <span className="text-muted-foreground"> · {inv.forma_original} · </span>
                                <span className="font-semibold">{formatCurrency(inv.valor)}</span>
                              </div>
                              {entrega && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => abrirEdicao(entrega)}>
                                  Editar
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Botão Confirmar Acerto */}
            {!isLoading && temPendentes && filtroStatus !== "acertados" && !acertoConfirmado && (
              <Card className="border-success/30 bg-success/5">
                <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-sm">✅ Confirmar Acerto Financeiro</p>
                    <p className="text-xs text-muted-foreground">
                      {metricas.entregasInvalidas.length > 0
                        ? `Corrija as ${metricas.entregasInvalidas.length} entrega(s) com forma de pagamento inválida acima antes de confirmar.`
                        : "Ao confirmar, cada pagamento será roteado automaticamente: Dinheiro → Caixa da Loja, PIX → Banco, Cartão → Contas a Receber, etc."}
                    </p>
                  </div>
                  <Button
                    onClick={confirmarAcerto}
                    disabled={isConfirmingAcerto || metricas.entregasInvalidas.length > 0}
                    title={metricas.entregasInvalidas.length > 0 ? "Há entregas com forma de pagamento inválida" : undefined}
                    className="gap-2 whitespace-nowrap"
                    size="lg"
                  >
                    {isConfirmingAcerto ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Processando...</>
                    ) : (
                      <><CheckCircle className="h-4 w-4" />Confirmar Acerto</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {acertoConfirmado && (
              <Card className="border-success/50 bg-success/10">
                <CardContent className="p-4 text-center">
                  <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                  <p className="font-semibold text-success">Acerto confirmado com sucesso!</p>
                  <p className="text-xs text-muted-foreground">Todas as movimentações financeiras foram criadas automaticamente.</p>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Banknote className="h-5 w-5" />Resumo por Forma de Pagamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 sm:p-6 sm:pt-0">
                  {isLoading ? (
                    <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                  ) : Object.keys(metricas.porForma).length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground text-sm">Sem dados</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table className="min-w-[320px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Forma</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-right hidden sm:table-cell">%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(metricas.porForma)
                            .sort(([, a], [, b]) => b - a)
                            .map(([forma, valor]) => {
                              const qtd = entregas.filter((e) => {
                                const fp = (e.forma_pagamento || "").trim();
                                const isMulti = /^m[uú]ltiplos?:/i.test(fp) || fp.includes(",") || /\+/.test(fp);
                                if (isMulti) {
                                  const clean = fp.replace(/^m[uú]ltiplos?:\s*/i, "");
                                  return clean.split(/\s*\+\s*|,\s*/).some((p) => {
                                    const m = p.trim().match(/^(.+?)(?:\s+R?\$?\s*[\d.,]+)?$/);
                                    return canonicalForma(m ? m[1] : p) === forma;
                                  });
                                }
                                return canonicalForma(fp) === forma;
                              }).length;
                              const pct = metricas.totalVendas > 0 ? ((valor / metricas.totalVendas) * 100).toFixed(1) : "0";
                              return (
                                <TableRow key={forma}>
                                  <TableCell className="font-medium">
                                    <Badge variant="outline" className="text-xs max-w-[180px] truncate" title={formaLabel(forma)}>{formaLabel(forma)}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right">{qtd}</TableCell>
                                  <TableCell className="text-right font-semibold whitespace-nowrap">{formatCurrency(valor)}</TableCell>
                                  <TableCell className="text-right text-muted-foreground hidden sm:table-cell">{pct}%</TableCell>
                                </TableRow>
                              );
                            })}
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell>Total</TableCell>
                            <TableCell className="text-right">{entregas.length}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{formatCurrency(metricas.totalVendas)}</TableCell>
                            <TableCell className="hidden sm:table-cell text-right">100%</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-5 w-5" />Produtos Vendidos
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 sm:p-6 sm:pt-0">
                  {isLoading ? (
                    <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                  ) : resumoProdutos.length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground text-sm">Sem dados</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table className="min-w-[280px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead className="text-right w-16">Qtd</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {resumoProdutos.map((p) => (
                            <TableRow key={p.nome}>
                              <TableCell className="font-medium">{p.nome}</TableCell>
                              <TableCell className="text-right">{p.qtd}</TableCell>
                              <TableCell className="text-right font-semibold whitespace-nowrap">{formatCurrency(p.total)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell>Total</TableCell>
                            <TableCell className="text-right">{resumoProdutos.reduce((s, p) => s + p.qtd, 0)}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{formatCurrency(resumoProdutos.reduce((s, p) => s + p.total, 0))}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Despesas do entregador */}
            {despesas.length > 0 && (
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-destructive">
                    <Minus className="h-5 w-5" />Despesas do Entregador
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 sm:p-6 sm:pt-0">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[360px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Data</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {despesas.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="text-xs">{format(parseISO(d.created_at), "HH:mm")}</TableCell>
                            <TableCell className="text-sm">
                              <div>{d.descricao}</div>
                              <div className="sm:hidden text-xs text-muted-foreground mt-0.5">{d.categoria || "—"}</div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell"><Badge variant="outline" className="text-xs">{d.categoria || "—"}</Badge></TableCell>
                            <TableCell className="text-right font-semibold text-destructive whitespace-nowrap">{formatCurrency(Number(d.valor || 0))}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell colSpan={2} className="sm:hidden">Total Despesas</TableCell>
                          <TableCell colSpan={3} className="hidden sm:table-cell">Total Despesas</TableCell>
                          <TableCell className="text-right text-destructive whitespace-nowrap">{formatCurrency(metricas.totalDespesas)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lista de entregas com produtos */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                  <span className="flex items-center gap-2 text-base"><Receipt className="h-5 w-5" />Entregas Detalhadas</span>
                  <Badge variant="secondary">{entregas.length} registros</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                {isLoading ? (
                  <div className="space-y-3 p-4">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : entregas.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      {filtroStatus === "pendentes" ? <Clock className="h-6 w-6 text-muted-foreground" /> : <CheckCircle className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {filtroStatus === "pendentes" 
                        ? "Nenhuma entrega pendente de acerto"
                        : filtroStatus === "acertados"
                        ? "Nenhuma entrega acertada neste período"
                        : "Nenhuma entrega encontrada"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {filtroStatus === "pendentes" 
                        ? "Troque para 'Acertados' para ver o histórico"
                        : "Ajuste os filtros de data ou entregador"}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[560px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Nº</TableHead>
                          <TableHead className="w-20">Data</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="hidden md:table-cell">Produtos</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead className="w-20">Status</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          {podeEditar && filtroStatus !== "acertados" && <TableHead className="w-10" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entregas.map((e) => {
                          const itensStr = (e.pedido_itens || [])
                            .map((i: any) => `${i.quantidade}x ${i.produtos?.nome || "?"}`)
                            .join(", ") || "—";
                          const isAcertado = e.status === "finalizado";
                          const numeroStr = e.numero_sequencial
                            ? `#${e.numero_sequencial}`
                            : `#${String(e.id).slice(-6)}`;
                          const dataStr = e.data_entrega
                            ? format(parseISO(`${e.data_entrega}T12:00:00`), "dd/MM/yyyy")
                            : format(parseISO(e.created_at), "dd/MM/yyyy");
                          return (
                            <TableRow key={e.id} className={isAcertado ? "opacity-75" : ""}>
                              <TableCell className="text-xs font-mono whitespace-nowrap">{numeroStr}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{dataStr}</TableCell>
                              <TableCell className="text-sm font-medium">
                                <div>{e.clientes?.nome || "—"}</div>
                                <div className="md:hidden text-xs text-muted-foreground mt-0.5 max-w-[140px] truncate">{itensStr}</div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">{itensStr}</TableCell>
                              <TableCell><Badge variant="outline" className="text-xs max-w-[160px] truncate" title={formaLabel(e.forma_pagamento)}>{formaLabel(e.forma_pagamento)}</Badge></TableCell>
                              <TableCell>
                                {isAcertado ? (
                                  <Badge className="bg-success/15 text-success border-success/30 text-[10px] gap-1">
                                    <CheckCircle className="h-3 w-3" />Acertado
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px] gap-1">
                                    <Clock className="h-3 w-3" />Pendente
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-semibold whitespace-nowrap">{formatCurrency(Number(e.valor_total || 0))}</TableCell>
                              {podeEditar && filtroStatus !== "acertados" && (
                                <TableCell>
                                  {!isAcertado && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirEdicao(e)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Dialog de edição */}
      <Dialog open={!!editingEntrega} onOpenChange={(open) => !open && setEditingEntrega(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Entrega</DialogTitle>
            <DialogDescription>Ajuste itens, valores e formas de pagamento desta entrega.</DialogDescription>
          </DialogHeader>
          {editingEntrega && (
            <div className="space-y-4">
              {/* Pagamentos */}
              <div className="space-y-3 p-3 border border-border rounded-lg bg-muted/30">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" /> Formas de Pagamento
                </Label>
                {editingEntrega.pagamentos_multiplos.map((pg, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_100px_32px] gap-2 items-end">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Forma</Label>
                      <Select
                        value={pg.forma}
                        onValueChange={(v) => {
                          const novos = [...editingEntrega.pagamentos_multiplos];
                          novos[idx] = { ...novos[idx], forma: v };
                          setEditingEntrega({ ...editingEntrega, pagamentos_multiplos: novos });
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {formasPagamento.map((f) => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Valor (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={pg.valor || ""}
                        onChange={(e) => {
                          const novos = [...editingEntrega.pagamentos_multiplos];
                          novos[idx] = { ...novos[idx], valor: parseFloat(e.target.value) || 0 };
                          setEditingEntrega({ ...editingEntrega, pagamentos_multiplos: novos });
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        const novos = editingEntrega.pagamentos_multiplos.filter((_, i) => i !== idx);
                        setEditingEntrega({ ...editingEntrega, pagamentos_multiplos: novos });
                      }}
                      disabled={editingEntrega.pagamentos_multiplos.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1"
                  onClick={() => {
                    const totalEntrega = editingEntrega.itens.reduce((a, i) => a + i.quantidade * i.preco_unitario, 0);
                    const totalPagamentos = editingEntrega.pagamentos_multiplos.reduce((a, p) => a + p.valor, 0);
                    const restante = Math.max(0, totalEntrega - totalPagamentos);
                    setEditingEntrega({
                      ...editingEntrega,
                      pagamentos_multiplos: [...editingEntrega.pagamentos_multiplos, { forma: "PIX", valor: restante }],
                    });
                  }}
                >
                  <Plus className="h-4 w-4" />Adicionar Forma
                </Button>
                {(() => {
                  const totalEntrega = editingEntrega.itens.reduce((a, i) => a + i.quantidade * i.preco_unitario, 0);
                  const totalPagamentos = editingEntrega.pagamentos_multiplos.reduce((a, p) => a + p.valor, 0);
                  const diferenca = totalEntrega - totalPagamentos;
                  return (
                    <div className={`text-xs flex justify-between p-2 rounded ${Math.abs(diferenca) < 0.01 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      <span>Soma: {formatCurrency(totalPagamentos)}</span>
                      <span>{Math.abs(diferenca) < 0.01 ? "✓ Valores conferem" : `Diferença: ${formatCurrency(diferenca)}`}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Vale Gás */}
              {editingEntrega.pagamentos_multiplos.some(p => p.forma === "Vale Gás") && (
                <div className="space-y-3 p-3 border border-border rounded-lg bg-muted/30">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-primary" /> Validar Vale Gás
                  </Label>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Parceiro</Label>
                    <Select value={valeGasParceiroId} onValueChange={(v) => { setValeGasParceiroId(v); setValeGasValidado(null); setValeGasCodigoInput(""); }}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o parceiro" /></SelectTrigger>
                      <SelectContent>
                        {parceiros.filter(p => p.ativo).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {!valeGasValidado ? (
                    <>
                      <div className="flex gap-2 p-1 bg-muted rounded-lg">
                        <Button
                          variant={valeGasModoManual ? "default" : "ghost"}
                          size="sm"
                          className={`flex-1 ${valeGasModoManual ? "gradient-primary text-white" : ""}`}
                          onClick={() => setValeGasModoManual(true)}
                        >
                          <Keyboard className="h-4 w-4 mr-2" />Digitar
                        </Button>
                        <Button
                          variant={!valeGasModoManual ? "default" : "ghost"}
                          size="sm"
                          className={`flex-1 ${!valeGasModoManual ? "gradient-primary text-white" : ""}`}
                          onClick={() => setValeGasModoManual(false)}
                        >
                          <QrCode className="h-4 w-4 mr-2" />Câmera
                        </Button>
                      </div>

                      {valeGasModoManual ? (
                        <div className="space-y-2">
                          <Input
                            placeholder="Ex: VG-2024-001234"
                            value={valeGasCodigoInput}
                            onChange={(e) => setValeGasCodigoInput(e.target.value)}
                            className="font-mono"
                          />
                          <p className="text-xs text-muted-foreground">Digite o código impresso no vale</p>
                          <Button
                            onClick={() => { if (valeGasCodigoInput.trim()) validarValeGasAcerto(valeGasCodigoInput.trim()); }}
                            disabled={!valeGasParceiroId || !valeGasCodigoInput.trim() || validandoValeGas}
                            className="w-full"
                            size="sm"
                          >
                            {validandoValeGas ? "Validando..." : "Validar Código"}
                          </Button>
                        </div>
                      ) : (
                        <QRCodeScanner
                          onScan={handleQRScanAcerto}
                          onError={(err) => toastHook({ title: "Erro na câmera", description: err, variant: "destructive" })}
                        />
                      )}
                    </>
                  ) : (
                    <div className="space-y-3">
                      {valeGasValidado.valido ? (
                        <div className="p-3 bg-success/10 rounded-lg border border-success/30">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="h-4 w-4 text-success" />
                            <span className="font-semibold text-success text-sm">Vale Gás Válido</span>
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between"><span className="text-muted-foreground">Parceiro:</span><span className="font-medium">{valeGasValidado.parceiro}</span></div>
                            {valeGasValidado.numero && <div className="flex justify-between"><span className="text-muted-foreground">Número:</span><span className="font-mono">{valeGasValidado.numero}</span></div>}
                            <div className="flex justify-between"><span className="text-muted-foreground">Código:</span><span className="font-mono">{valeGasValidado.codigo}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Valor:</span><span className="font-bold">R$ {valeGasValidado.valor.toFixed(2)}</span></div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <span className="font-semibold text-destructive text-sm">Vale Gás Inválido</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Código: {valeGasValidado.codigo}</p>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setValeGasValidado(null); setValeGasCodigoInput(""); }}
                        className="w-full"
                      >
                        Tentar outro código
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm">Produtos</Label>
                {editingEntrega.itens.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-[1fr_80px_100px] gap-2 items-center p-2 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium truncate">{item.nome}</span>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Qtd</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantidade}
                        onChange={(e) => updateEditItem(index, "quantidade", Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Preço (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={item.preco_unitario}
                        onChange={(e) => updateEditItem(index, "preco_unitario", Math.max(0, parseFloat(e.target.value) || 0))}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-border text-sm">
                  <span className="font-medium">Novo total:</span>
                  <span className="font-bold">
                    {formatCurrency(editingEntrega.itens.reduce((a, i) => a + i.quantidade * i.preco_unitario, 0))}
                  </span>
                </div>
              </div>

              <Button onClick={salvarEdicao} disabled={isSavingEdit} className="w-full gap-2">
                {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSavingEdit ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação de emissão de boleto após editar entrega */}
      <AlertDialog open={boletoPromptOpen} onOpenChange={setBoletoPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir boleto agora?</AlertDialogTitle>
            <AlertDialogDescription>
              A entrega foi salva com forma de pagamento Boleto. Deseja gerar o boleto no Asaas agora?
              Se preferir, você pode emitir mais tarde em Financeiro › Contas a Receber.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, apenas registrar</AlertDialogCancel>
            <AlertDialogAction onClick={() => setBoletoDialogOpen(true)}>
              Sim, emitir agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {boletoConta && (
        <EmitirBoletoAsaasDialog
          open={boletoDialogOpen}
          onOpenChange={(o) => {
            setBoletoDialogOpen(o);
            if (!o) setBoletoConta(null);
          }}
          conta={boletoConta}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["acerto-entregas"] })}
        />
      )}
    </MainLayout>

  );
}

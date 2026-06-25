import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from
"@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from
"@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from
"@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger } from
"@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Search, Eye, Truck, CheckCircle, Clock, XCircle, Sparkles,
  User, RefreshCw, MoreHorizontal, Edit, ArrowRightLeft, Printer,
  Share2, DollarSign, Trash2, Lock, MessageCircle, CreditCard,
  ChevronLeft, ChevronRight, CheckSquare, Building2, Pencil, MoveRight, Map as MapIcon,
  Download, Package, Calendar, SlidersHorizontal } from
"lucide-react";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader,
  ResponsiveDialogTitle, ResponsiveDialogTrigger, ResponsiveDialogFooter } from
"@/components/ui/responsive-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { SugestaoEntregador } from "@/components/sugestao/SugestaoEntregador";
import { useToast } from "@/hooks/use-toast";
import { gerarComprovanteEntregaPdf } from "@/lib/comprovanteEntregaPdf";
import { PedidoViewDialog } from "@/components/pedidos/PedidoViewDialog";
import { StatusDropdown } from "@/components/pedidos/StatusDropdown";
import { EditarAgendamentoDialog } from "@/components/pedidos/EditarAgendamentoDialog";
import { usePedidos } from "@/hooks/usePedidos";
import { PedidoFormatado, PedidoStatus } from "@/types/pedido";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/contexts/AuthContext";
import { generateReceiptPdf, EmpresaConfig } from "@/services/receiptPdfService";
import { SmartImportButtons } from "@/components/import/SmartImportButtons";
import { ImportReviewDialog } from "@/components/import/ImportReviewDialog";
import { toast as sonnerToast } from "sonner";
import { getBrasiliaDate } from "@/lib/utils";
import { format as fnsFormat } from "date-fns";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { getOrigemMeta, ORIGEM_PEDIDO_META, ORIGENS_PEDIDO, type OrigemPedido } from "@/lib/pedidos/origem";

function OrigemBadge({ origem }: { origem?: string | null }) {
  const meta = getOrigemMeta(origem);
  return (
    <Badge variant="outline" className={`text-[10px] gap-1 ${meta.color}`} title={meta.label}>
      <span aria-hidden>{meta.icon}</span>
      <span className="truncate">{meta.label}</span>
    </Badge>
  );
}

function getNumeroExibicao(p: { numero_sequencial?: number | null; id: string }) {
  return p.numero_sequencial != null ? String(p.numero_sequencial) : p.id.substring(0, 8).toUpperCase();
}

function exportarPedidosCSV(pedidos: PedidoFormatado[]) {
  const header = ["Origem", "Nº", "Data", "Cliente", "Endereço", "Produtos", "Entregador", "Canal", "Valor (R$)", "Status", "Pagamento"];
  const rows = pedidos.map((p) => [
  getOrigemMeta(p.origem_pedido).label,
  getNumeroExibicao(p),
  p.data,
  p.cliente,
  (p.endereco || "").replace(/,/g, " "),
  (p.produtos || "").replace(/,/g, " |"),
  p.entregador || "",
  p.canal_venda || "",
  p.valor.toFixed(2),
  p.status,
  p.forma_pagamento || ""]
  );
  const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const d = getBrasiliaDate();
  a.download = `pedidos_${fnsFormat(d, "yyyyMMdd_HHmm")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface Entregador {
  id: string;
  nome: string;
  status: string | null;
}

interface ResumoProduto {
  nome: string;
  quantidade: number;
  total: number;
}

const ITEMS_PER_PAGE = 20;

function formatarItensComQtd(pedido: PedidoFormatado): string {
  if (pedido.itens && pedido.itens.length > 0) {
    return pedido.itens
      .map((it) => `${Number(it.quantidade) || 0}x ${it.produto?.nome || "Produto"}`)
      .join(" · ");
  }
  return pedido.produtos || "";
}

export default function Pedidos() {
  const navigate = useNavigate();
  const hoje = (() => {const d = getBrasiliaDate();return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;})();
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const { pedidos, isLoading, atualizarStatus, atribuirEntregador, excluirPedido, atualizarStatusLote, atribuirEntregadorLote, marcarPortaria, marcarPortariaLote, isUpdating, isDeleting } = usePedidos({ dataInicio, dataFim });
  const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoFormatado | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [viewDialogAberto, setViewDialogAberto] = useState(false);
  const [pedidoView, setPedidoView] = useState<PedidoFormatado | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroEntregador, setFiltroEntregador] = useState<string>("todos");
  const [filtroOrigem, setFiltroOrigem] = useState<string>("todos");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [busca, setBusca] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasAnyRole } = useAuth();
  const podeAlterarDataEntrega = hasAnyRole(["admin", "gestor"]);
  const podeAlterarCanalFinalizado = hasAnyRole(["admin", "gestor"]);

  // Batch selection (#7)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [batchDialogAberto, setBatchDialogAberto] = useState(false);
  const [batchAction, setBatchAction] = useState<"status" | "entregador">("status");

  // Transfer driver dialog
  const [transferDialogAberto, setTransferDialogAberto] = useState(false);
  const [pedidoTransferir, setPedidoTransferir] = useState<PedidoFormatado | null>(null);
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [loadingEntregadores, setLoadingEntregadores] = useState(false);

  // Transfer filial dialog
  const [filialDialogAberto, setFilialDialogAberto] = useState(false);
  const [pedidoTransferirFilial, setPedidoTransferirFilial] = useState<PedidoFormatado | null>(null);
  const [filialSelecionadaId, setFilialSelecionadaId] = useState<string>("");
  const [transferindoFilial, setTransferindoFilial] = useState(false);
  const { unidades } = useUnidade();

  // Delete with password
  const [deleteDialogAberto, setDeleteDialogAberto] = useState(false);
  const [pedidoExcluir, setPedidoExcluir] = useState<PedidoFormatado | null>(null);
  const [senhaExclusao, setSenhaExclusao] = useState("");
  const [senhaErro, setSenhaErro] = useState("");

  // Editar agendamento
  const [agendamentoDialogAberto, setAgendamentoDialogAberto] = useState(false);
  const [pedidoAgendamento, setPedidoAgendamento] = useState<PedidoFormatado | null>(null);
  const abrirEditarAgendamento = (p: PedidoFormatado) => {
    setPedidoAgendamento(p);
    setAgendamentoDialogAberto(true);
  };

  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();

  // Canal de venda
  const [editandoCanalId, setEditandoCanalId] = useState<string | null>(null);
  const { data: canaisVenda = [] } = useQuery({
    queryKey: ["canais-venda-empresa", unidadeAtual?.id],
    queryFn: async () => {
      // Canais fixos da unidade atual + parceiros vale gás de toda a empresa
      const filtro = unidadeAtual?.id
        ? `unidade_id.eq.${unidadeAtual.id},tipo.eq.parceiro_vale_gas`
        : `tipo.eq.parceiro_vale_gas`;
      const { data } = await supabase
        .from("canais_venda")
        .select("id, nome, tipo, unidade_id")
        .eq("ativo", true)
        .or(filtro)
        .order("nome");
      return data || [];
    }
  });
  const canaisFixos = useMemo(() => canaisVenda.filter((c: any) => c.tipo !== "parceiro_vale_gas"), [canaisVenda]);
  const canaisParceiros = useMemo(() => canaisVenda.filter((c: any) => c.tipo === "parceiro_vale_gas"), [canaisVenda]);

  const renderCanalCommand = (pedidoId: string, canalAtual: string | null | undefined) => (
    <Command>
      <CommandInput placeholder="Buscar canal..." className="h-9" />
      <CommandList className="max-h-[260px]">
        <CommandEmpty>Nenhum canal encontrado.</CommandEmpty>
        {canaisFixos.length > 0 && (
          <CommandGroup heading="Canais da unidade">
            {canaisFixos.map((c: any) => (
              <CommandItem key={c.id} value={c.nome} onSelect={() => { alterarCanalVenda(pedidoId, c.nome); setEditandoCanalId(null); }}>
                {c.nome}
                {canalAtual === c.nome && <span className="ml-auto text-xs text-primary">✓</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {canaisParceiros.length > 0 && (
          <CommandGroup heading="Parceiros Vale Gás">
            {canaisParceiros.map((c: any) => (
              <CommandItem key={c.id} value={c.nome} onSelect={() => { alterarCanalVenda(pedidoId, c.nome); setEditandoCanalId(null); }}>
                {c.nome}
                {canalAtual === c.nome && <span className="ml-auto text-xs text-primary">✓</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );

  // Import history states
  const [importItems, setImportItems] = useState<Array<{
    cliente_nome: string;data: string;valor_total: number;forma_pagamento: string;observacoes: string;
  }>>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importSaving, setImportSaving] = useState(false);

  const handleImportData = (data: any) => {
    const pedidos = data?.pedidos || [data];
    setImportItems(pedidos.map((p: any) => ({
      cliente_nome: p.cliente_nome || "", data: p.data || "", valor_total: p.valor_total || 0,
      forma_pagamento: p.forma_pagamento || "", observacoes: p.observacoes || "",
      _itens: p.itens || [], _cliente_id: p.cliente_id || null, _endereco: p.endereco || null
    })));
    setImportDialogOpen(true);
    sonnerToast.success(`${pedidos.length} pedido(s) identificado(s)!`);
  };

  const saveImportedOrders = async () => {
    const valid = importItems.filter((p: any) => p.cliente_nome && p.valor_total > 0);
    if (valid.length === 0) return;
    setImportSaving(true);
    try {
      let count = 0;
      for (const p of valid as any[]) {
        const { data: pedido, error } = await supabase.from("pedidos").insert({
          cliente_id: p._cliente_id || null, cliente_nome: p.cliente_nome,
          endereco: p._endereco || null, valor_total: p.valor_total,
          forma_pagamento: p.forma_pagamento || null, status: "entregue",
          observacoes: p.observacoes || "Importado do sistema anterior",
          data_entrega: p.data || undefined,
          created_at: p.data ? new Date(p.data + "T12:00:00-03:00").toISOString() : undefined,
          unidade_id: unidadeAtual?.id || null
        } as any).select("id").single();
        if (error) {console.error(error);continue;}
        if (pedido && p._itens?.length > 0) {
          await supabase.from("pedido_itens").insert(
            p._itens.map((it: any) => ({
              pedido_id: pedido.id, produto_id: it.produto_id || null,
              quantidade: it.quantidade || 1, preco_unitario: it.preco_unitario || 0
            }))
          );
        }
        count++;
      }
      sonnerToast.success(`${count} pedido(s) importado(s)!`);
      setImportDialogOpen(false);setImportItems([]);
    } catch (err: any) {
      sonnerToast.error("Erro ao importar: " + (err.message || "erro"));
    } finally {setImportSaving(false);}
  };

  useEffect(() => {
    const fetchEntregadores = async () => {
      setLoadingEntregadores(true);
      let query = supabase.
      from("entregadores").
      select("id, nome, status").
      eq("ativo", true).
      order("nome");

      if (unidadeAtual?.id) {
        query = query.eq("unidade_id", unidadeAtual.id);
      }

      const { data } = await query;
      if (data) setEntregadores(data);
      setLoadingEntregadores(false);
    };
    fetchEntregadores();
  }, [unidadeAtual?.id]);

  // Reset page when filters change
  useEffect(() => {setPaginaAtual(1);}, [filtroStatus, filtroEntregador, filtroOrigem, busca, dataInicio, dataFim]);
  // Quando filtrar agendados, ampliar a data para os próximos 90 dias
  useEffect(() => {
    if (filtroStatus === "agendado") {
      const d = getBrasiliaDate();
      const fim = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 90);
      const iso = `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, "0")}-${String(fim.getDate()).padStart(2, "0")}`;
      setDataInicio(hoje);
      setDataFim(iso);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroStatus]);
  // Clear selection when data changes
  useEffect(() => {setSelecionados(new Set());}, [pedidos]);

  const handleAtribuirEntregador = (pedidoId: string, entregadorId: string, entregadorNome: string) => {
    atribuirEntregador(
      { pedidoId, entregadorId },
      {
        onSuccess: () => {
          toast({ title: "Entregador atribuído!", description: `${entregadorNome} foi atribuído ao pedido.` });
          setDialogAberto(false);
          setTransferDialogAberto(false);
        },
        onError: (error) => {
          toast({ title: "Erro ao atribuir entregador", description: error.message, variant: "destructive" });
        }
      }
    );
  };

  const podeEditarCanalPedido = (pedido: PedidoFormatado) => {
    if (pedido.status === "cancelado") return false;
    if (pedido.status === "entregue" || pedido.status === "finalizado") return podeAlterarCanalFinalizado;
    return true;
  };

  const alterarCanalVenda = async (pedidoId: string, novoCanal: string) => {
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (!pedido || !podeEditarCanalPedido(pedido)) {
      toast({ title: "Alteração não permitida", description: "Somente Admin ou Gestor pode alterar o canal de pedidos já entregues ou finalizados.", variant: "destructive" });
      setEditandoCanalId(null);
      return;
    }
    const { error } = await supabase.from("pedidos").update({ canal_venda: novoCanal }).eq("id", pedidoId);
    if (error) {
      toast({ title: "Erro ao alterar canal", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Canal de venda atualizado!", description: `${pedido.canal_venda || "Não informado"} → ${novoCanal}` });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    }
    setEditandoCanalId(null);
  };

  const dataPedidoParaInput = (data: string) => {
    const partes = data.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return partes ? `${partes[3]}-${partes[2]}-${partes[1]}` : hoje;
  };

  const alterarDataEntrega = async (pedido: PedidoFormatado, novaData: string) => {
    if (!podeAlterarDataEntrega || !novaData || novaData === dataPedidoParaInput(pedido.data)) return;
    const { error } = await supabase.from("pedidos").update({ data_entrega: novaData } as any).eq("id", pedido.id);
    if (error) {
      toast({ title: "Erro ao alterar data", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Data da entrega atualizada", description: `Pedido #${getNumExib(pedido)} movido para ${novaData.split("-").reverse().join("/")}.` });
    queryClient.invalidateQueries({ queryKey: ["pedidos"] });
  };

  const alterarStatusPedido = (pedidoId: string, novoStatus: PedidoStatus) => {
    // Bloquear "entregue" sem forma de pagamento
    if (novoStatus === "entregue") {
      const pedido = pedidos.find((p) => p.id === pedidoId);
      if (pedido && !pedido.forma_pagamento) {
        toast({ title: "Forma de pagamento obrigatória", description: "Não é possível marcar como entregue sem forma de pagamento. Edite o pedido primeiro.", variant: "destructive" });
        return;
      }
    }
    const statusLabels = { pendente: "Pendente", em_rota: "Em Rota", entregue: "Entregue", cancelado: "Cancelado" };
    atualizarStatus(
      { pedidoId, novoStatus },
      {
        onSuccess: () => {toast({ title: "Status atualizado", description: `Pedido alterado para ${statusLabels[novoStatus]}.` });},
        onError: (error) => {toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });}
      }
    );
  };

  const cancelarPedido = (pedidoId: string) => alterarStatusPedido(pedidoId, "cancelado");

  const marcarPortariaHandler = (pedidoId: string) => {
    marcarPortaria(
      { pedidoId },
      {
        onSuccess: () => {toast({ title: "Portaria", description: "Pedido marcado como retirado na portaria." });},
        onError: (error: any) => {toast({ title: "Erro", description: error.message, variant: "destructive" });}
      }
    );
  };

  const marcarPortariaLoteHandler = () => {
    const ids = Array.from(selecionados);
    marcarPortariaLote(
      { pedidoIds: ids },
      {
        onSuccess: () => {
          toast({ title: "Portaria em lote", description: `${ids.length} pedido(s) marcados como portaria.` });
          setSelecionados(new Set());
        },
        onError: (error: any) => {toast({ title: "Erro", description: error.message, variant: "destructive" });}
      }
    );
  };

  const abrirVisualizacao = (pedido: PedidoFormatado) => {setPedidoView(pedido);setViewDialogAberto(true);};
  const abrirExclusao = (pedido: PedidoFormatado) => {setPedidoExcluir(pedido);setSenhaExclusao("");setSenhaErro("");setDeleteDialogAberto(true);};

  const confirmarExclusao = async () => {
    if (!pedidoExcluir) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;
    const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: senhaExclusao });
    if (authError) {setSenhaErro("Senha incorreta. Tente novamente.");return;}
    excluirPedido(
      { pedidoId: pedidoExcluir.id },
      {
        onSuccess: () => {toast({ title: "Pedido excluído", description: `Pedido #${pedidoExcluir.numero_sequencial ?? getIdCurto(pedidoExcluir.id)} foi excluído permanentemente.` });setDeleteDialogAberto(false);setPedidoExcluir(null);},
        onError: (error: any) => {toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });}
      }
    );
  };

  const abrirTransferencia = (pedido: PedidoFormatado) => {setPedidoTransferir(pedido);setTransferDialogAberto(true);};
  const editarPedido = (pedidoId: string) => navigate(`/vendas/pedidos/${pedidoId}/editar`);

  const abrirTransferenciaFilial = (pedido: PedidoFormatado) => {
    setPedidoTransferirFilial(pedido);
    setFilialSelecionadaId("");
    setFilialDialogAberto(true);
  };

  const confirmarTransferenciaFilial = async () => {
    if (!pedidoTransferirFilial || !filialSelecionadaId) return;
    setTransferindoFilial(true);
    try {
      const { error } = await supabase.
      from("pedidos").
      update({ unidade_id: filialSelecionadaId, entregador_id: null }).
      eq("id", pedidoTransferirFilial.id);
      if (error) throw error;
      const filialNome = unidades.find((u) => u.id === filialSelecionadaId)?.nome || "filial";
      toast({ title: "Pedido transferido!", description: `Pedido #${pedidoTransferirFilial.numero_sequencial ?? getIdCurto(pedidoTransferirFilial.id)} transferido para ${filialNome}.` });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      setFilialDialogAberto(false);
      setPedidoTransferirFilial(null);
    } catch (err: any) {
      toast({ title: "Erro ao transferir", description: err.message, variant: "destructive" });
    } finally {
      setTransferindoFilial(false);
    }
  };

  const imprimirPedido = async (pedido: PedidoFormatado) => {
    try {
      // Busca a unidade (loja) que originou o pedido p/ emitir recibo com os dados corretos
      let unidadeRecibo: any = unidadeAtual;
      try {
        const { data: pedidoRow } = await supabase
          .from("pedidos")
          .select("unidade_id")
          .eq("id", pedido.id)
          .maybeSingle();
        const uid = (pedidoRow as any)?.unidade_id;
        if (uid) {
          const { data: u } = await supabase
            .from("unidades")
            .select("nome, cnpj, telefone, endereco, bairro, cidade, estado, cep")
            .eq("id", uid)
            .maybeSingle();
          if (u) unidadeRecibo = u;
        }
      } catch {}

      // Mensagem de cupom (vinda das configurações da empresa)
      let empresaConfig: EmpresaConfig | undefined;
      try {
        let cfgQuery = supabase
          .from("configuracoes_empresa")
          .select("mensagem_cupom")
          .limit(1);
        if (empresa?.id) cfgQuery = cfgQuery.eq("empresa_id", empresa.id);
        const { data: configData } = await cfgQuery.maybeSingle();

        const enderecoUnidade = [
          unidadeRecibo?.endereco,
          unidadeRecibo?.bairro,
          [unidadeRecibo?.cidade, unidadeRecibo?.estado].filter(Boolean).join("/"),
          unidadeRecibo?.cep,
        ].filter(Boolean).join(", ");

        empresaConfig = {
          nome_empresa: unidadeRecibo?.nome || empresa?.nome || "Empresa",
          cnpj: unidadeRecibo?.cnpj ?? null,
          telefone: unidadeRecibo?.telefone ?? null,
          endereco: enderecoUnidade || null,
          mensagem_cupom: configData?.mensagem_cupom ?? null,
        };
      } catch {
        empresaConfig = { nome_empresa: unidadeRecibo?.nome || empresa?.nome || "Empresa" };
      }

      // Pagamentos: o pedido só armazena 'forma_pagamento' (string).
      const formas = (pedido.forma_pagamento || "dinheiro")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const valorPorForma = pedido.valor / Math.max(1, formas.length);
      const pagamentosFinal = formas.map((forma, idx) => ({
        id: String(idx + 1),
        forma,
        valor: valorPorForma,
      }));

      const itensReceipt = pedido.itens.map((it) => ({
        id: it.id,
        produto_id: it.produto_id || "",
        nome: it.produto?.nome || "Produto",
        preco_unitario: Number(it.preco_unitario) || 0,
        quantidade: Number(it.quantidade) || 0,
        total: (Number(it.preco_unitario) || 0) * (Number(it.quantidade) || 0),
      }));

      // parse data dd/MM/yyyy HH:mm or ISO
      let dataPedido = new Date();
      try {
        const m = pedido.data.match(/(\d{2})\/(\d{2})\/(\d{4})[ ,]+(\d{2}):(\d{2})/);
        if (m) dataPedido = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
        else if (pedido.data) dataPedido = new Date(pedido.data);
      } catch {}

      generateReceiptPdf({
        pedidoId: pedido.id,
        pedidoNumero: pedido.numero_sequencial ?? null,
        data: dataPedido,
        cliente: {
          nome: pedido.cliente,
          telefone: "",
          endereco: pedido.endereco,
        },
        itens: itensReceipt as any,
        pagamentos: pagamentosFinal as any,
        entregadorNome: pedido.entregador || null,
        canalVenda: pedido.canal_venda || "balcao",
        observacoes: pedido.observacoes,
        empresa: empresaConfig,
      });
    } catch (e: any) {
      toast({ title: "Erro ao imprimir", description: e?.message || "Falha ao gerar comprovante", variant: "destructive" });
    }
  };

  const enviarWhatsApp = (pedido: PedidoFormatado) => {
    const idCurto = getNumeroExibicao(pedido);
    const itensTexto = pedido.itens.map((item) => `  • ${item.quantidade}x ${item.produto?.nome || 'Produto'}`).join("\n");
    const mensagem = encodeURIComponent(
      `*Pedido #${idCurto}*\n\n📦 *Produtos:*\n${itensTexto || pedido.produtos}\n\n💰 *Valor:* R$ ${pedido.valor.toFixed(2)}\n📍 *Endereço:* ${pedido.endereco}\n📅 *Data:* ${pedido.data}\n${pedido.observacoes ? `📝 *Obs:* ${pedido.observacoes}\n` : ''}\nObrigado pela preferência!`
    );
    window.open(`https://wa.me/?text=${mensagem}`, '_blank');
  };

  // #6 - unique entregadores from pedidos for filter
  const entregadoresNoPeriodo = useMemo(() => {
    const names = new Set<string>();
    pedidos.forEach((p) => {if (p.entregador) names.add(p.entregador);});
    return Array.from(names).sort();
  }, [pedidos]);

  // Filter pedidos
  const pedidosFiltrados = useMemo(() => {
    const buscaLower = busca.toLowerCase().trim();
    const buscaDigits = buscaLower.replace(/\D/g, "");
    return pedidos.filter((p) => {
      const matchStatus =
        filtroStatus === "todos"
          ? true
          : filtroStatus === "agendado"
            ? !!p.agendado && p.status !== "cancelado" && p.status !== "entregue" && p.status !== "finalizado"
            : p.status === filtroStatus;
      const matchEntregador = filtroEntregador === "todos" || (
      filtroEntregador === "sem_entregador" ? !p.entregador : p.entregador === filtroEntregador);
      const matchOrigem = filtroOrigem === "todos" || (p.origem_pedido || "erp") === filtroOrigem;
      const matchBusca = busca === "" ||
      p.cliente.toLowerCase().includes(buscaLower) ||
      p.endereco.toLowerCase().includes(buscaLower) ||
      p.id.toLowerCase().includes(buscaLower) ||
      (p.numero_sequencial != null && buscaDigits !== "" && String(p.numero_sequencial).includes(buscaDigits)) ||
      (p.entregador && p.entregador.toLowerCase().includes(buscaLower));
      return matchStatus && matchEntregador && matchOrigem && matchBusca;
    });
  }, [pedidos, filtroStatus, filtroEntregador, filtroOrigem, busca]);

  const resumoProdutos = useMemo<ResumoProduto[]>(() => {
    const produtos = new Map<string, ResumoProduto>();
    pedidosFiltrados
      .filter((pedido) => pedido.status !== "cancelado")
      .forEach((pedido) => {
        pedido.itens.forEach((item) => {
          const nome = item.produto?.nome || "Produto não identificado";
          const atual = produtos.get(nome) || { nome, quantidade: 0, total: 0 };
          const quantidade = Number(item.quantidade) || 0;
          atual.quantidade += quantidade;
          atual.total += quantidade * (Number(item.preco_unitario) || 0);
          produtos.set(nome, atual);
        });
      });
    return Array.from(produtos.values()).sort((a, b) => b.quantidade - a.quantidade);
  }, [pedidosFiltrados]);

  const totalItensVendidos = useMemo(() => resumoProdutos.reduce((acc, produto) => acc + produto.quantidade, 0), [resumoProdutos]);

  // #4 - Pagination
  const totalPages = Math.max(1, Math.ceil(pedidosFiltrados.length / ITEMS_PER_PAGE));
  const pedidosPaginados = pedidosFiltrados.slice((paginaAtual - 1) * ITEMS_PER_PAGE, paginaAtual * ITEMS_PER_PAGE);

  const pedidosPendentes = pedidos.filter((p) => p.status === "pendente" && !p.entregador);

  // Counters
  const contadores = {
    pendente: pedidos.filter((p) => p.status === "pendente").length,
    em_rota: pedidos.filter((p) => p.status === "em_rota").length,
    entregue: pedidos.filter((p) => p.status === "entregue").length,
    cancelado: pedidos.filter((p) => p.status === "cancelado").length,
    total: pedidos.filter((p) => p.status !== "cancelado").reduce((acc, p) => acc + p.valor, 0)
  };

  // #5 - Payment method breakdown
  const pagamentoContadores = useMemo(() => {
    const map = new Map<string, number>();
    pedidos.filter((p) => p.status !== "cancelado").forEach((p) => {
      const method = p.forma_pagamento || "Não informado";
      map.set(method, (map.get(method) || 0) + p.valor);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [pedidos]);

  // Helper: número curto do UUID (legado), e número de exibição (sequencial > UUID curto)
  const getIdCurto = (id: string) => id.substring(0, 8).toUpperCase();
  const getNumExib = (p: PedidoFormatado) => p.numero_sequencial != null ? String(p.numero_sequencial) : getIdCurto(p.id);

  const getStatusBadgeEntregador = (status: string | null) => {
    switch (status) {
      case "disponivel":return <Badge variant="default" className="text-[10px] ml-2">Disponível</Badge>;
      case "em_rota":return <Badge variant="secondary" className="text-[10px] ml-2">Em Rota</Badge>;
      case "indisponivel":return <Badge variant="destructive" className="text-[10px] ml-2">Indisponível</Badge>;
      default:return null;
    }
  };

  // #7 - Batch actions
  const toggleSelecionado = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);else next.add(id);
      return next;
    });
  };

  const toggleSelecionarTodos = () => {
    if (selecionados.size === pedidosPaginados.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(pedidosPaginados.map((p) => p.id)));
    }
  };

  const executarAcaoLote = (novoStatus: PedidoStatus) => {
    const ids = Array.from(selecionados);
    atualizarStatusLote(
      { pedidoIds: ids, novoStatus },
      {
        onSuccess: () => {
          toast({ title: "Status atualizado em lote", description: `${ids.length} pedido(s) atualizados.` });
          setSelecionados(new Set());
          setBatchDialogAberto(false);
        },
        onError: (error) => {toast({ title: "Erro", description: error.message, variant: "destructive" });}
      }
    );
  };

  const executarEntregadorLote = (entregadorId: string, entregadorNome: string) => {
    const ids = Array.from(selecionados);
    atribuirEntregadorLote(
      { pedidoIds: ids, entregadorId },
      {
        onSuccess: () => {
          toast({ title: "Entregador atribuído em lote", description: `${entregadorNome} atribuído a ${ids.length} pedido(s).` });
          setSelecionados(new Set());
          setBatchDialogAberto(false);
        },
        onError: (error) => {toast({ title: "Erro", description: error.message, variant: "destructive" });}
      }
    );
  };

  return (
    <MainLayout>
      {/* #2 - removed duplicate title, kept only Header */}
      <Header title="Pedidos" subtitle="Gerenciar pedidos de venda" />
      <div className="p-3 md:p-6 space-y-4 md:space-y-6 w-full min-w-0 max-w-full overflow-x-hidden">

        {/* Top action */}
        <div className="gap-2 flex flex-wrap items-center justify-center sm:justify-start w-full min-w-0">
          <Button className="h-10 min-w-0 bg-accent text-accent-foreground shadow-accent/25 hover:bg-accent/90 hover:shadow-accent/30" onClick={() => navigate("/vendas/nova")}>
            <span className="truncate">+ Novo Pedido</span>
          </Button>
          <SmartImportButtons
            edgeFunctionName="parse-orders-history"
            onDataExtracted={handleImportData}
            mode="menu"
            menuLabel="Mais ações"
            extraMenuContent={
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    exportarPedidosCSV(pedidosFiltrados);
                    sonnerToast.success(`CSV exportado com ${pedidosFiltrados.length} pedido(s)`);
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </DropdownMenuItem>
              </>
            }
          />
          <Button variant="outline" className="h-10 min-w-0" onClick={() => navigate("/operacional/centro")}>
            <MapIcon className="h-4 w-4 mr-2 shrink-0" />
            <span className="truncate">Mapa Operacional</span>
          </Button>
          {(() => {
            const filtrosAtivos =
              (busca ? 1 : 0) +
              (filtroStatus !== "todos" ? 1 : 0) +
              (filtroEntregador !== "todos" ? 1 : 0) +
              (dataInicio !== hoje || dataFim !== hoje ? 1 : 0);
            return (
              <Button variant="outline" className="h-10 min-w-0 relative" onClick={() => setFiltrosAbertos(true)}>
                <SlidersHorizontal className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">Mais Filtros</span>
                {filtrosAtivos > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">{filtrosAtivos}</Badge>
                )}
              </Button>
            );
          })()}
        </div>

        {/* Filters Dialog */}
        <ResponsiveDialog open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
          <ResponsiveDialogContent className="sm:max-w-lg">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Filtros</ResponsiveDialogTitle>
            </ResponsiveDialogHeader>
            <div className="flex flex-col gap-3 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar nº pedido, cliente, endereço..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="h-10 pl-9" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground block">Início</label>
                  <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-10 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground block">Fim</label>
                  <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-10 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground block">Status</label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos Status</SelectItem>
                    <SelectItem value="agendado">📅 Agendados</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_rota">Em Rota</SelectItem>
                    <SelectItem value="entregue">Entregue</SelectItem>
                    <SelectItem value="finalizado">Finalizado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground block">Entregador</label>
                <Select value={filtroEntregador} onValueChange={setFiltroEntregador}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Entregador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos Entregadores</SelectItem>
                    <SelectItem value="sem_entregador">Sem entregador</SelectItem>
                    {entregadoresNoPeriodo.map((nome) =>
                      <SelectItem key={nome} value={nome}>{nome}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground block">Origem do pedido</label>
                <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas Origens</SelectItem>
                    {ORIGENS_PEDIDO.map((o) => (
                      <SelectItem key={o} value={o}>{ORIGEM_PEDIDO_META[o].icon} {ORIGEM_PEDIDO_META[o].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ResponsiveDialogFooter className="gap-2">
              <Button variant="outline" onClick={() => {setBusca("");setDataInicio(hoje);setDataFim(hoje);setFiltroStatus("todos");setFiltroEntregador("todos");setFiltroOrigem("todos");}}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Limpar
              </Button>
              <Button onClick={() => setFiltrosAbertos(false)}>Aplicar</Button>
            </ResponsiveDialogFooter>
          </ResponsiveDialogContent>
        </ResponsiveDialog>


        {/* Alert for old pending orders */}
        {(() => {
          const now = new Date();
          const pedidosAntigos = pedidos.filter((p) => {
            if (p.status !== "pendente" && p.status !== "em_rota") return false;
            const dataStr = p.data; // "dd/mm/yyyy HH:mm" format
            const parts = dataStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
            if (!parts) return false;
            const createdAt = new Date(+parts[3], +parts[2] - 1, +parts[1], +parts[4], +parts[5]);
            const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
            return diffHours > 24;
          });
          if (pedidosAntigos.length === 0) return null;
          return (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                    <Clock className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-destructive">⚠️ {pedidosAntigos.length} pedido(s) pendente(s) há mais de 24h</p>
                    <p className="text-xs text-muted-foreground">
                      Verifique se já foram entregues e atualize o status para evitar inconsistências no acerto financeiro.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 text-xs border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => setFiltroStatus("pendente")}>
                    Ver pendentes
                  </Button>
                </div>
              </CardContent>
            </Card>);

        })()}

        {/* AI suggestion for pending orders */}
        {pedidosPendentes.length > 0 &&
        <Card className="modern-panel border-info/25 bg-info/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="status-card-icon status-card-icon-info">
                  <Sparkles />
                </div>
                <div>
                  <p className="font-medium">Sugestão Inteligente</p>
                  <p className="text-sm text-muted-foreground">
                    {pedidosPendentes.length} pedido(s) pendente(s) sem entregador atribuído
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {pedidosPendentes.slice(0, 3).map((pedido) =>
              <Dialog
                key={pedido.id}
                open={dialogAberto && pedidoSelecionado?.id === pedido.id}
                onOpenChange={(open) => {setDialogAberto(open);if (!open) setPedidoSelecionado(null);}}>
                
                    <DialogTrigger asChild>
                      <div
                    className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border cursor-pointer hover:shadow-md transition-all"
                    onClick={() => setPedidoSelecionado(pedido)}>
                    
                        <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-warning" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{pedido.cliente}</p>
                          <p className="text-xs text-muted-foreground truncate">{pedido.endereco}</p>
                        </div>
                        <Button size="sm" variant="outline">
                          <Sparkles className="h-3 w-3 mr-1" /> IA
                        </Button>
                      </div>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Sugerir Entregador - Pedido #{getNumExib(pedido)}</DialogTitle>
                        <DialogDescription>
                          Selecione o entregador mais adequado para este pedido.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="font-medium">{pedido.cliente}</p>
                          <p className="text-sm text-muted-foreground">{pedido.endereco}</p>
                          <p className="text-sm mt-2">{pedido.produtos}</p>
                        </div>
                        <SugestaoEntregador
                      endereco={pedido.endereco}
                      onSelecionar={(id, nome) => handleAtribuirEntregador(pedido.id, String(id), nome)} />
                    
                      </div>
                    </DialogContent>
                  </Dialog>
              )}
              </div>
            </CardContent>
          </Card>
        }


        {/* Stats - compact KPIs, 5 across on md+ */}
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
          <Card className="kpi-card kpi-card-warning">
            <CardContent className="flex items-center gap-2 p-2.5">
              <div className="status-card-icon status-card-icon-warning h-8 w-8 [&_svg]:h-4 [&_svg]:w-4"><Clock /></div>
              <div className="min-w-0"><p className="text-lg font-bold leading-none text-warning">{contadores.pendente}</p><p className="text-[11px] text-muted-foreground mt-0.5">Pendentes</p></div>
            </CardContent>
          </Card>
          <Card className="kpi-card kpi-card-info">
            <CardContent className="flex items-center gap-2 p-2.5">
              <div className="status-card-icon status-card-icon-info h-8 w-8 [&_svg]:h-4 [&_svg]:w-4"><Truck /></div>
              <div className="min-w-0"><p className="text-lg font-bold leading-none text-info">{contadores.em_rota}</p><p className="text-[11px] text-muted-foreground mt-0.5">Em Rota</p></div>
            </CardContent>
          </Card>
          <Card className="kpi-card kpi-card-success">
            <CardContent className="flex items-center gap-2 p-2.5">
              <div className="status-card-icon status-card-icon-success h-8 w-8 [&_svg]:h-4 [&_svg]:w-4"><CheckCircle /></div>
              <div className="min-w-0"><p className="text-lg font-bold leading-none text-success">{contadores.entregue}</p><p className="text-[11px] text-muted-foreground mt-0.5">Entregues</p></div>
            </CardContent>
          </Card>
          <Card className="kpi-card kpi-card-destructive">
            <CardContent className="flex items-center gap-2 p-2.5">
              <div className="status-card-icon status-card-icon-destructive h-8 w-8 [&_svg]:h-4 [&_svg]:w-4"><XCircle /></div>
              <div className="min-w-0"><p className="text-lg font-bold leading-none text-destructive">{contadores.cancelado}</p><p className="text-[11px] text-muted-foreground mt-0.5">Cancelados</p></div>
            </CardContent>
          </Card>
          <Card className="kpi-card kpi-card-success col-span-2 sm:col-span-3 md:col-span-1">
            <CardContent className="flex items-center gap-2 p-2.5">
              <div className="status-card-icon status-card-icon-success h-8 w-8 [&_svg]:h-4 [&_svg]:w-4"><DollarSign /></div>
              <div className="min-w-0">
                <p className="text-base md:text-sm lg:text-base font-bold leading-none text-success truncate">R$ {contadores.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Total Vendas</p>
              </div>
            </CardContent>
          </Card>
        </div>



        {/* #7 - Batch actions bar */}
        {selecionados.size > 0 &&
        <Card className="modern-panel border-primary/25 bg-primary/5">
            <CardContent className="flex items-center gap-3 p-3 flex-wrap">
              <CheckSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{selecionados.size} selecionado(s)</span>
              <div className="flex gap-2 ml-auto flex-wrap">
                <Button size="sm" variant="outline" onClick={() => {setBatchAction("status");setBatchDialogAberto(true);}}>
                  Alterar Status
                </Button>
                <Button size="sm" variant="outline" onClick={() => {setBatchAction("entregador");setBatchDialogAberto(true);}}>
                  Atribuir Entregador
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={marcarPortariaLoteHandler}>
                  <Building2 className="h-3.5 w-3.5" /> Portaria
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}>Limpar</Button>
              </div>
            </CardContent>
          </Card>
        }

        {/* Table - #3 responsive with hidden columns on mobile */}
        <Card className="modern-panel overflow-hidden">
          <CardHeader className="section-header-catalog pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="section-header-title">Pedidos ({pedidosFiltrados.length})</CardTitle>
              {/* #4 - Pagination info */}
              <span className="text-xs font-medium text-info-foreground/80">
                Pág. {paginaAtual}/{totalPages}
              </span>
            </div>
          </CardHeader>
          <CardContent className="saas-table-scope overflow-x-auto max-w-full p-0 md:p-6">
            {isLoading ?
            <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div> :
            pedidosFiltrados.length === 0 ?
            <div className="text-center py-8 text-muted-foreground"><p>Nenhum pedido encontrado.</p></div> :

            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden px-3 pb-3 w-full min-w-0">
                {pedidosPaginados.map((pedido) => (
                  <div key={pedido.id} className={`border border-border/45 bg-card rounded-2xl p-3 space-y-2 w-full min-w-0 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${pedido.status === "cancelado" ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-2 w-full min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Checkbox checked={selecionados.has(pedido.id)} onCheckedChange={() => toggleSelecionado(pedido.id)} className="shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <OrigemBadge origem={pedido.origem_pedido} />
                            <Button variant="link" className="font-medium p-0 h-auto text-primary text-xs truncate max-w-full" onClick={() => editarPedido(pedido.id)}>
                              #{getNumExib(pedido)}
                            </Button>
                          </div>
                          <p className="text-sm font-medium truncate">{pedido.cliente}</p>
                          {pedido.agendado && pedido.data_agendamento && (
                            <Badge variant="secondary" className="mt-1 text-[10px] gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20">
                              <Calendar className="h-3 w-3" />
                              {new Date(pedido.data_agendamento).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => abrirVisualizacao(pedido)}><Eye className="h-4 w-4 mr-2" />Visualizar</DropdownMenuItem>
                          {pedido.status !== "cancelado" && pedido.status !== "entregue" && <DropdownMenuItem onClick={() => editarPedido(pedido.id)}><Edit className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>}
                          {pedido.agendado && pedido.status !== "cancelado" && pedido.status !== "entregue" && <DropdownMenuItem onClick={() => abrirEditarAgendamento(pedido)}><Calendar className="h-4 w-4 mr-2" />Editar agendamento</DropdownMenuItem>}
                          {pedido.status !== "cancelado" && pedido.status !== "entregue" && <DropdownMenuItem onClick={() => abrirTransferencia(pedido)}><ArrowRightLeft className="h-4 w-4 mr-2" />{pedido.entregador ? "Transferir" : "Atribuir"} Entregador</DropdownMenuItem>}
                          {pedido.status !== "cancelado" && pedido.status !== "entregue" && <DropdownMenuItem onClick={() => marcarPortariaHandler(pedido.id)}><Building2 className="h-4 w-4 mr-2" />Portaria (Retirada)</DropdownMenuItem>}
                          {unidades.length > 1 && <DropdownMenuItem onClick={() => abrirTransferenciaFilial(pedido)}><MoveRight className="h-4 w-4 mr-2" />Transferir p/ Filial</DropdownMenuItem>}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => imprimirPedido(pedido)}><Printer className="h-4 w-4 mr-2" />Imprimir</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => enviarWhatsApp(pedido)}><MessageCircle className="h-4 w-4 mr-2" />WhatsApp</DropdownMenuItem>
                          {pedido.status === "entregue" && (
                            <DropdownMenuItem onClick={async () => {
                              try {
                                await gerarComprovanteEntregaPdf({ pedidoId: pedido.id });
                              } catch (e: any) {
                                toast({ title: "Erro ao gerar PDF", description: e.message, variant: "destructive" });
                              }
                            }}><Download className="h-4 w-4 mr-2" />Comprovante de Entrega (PDF)</DropdownMenuItem>
                          )}
                          {pedido.status !== "cancelado" && pedido.status !== "entregue" && <>
                            <DropdownMenuSeparator />
                            {pedido.status !== "em_rota" && <DropdownMenuItem onClick={() => alterarStatusPedido(pedido.id, "em_rota")}><Truck className="h-4 w-4 mr-2" />Marcar Em Rota</DropdownMenuItem>}
                            <DropdownMenuItem onClick={() => alterarStatusPedido(pedido.id, "entregue")}><CheckCircle className="h-4 w-4 mr-2" />Marcar Entregue</DropdownMenuItem>
                            {pedido.status !== "pendente" && <DropdownMenuItem onClick={() => alterarStatusPedido(pedido.id, "pendente")}><Clock className="h-4 w-4 mr-2" />Voltar p/ Pendente</DropdownMenuItem>}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => cancelarPedido(pedido.id)}><XCircle className="h-4 w-4 mr-2" />Cancelar Pedido</DropdownMenuItem>
                          </>}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => abrirExclusao(pedido)}><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{pedido.endereco}</p>
                    <p className="text-xs truncate" title={formatarItensComQtd(pedido)}>{formatarItensComQtd(pedido)}</p>
                    <div className="flex items-center justify-between gap-2 flex-wrap w-full min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                        <StatusDropdown status={pedido.status} onStatusChange={(s) => alterarStatusPedido(pedido.id, s)} disabled={isUpdating} />
                        {pedido.entregador && <Badge variant="outline" className="text-[10px] max-w-[140px] truncate"><Truck className="h-3 w-3 mr-1 shrink-0" /><span className="truncate">{pedido.entregador}</span></Badge>}
                      </div>
                      <span className="font-bold text-sm shrink-0">R$ {pedido.valor.toFixed(2)}</span>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Canal de venda</label>
                      {podeEditarCanalPedido(pedido) ?
                      <Popover open={editandoCanalId === `m-${pedido.id}`} onOpenChange={(open) => setEditandoCanalId(open ? `m-${pedido.id}` : null)}>
                        <PopoverTrigger asChild>
                          <button className="h-8 text-[11px] w-full inline-flex items-center justify-between gap-2 rounded-md border border-input bg-background px-2 hover:bg-accent transition-colors">
                            <span className="truncate">{pedido.canal_venda || "Selecionar canal"}</span>
                            <Pencil className="h-3 w-3 text-muted-foreground shrink-0" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-0 bg-popover border border-border shadow-lg z-50" align="start">
                          {renderCanalCommand(pedido.id, pedido.canal_venda)}
                        </PopoverContent>
                      </Popover> :
                      <Badge variant="outline" className="text-[10px]">{pedido.canal_venda || "Canal não informado"}</Badge>}
                    </div>
                    {podeAlterarDataEntrega ?
                    <Input type="date" defaultValue={dataPedidoParaInput(pedido.data)} onChange={(e) => alterarDataEntrega(pedido, e.target.value)} className="h-8 text-[11px]" /> :
                    <p className="text-[10px] text-muted-foreground truncate">{pedido.data}</p>}
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="overflow-x-auto min-w-0 hidden md:block">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selecionados.size === pedidosPaginados.length && pedidosPaginados.length > 0}
                          onCheckedChange={toggleSelecionarTodos} />
                      </TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Nº Pedido</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="min-w-[200px]">Cliente</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Produtos</TableHead>
                      <TableHead>Entregador</TableHead>
                      <TableHead>Canal de Venda</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pedidosPaginados.map((pedido) =>
                    <TableRow key={pedido.id} className={pedido.status === "cancelado" ? "opacity-60" : ""}>
                        <TableCell>
                          <Checkbox checked={selecionados.has(pedido.id)} onCheckedChange={() => toggleSelecionado(pedido.id)} />
                        </TableCell>
                        <TableCell>
                          <OrigemBadge origem={pedido.origem_pedido} />
                        </TableCell>
                        <TableCell>
                          <Button variant="link" className="font-medium p-0 h-auto text-primary text-xs" onClick={() => editarPedido(pedido.id)}>
                            #{getNumExib(pedido)}
                          </Button>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {podeAlterarDataEntrega ?
                        <Input type="date" defaultValue={dataPedidoParaInput(pedido.data)} onChange={(e) => alterarDataEntrega(pedido, e.target.value)} className="h-8 w-[140px] text-xs" /> :
                        pedido.data}
                        </TableCell>
                        <TableCell className="font-medium text-sm min-w-[200px] max-w-[260px] truncate" title={pedido.cliente}>{pedido.cliente}</TableCell>
                        <TableCell className="max-w-[180px] truncate text-muted-foreground text-xs" title={pedido.endereco}>{pedido.endereco}</TableCell>
                        <TableCell className="max-w-[180px] truncate text-xs" title={formatarItensComQtd(pedido)}>{formatarItensComQtd(pedido)}</TableCell>
                        <TableCell>
                          {pedido.entregador ?
                        <Badge variant="outline" className="cursor-pointer hover:bg-accent text-xs" onClick={() => abrirTransferencia(pedido)}>
                              <Truck className="h-3 w-3 mr-1" />{pedido.entregador}
                            </Badge> :
                        pedido.status !== "cancelado" && pedido.status !== "entregue" ?
                        <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="text-primary h-6 px-2 text-xs" onClick={() => abrirTransferencia(pedido)}>
                                <Sparkles className="h-3 w-3 mr-1" /> Atribuir
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => marcarPortariaHandler(pedido.id)} title="Retirada na portaria">
                                <Building2 className="h-3 w-3" />
                              </Button>
                            </div> :
                        <span className="text-muted-foreground text-xs">-</span>}
                        </TableCell>
                        <TableCell className="text-xs">
                          {podeEditarCanalPedido(pedido) ?
                          <Popover open={editandoCanalId === `d-${pedido.id}`} onOpenChange={(open) => setEditandoCanalId(open ? `d-${pedido.id}` : null)}>
                            <PopoverTrigger asChild>
                              <span
                                role="button"
                                tabIndex={0}
                                className="inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setEditandoCanalId(`d-${pedido.id}`);
                                  }
                                }}
                              >
                                <Badge variant="outline" className="text-xs">{pedido.canal_venda || "-"}</Badge>
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </span>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-0 bg-popover border border-border shadow-lg z-50" align="start">
                              {renderCanalCommand(pedido.id, pedido.canal_venda)}
                            </PopoverContent>
                          </Popover> :
                          <Badge variant="outline" className="text-xs">{pedido.canal_venda || "-"}</Badge>}
                        </TableCell>
                        <TableCell className="font-medium text-sm">R$ {pedido.valor.toFixed(2)}</TableCell>
                        <TableCell>
                          <StatusDropdown status={pedido.status} onStatusChange={(s) => alterarStatusPedido(pedido.id, s)} disabled={isUpdating} />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => abrirVisualizacao(pedido)}><Eye className="h-4 w-4 mr-2" />Visualizar</DropdownMenuItem>
                              {pedido.status !== "cancelado" && pedido.status !== "entregue" &&
                            <DropdownMenuItem onClick={() => editarPedido(pedido.id)}><Edit className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                            }
                              {pedido.agendado && pedido.status !== "cancelado" && pedido.status !== "entregue" &&
                            <DropdownMenuItem onClick={() => abrirEditarAgendamento(pedido)}><Calendar className="h-4 w-4 mr-2" />Editar agendamento</DropdownMenuItem>
                            }
                              {pedido.status !== "cancelado" && pedido.status !== "entregue" &&
                            <DropdownMenuItem onClick={() => abrirTransferencia(pedido)}><ArrowRightLeft className="h-4 w-4 mr-2" />{pedido.entregador ? "Transferir" : "Atribuir"} Entregador</DropdownMenuItem>
                            }
              {pedido.status !== "cancelado" && pedido.status !== "entregue" &&
                            <DropdownMenuItem onClick={() => marcarPortariaHandler(pedido.id)}><Building2 className="h-4 w-4 mr-2" />Portaria (Retirada)</DropdownMenuItem>
                            }
                              {unidades.length > 1 &&
                            <DropdownMenuItem onClick={() => abrirTransferenciaFilial(pedido)}>
                                  <MoveRight className="h-4 w-4 mr-2" />Transferir p/ Filial
                                </DropdownMenuItem>
                            }
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => imprimirPedido(pedido)}><Printer className="h-4 w-4 mr-2" />Imprimir</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => enviarWhatsApp(pedido)}><MessageCircle className="h-4 w-4 mr-2" />WhatsApp</DropdownMenuItem>
                              {pedido.status !== "cancelado" && pedido.status !== "entregue" &&
                            <>
                                  <DropdownMenuSeparator />
                                  {pedido.status !== "em_rota" &&
                              <DropdownMenuItem onClick={() => alterarStatusPedido(pedido.id, "em_rota")}><Truck className="h-4 w-4 mr-2" />Marcar Em Rota</DropdownMenuItem>
                              }
                                  <DropdownMenuItem onClick={() => alterarStatusPedido(pedido.id, "entregue")}><CheckCircle className="h-4 w-4 mr-2" />Marcar Entregue</DropdownMenuItem>
                                  {pedido.status !== "pendente" &&
                              <DropdownMenuItem onClick={() => alterarStatusPedido(pedido.id, "pendente")}><Clock className="h-4 w-4 mr-2" />Voltar p/ Pendente</DropdownMenuItem>
                              }
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => cancelarPedido(pedido.id)}><XCircle className="h-4 w-4 mr-2" />Cancelar Pedido</DropdownMenuItem>
                                </>
                            }
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => abrirExclusao(pedido)}><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* #4 - Pagination controls */}
              {totalPages > 1 &&
              <div className="flex items-center justify-between mt-4 pt-4 border-t px-3 md:px-6 pb-3 md:pb-0">
                  <p className="text-xs text-muted-foreground">
                    {(paginaAtual - 1) * ITEMS_PER_PAGE + 1}–{Math.min(paginaAtual * ITEMS_PER_PAGE, pedidosFiltrados.length)} de {pedidosFiltrados.length}
                  </p>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={paginaAtual === 1} onClick={() => setPaginaAtual((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={paginaAtual === totalPages} onClick={() => setPaginaAtual((p) => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              }
            </>
            }
          </CardContent>
        </Card>

        {/* Product sold summary: follows current period/status/driver/search filters and ignores cancelled orders */}
        {resumoProdutos.length > 0 &&
        <Card className="modern-panel">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4 text-primary" />Produtos Vendidos</CardTitle>
              <Badge variant="secondary">{totalItensVendidos.toLocaleString("pt-BR")} itens</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Quantidade por produto considerando os filtros aplicados.</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              {resumoProdutos.map((produto) =>
              <div key={produto.nome} className="rounded-xl border bg-background px-3 py-2 min-w-0 sm:min-w-[150px]">
                <p className="text-xs text-muted-foreground truncate" title={produto.nome}>{produto.nome}</p>
                <p className="text-lg font-bold leading-tight">{produto.quantidade.toLocaleString("pt-BR")}</p>
                <p className="text-[11px] text-muted-foreground truncate">R$ {produto.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </div>
              )}
            </div>
          </CardContent>
        </Card>
        }

        {/* Resumo Financeiro - breakdown por forma de pagamento */}
        {pagamentoContadores.length > 0 &&
        <Card className="modern-panel">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" />Resumo Financeiro</CardTitle>
              <Badge variant="secondary">R$ {contadores.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Recebimentos por forma de pagamento (ignora cancelados).</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {pagamentoContadores.map(([method, valor]) => {
                const pct = contadores.total > 0 ? Math.round(valor / contadores.total * 100) : 0;
                return (
                  <div key={method} className="rounded-xl border bg-background px-3 py-2 min-w-0">
                    <p className="text-xs text-muted-foreground truncate capitalize" title={method}>{method}</p>
                    <p className="text-lg font-bold leading-tight">R$ {valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    <p className="text-[11px] text-muted-foreground">{pct}% do total</p>
                  </div>
                );
              })}
              <div className="rounded-xl border border-success/40 bg-success/5 px-3 py-2 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Total Geral</p>
                <p className="text-lg font-bold leading-tight text-success">R$ {contadores.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <p className="text-[11px] text-muted-foreground">100%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        }



        <PedidoViewDialog pedido={pedidoView} open={viewDialogAberto} onOpenChange={setViewDialogAberto} onCancelar={cancelarPedido} />

        {/* Transfer/Assign driver dialog */}
        <Dialog open={transferDialogAberto} onOpenChange={setTransferDialogAberto}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                {pedidoTransferir?.entregador ? "Transferir Entregador" : "Atribuir Entregador"}
              </DialogTitle>
              <DialogDescription>
                Escolha o entregador responsável por este pedido.
              </DialogDescription>
            </DialogHeader>
            {pedidoTransferir &&
            <div className="space-y-4 mt-2">
                <div className="p-4 bg-muted rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">Pedido #{getNumExib(pedidoTransferir)}</p>
                    <Badge variant="outline">R$ {pedidoTransferir.valor.toFixed(2)}</Badge>
                  </div>
                  <p className="text-sm">{pedidoTransferir.cliente}</p>
                  <p className="text-xs text-muted-foreground">{pedidoTransferir.endereco}</p>
                  {pedidoTransferir.entregador &&
                <p className="text-xs text-muted-foreground mt-2">Atual: <span className="font-medium text-foreground">{pedidoTransferir.entregador}</span></p>
                }
                </div>
                <div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2"><Sparkles className="h-3 w-3" />Sugestão inteligente</div>
                  <SugestaoEntregador endereco={pedidoTransferir.endereco} onSelecionar={(id, nome) => handleAtribuirEntregador(pedidoTransferir.id, String(id), nome)} compact />
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Ou selecione manualmente:</p>
                  <Select
                  onValueChange={(entregadorId) => {const ent = entregadores.find((e) => e.id === entregadorId);if (ent) handleAtribuirEntregador(pedidoTransferir.id, ent.id, ent.nome);}}
                  disabled={loadingEntregadores}>
                  
                    <SelectTrigger><SelectValue placeholder={loadingEntregadores ? "Carregando..." : "Selecione o entregador"} /></SelectTrigger>
                    <SelectContent>
                      {entregadores.filter((e) => e.id !== pedidoTransferir.entregador_id).map((ent) =>
                    <SelectItem key={ent.id} value={ent.id}>
                          <div className="flex items-center"><span>{ent.nome}</span>{getStatusBadgeEntregador(ent.status)}</div>
                        </SelectItem>
                    )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            }
          </DialogContent>
        </Dialog>

        {/* Delete with password dialog */}
        <AlertDialog open={deleteDialogAberto} onOpenChange={setDeleteDialogAberto}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-destructive" />Excluir Pedido</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação é irreversível. O pedido <span className="font-bold">#{pedidoExcluir ? getNumExib(pedidoExcluir) : ""}</span> será excluído permanentemente. Digite sua senha para confirmar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-2">
              {pedidoExcluir &&
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                  <p><span className="font-medium">Cliente:</span> {pedidoExcluir.cliente}</p>
                  <p><span className="font-medium">Valor:</span> R$ {pedidoExcluir.valor.toFixed(2)}</p>
                  <p><span className="font-medium">Data:</span> {pedidoExcluir.data}</p>
                </div>
              }
              <div>
                <Input type="password" placeholder="Digite sua senha" value={senhaExclusao} onChange={(e) => {setSenhaExclusao(e.target.value);setSenhaErro("");}} onKeyDown={(e) => e.key === "Enter" && confirmarExclusao()} />
                {senhaErro && <p className="text-sm text-destructive mt-1">{senhaErro}</p>}
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button variant="destructive" onClick={confirmarExclusao} disabled={!senhaExclusao || isDeleting}>{isDeleting ? "Excluindo..." : "Excluir Permanentemente"}</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* #7 - Batch action dialog */}
        <Dialog open={batchDialogAberto} onOpenChange={setBatchDialogAberto}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{batchAction === "status" ? "Alterar Status em Lote" : "Atribuir Entregador em Lote"}</DialogTitle>
              <DialogDescription>
                Aplique a ação selecionada aos pedidos marcados.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground">{selecionados.size} pedido(s) selecionado(s)</p>
              {batchAction === "status" ?
              <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => executarAcaoLote("pendente")}><Clock className="h-4 w-4" />Pendente</Button>
                  <Button variant="outline" className="gap-2" onClick={() => executarAcaoLote("em_rota")}><Truck className="h-4 w-4" />Em Rota</Button>
                  <Button variant="outline" className="gap-2" onClick={() => executarAcaoLote("entregue")}><CheckCircle className="h-4 w-4" />Entregue</Button>
                  <Button variant="outline" className="gap-2 text-destructive" onClick={() => executarAcaoLote("cancelado")}><XCircle className="h-4 w-4" />Cancelado</Button>
                </div> :

              <Select onValueChange={(id) => {const ent = entregadores.find((e) => e.id === id);if (ent) executarEntregadorLote(ent.id, ent.nome);}}>
                  <SelectTrigger><SelectValue placeholder="Selecione o entregador" /></SelectTrigger>
                  <SelectContent>
                    {entregadores.map((ent) =>
                  <SelectItem key={ent.id} value={ent.id}>
                        <div className="flex items-center"><span>{ent.nome}</span>{getStatusBadgeEntregador(ent.status)}</div>
                      </SelectItem>
                  )}
                  </SelectContent>
                </Select>
              }
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <ImportReviewDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        title="Importar Pedidos Históricos"
        description={`${importItems.length} pedido(s) identificado(s). As datas originais serão preservadas.`}
        items={importItems}
        columns={[
        { key: "cliente_nome", label: "Cliente", width: "25%" },
        { key: "data", label: "Data", type: "date", width: "15%" },
        { key: "valor_total", label: "Valor", type: "number", width: "15%" },
        { key: "forma_pagamento", label: "Pagamento", width: "15%" },
        { key: "observacoes", label: "Obs", width: "20%" }]
        }
        onUpdateItem={(i, field, value) => setImportItems((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))}
        onRemoveItem={(i) => setImportItems((prev) => prev.filter((_, idx) => idx !== i))}
        onConfirm={saveImportedOrders}
        saving={importSaving} />
      

      {/* Filial transfer dialog */}
      <Dialog open={filialDialogAberto} onOpenChange={setFilialDialogAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MoveRight className="h-5 w-5 text-primary" />
              Transferir Pedido para Outra Filial
            </DialogTitle>
            <DialogDescription>
              Selecione a filial de destino para continuar o atendimento.
            </DialogDescription>
          </DialogHeader>
          {pedidoTransferirFilial &&
          <div className="space-y-4 mt-2">
              <div className="p-4 bg-muted rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">Pedido #{getNumExib(pedidoTransferirFilial)}</p>
                  <Badge variant="outline">R$ {pedidoTransferirFilial.valor.toFixed(2)}</Badge>
                </div>
                <p className="text-sm">{pedidoTransferirFilial.cliente}</p>
                <p className="text-xs text-muted-foreground">{pedidoTransferirFilial.endereco}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Unidade atual: <span className="font-medium text-foreground">{unidadeAtual?.nome || "—"}</span>
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Selecionar filial de destino:</p>
                <div className="grid gap-2 max-h-64 overflow-y-auto pr-1">
                  {unidades.
                filter((u) => u.id !== unidadeAtual?.id).
                map((u) =>
                <button
                  key={u.id}
                  onClick={() => setFilialSelecionadaId(u.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                  filialSelecionadaId === u.id ?
                  "border-primary bg-primary/5 shadow-sm" :
                  "border-border hover:bg-accent"}`
                  }>
                  
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${filialSelecionadaId === u.id ? "bg-primary/10" : "bg-muted"}`}>
                          <Building2 className={`h-4 w-4 ${filialSelecionadaId === u.id ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{u.nome}</p>
                          <p className="text-xs text-muted-foreground capitalize">{u.tipo}</p>
                        </div>
                        {filialSelecionadaId === u.id &&
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  }
                      </button>
                )}
                </div>
                {unidades.filter((u) => u.id !== unidadeAtual?.id).length === 0 &&
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma outra unidade disponível.</p>
              }
              </div>

              <div className="pt-2 flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setFilialDialogAberto(false)}>Cancelar</Button>
                <Button
                onClick={confirmarTransferenciaFilial}
                disabled={!filialSelecionadaId || transferindoFilial}
                className="gap-2">
                
                  <MoveRight className="h-4 w-4" />
                  {transferindoFilial ? "Transferindo..." : "Confirmar Transferência"}
                </Button>
              </div>
            </div>
          }
        </DialogContent>
      </Dialog>

      <EditarAgendamentoDialog
        pedido={pedidoAgendamento}
        open={agendamentoDialogAberto}
        onOpenChange={setAgendamentoDialogAberto}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["pedidos"] })}
      />
    </MainLayout>);

}

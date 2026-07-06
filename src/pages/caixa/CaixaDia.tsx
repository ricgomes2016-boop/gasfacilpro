import { useState, useEffect, useMemo } from "react";

import { AcertoPendenteDialog } from "@/components/caixa/AcertoPendenteDialog";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, TrendingDown, Plus, ShoppingCart, Package, CreditCard, CalendarIcon, DoorOpen, DoorClosed, FileDown, FileSpreadsheet, Users, AlertTriangle, Clock, Eye, Lock, Unlock, ShieldAlert, Landmark, ArrowRightLeft, Banknote, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn, getBrasiliaDate, getBrasiliaStartOfDay, getBrasiliaEndOfDay } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { criarMovimentacaoBancaria } from "@/services/paymentRoutingService";

interface Mov {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  categoria: string | null;
  created_at: string;
}

interface PedidoResumo {
  id: string;
  valor_total: number;
  forma_pagamento: string | null;
  status: string | null;
  created_at: string;
}

interface ProdutoVendido {
  nome: string;
  quantidade: number;
  total: number;
}

interface FormaPagamentoResumo {
  forma: string;
  quantidade: number;
  total: number;
}

interface ContaBancaria {
  id: string;
  nome: string;
  banco: string;
  saldo_atual: number;
}

interface CaixaSessao {
  id: string;
  valor_abertura: number;
  valor_fechamento: number | null;
  diferenca: number | null;
  status: string;
  observacoes_abertura: string | null;
  observacoes_fechamento: string | null;
  aberto_em: string;
  fechado_em: string | null;
}

export default function CaixaDia() {
  const [movs, setMovs] = useState<Mov[]>([]);
  const [pedidos, setPedidos] = useState<PedidoResumo[]>([]);
  const [produtosVendidos, setProdutosVendidos] = useState<ProdutoVendido[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamentoResumo[]>([]);
  const [sessao, setSessao] = useState<CaixaSessao | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aberturaOpen, setAberturaOpen] = useState(false);
  const [fechamentoOpen, setFechamentoOpen] = useState(false);
  const [dataSelecionada, setDataSelecionada] = useState<Date>(getBrasiliaDate());
  const { unidadeAtual, unidades } = useUnidade();
  const { user, hasAnyRole } = useAuth();
  const isGestor = hasAnyRole(["admin", "gestor"]);
  const [form, setForm] = useState({ tipo: "entrada", descricao: "", valor: "", categoria: "" });
  const [aberturaForm, setAberturaForm] = useState({ valor: "", obs: "" });
  const [fechamentoForm, setFechamentoForm] = useState({ valor: "", obs: "" });

  // Tesouraria state
  const [saldoTotalCaixa, setSaldoTotalCaixa] = useState(0);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [depositoOpen, setDepositoOpen] = useState(false);
  const [transferenciaOpen, setTransferenciaOpen] = useState(false);
  const [depositoForm, setDepositoForm] = useState({ contaId: "", valor: "", descricao: "" });
  const [transferenciaForm, setTransferenciaForm] = useState({ unidadeDestinoId: "", valor: "", descricao: "" });
  const [periodoChart, setPeriodoChart] = useState<"7dias" | "30dias">("7dias");
  const [chartMovs, setChartMovs] = useState<Mov[]>([]);
  const [movsBancariasHoje, setMovsBancariasHoje] = useState<Array<{ id: string; conta_bancaria_id: string; tipo: string; descricao: string; valor: number; created_at: string }>>([]);


  const [entregadoresPendentes, setEntregadoresPendentes] = useState<{ nome: string; entregas: number; total: number }[]>([]);
  const [sangriasPendentes, setSangriasPendentes] = useState(0);
  const [acertoPendenteDetalhes, setAcertoPendenteDetalhes] = useState<{ entregador: string; canal: string; pedidoId: string; valor: number; data: string }[]>([]);
  const [acertoPendenteDialogOpen, setAcertoPendenteDialogOpen] = useState(false);

  // Editar / excluir movimentação
  const [editMov, setEditMov] = useState<Mov | null>(null);
  const [editForm, setEditForm] = useState({ tipo: "entrada", descricao: "", valor: "", categoria: "", data: "" });
  const [deleteMovId, setDeleteMovId] = useState<string | null>(null);
  const caixaBloqueado = !!(sessao && (sessao as any).bloqueado);

  const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openEditMov = (mov: Mov) => {
    setEditMov(mov);
    setEditForm({
      tipo: mov.tipo,
      descricao: mov.descricao || "",
      valor: String(mov.valor ?? ""),
      categoria: mov.categoria || "",
      data: toLocalInput((mov as any).created_at || new Date().toISOString()),
    });
  };

  const handleUpdateMov = async () => {
    if (!editMov) return;
    const valor = parseFloat(editForm.valor);
    if (!editForm.descricao || !valor || valor <= 0) { toast.error("Preencha descrição e valor"); return; }
    if (!editForm.data) { toast.error("Informe a data"); return; }
    const novaData = new Date(editForm.data);
    if (isNaN(novaData.getTime())) { toast.error("Data inválida"); return; }

    // Bloqueio caixa: verifica se o dia da nova data está bloqueado para esta unidade
    const dataYmd = `${novaData.getFullYear()}-${String(novaData.getMonth() + 1).padStart(2, "0")}-${String(novaData.getDate()).padStart(2, "0")}`;
    const unidadeMov = (editMov as any).unidade_id || unidadeAtual?.id || null;
    const { data: bloq, error: errBloq } = await supabase.rpc("caixa_dia_bloqueado", {
      _data: dataYmd,
      _unidade_id: unidadeMov,
    });
    if (errBloq) { console.error(errBloq); }
    if (bloq === true) { toast.error("Caixa daquele dia está fechado. Reabra para lançar nesta data."); return; }

    const { error } = await supabase.from("movimentacoes_caixa").update({
      tipo: editForm.tipo,
      descricao: editForm.descricao,
      valor,
      categoria: editForm.categoria || null,
      created_at: novaData.toISOString(),
    }).eq("id", editMov.id);
    if (error) { toast.error("Erro ao atualizar movimentação"); console.error(error); return; }
    toast.success("Movimentação atualizada");
    setEditMov(null);
    fetchData();
  };


  const handleDeleteMov = async () => {
    if (!deleteMovId) return;
    const { error } = await supabase.from("movimentacoes_caixa").delete().eq("id", deleteMovId);
    if (error) { toast.error("Erro ao excluir movimentação"); console.error(error); return; }
    toast.success("Movimentação excluída");
    setDeleteMovId(null);
    fetchData();
  };

  const fetchData = async () => {
    setLoading(true);
    const inicio = getBrasiliaStartOfDay(dataSelecionada);
    const fim = getBrasiliaEndOfDay(dataSelecionada);
    const dataStr = format(dataSelecionada, "yyyy-MM-dd");

    // Fetch movimentações, pedidos and sessão in parallel
    let qMov = supabase.from("movimentacoes_caixa").select("*").gte("created_at", inicio).lte("created_at", fim).neq("categoria", "Vale Gás").order("created_at", { ascending: false });
    if (unidadeAtual?.id) qMov = qMov.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);

    let qPed = supabase.from("pedidos").select("id, valor_total, forma_pagamento, status, created_at, entregador_id, canal_venda, responsavel_acerto, entregadores(nome)").gte("created_at", inicio).lte("created_at", fim);
    if (unidadeAtual?.id) qPed = qPed.eq("unidade_id", unidadeAtual.id);

    let qSes = supabase.from("caixa_sessoes").select("*").eq("data", dataStr).order("created_at", { ascending: false }).limit(1);
    if (unidadeAtual?.id) qSes = qSes.eq("unidade_id", unidadeAtual.id);

    const [resMov, resPed, resSes] = await Promise.all([qMov, qPed, qSes]);

    if (resMov.error) console.error(resMov.error);
    else setMovs((resMov.data as Mov[]) || []);

    if (resSes.error) console.error(resSes.error);
    else setSessao((resSes.data as CaixaSessao[])?.[0] || null);

    if (resPed.error) console.error(resPed.error);
    else {
      const pedidosData = (resPed.data as PedidoResumo[]) || [];
      setPedidos(pedidosData);

      const fpMap = new Map<string, { quantidade: number; total: number }>();
      
      // Normaliza nome da forma de pagamento para evitar duplicatas (ex: "Dinheiro" vs "dinheiro")
      const normalizarForma = (f: string): string => {
        const lower = f.trim().toLowerCase().replace(/_/g, " ");
        const map: Record<string, string> = {
          dinheiro: "Dinheiro", pix: "PIX",
          "cartão crédito": "Cartão Crédito", "cartao credito": "Cartão Crédito",
          "cartão débito": "Cartão Débito", "cartao debito": "Cartão Débito",
          credito: "Cartão Crédito", debito: "Cartão Débito",
          fiado: "Fiado", cheque: "Cheque",
          "vale gás": "Vale Gás", "vale gas": "Vale Gás",
          "pix maquininha": "PIX Maquininha",
          boleto: "Boleto",
        };
        return map[lower] || f.trim();
      };

      const pendingDetails: typeof acertoPendenteDetalhes = [];
      
      pedidosData.forEach((p: any) => {
        const raw = p.forma_pagamento || "";
        
        // Detecta formato composto: "Dinheiro R$100.00, PIX R$50.00"
        const partes = raw.match(/([A-Za-zÀ-ú\s]+)\s+R\$\s*([\d.,]+)/g);
        
        if (partes && partes.length > 0) {
          partes.forEach(parte => {
            const match = parte.match(/([A-Za-zÀ-ú\s]+)\s+R\$\s*([\d.,]+)/);
            if (match) {
              const forma = normalizarForma(match[1]);
              const valor = parseFloat(match[2].replace(",", "."));
              const existing = fpMap.get(forma) || { quantidade: 0, total: 0 };
              fpMap.set(forma, { quantidade: existing.quantidade + 1, total: existing.total + valor });
            }
          });
        } else if (raw) {
          const forma = normalizarForma(raw);
          const existing = fpMap.get(forma) || { quantidade: 0, total: 0 };
          fpMap.set(forma, { quantidade: existing.quantidade + 1, total: existing.total + Number(p.valor_total || 0) });
        } else {
          // Sem forma de pagamento - indicar acerto pendente
          const forma = "Acerto Pendente";
          const existing = fpMap.get(forma) || { quantidade: 0, total: 0 };
          fpMap.set(forma, { quantidade: existing.quantidade + 1, total: existing.total + Number(p.valor_total || 0) });
          // Identificar responsável pelo acerto
          const entregadorNome = p.entregadores?.nome || null;
          const responsavelAcerto = (p as any).responsavel_acerto || null;
          let responsavel = "Não identificado";
          if (responsavelAcerto === "portaria") {
            responsavel = "🏪 Portaria";
          } else if (responsavelAcerto === "pdv") {
            responsavel = "🖥️ PDV";
          } else if (entregadorNome) {
            responsavel = `🚚 ${entregadorNome}`;
          }
          pendingDetails.push({
            entregador: responsavel,
            canal: p.canal_venda || "—",
            pedidoId: p.id,
            valor: Number(p.valor_total || 0),
            data: new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          });
        }
      });
      setAcertoPendenteDetalhes(pendingDetails);
      setFormasPagamento(Array.from(fpMap.entries()).map(([forma, v]) => ({ forma, ...v })).sort((a, b) => b.total - a.total));

      if (pedidosData.length > 0) {
        const pedidoIds = pedidosData.map(p => p.id);
        const { data: itens, error: itensErr } = await supabase
          .from("pedido_itens")
          .select("quantidade, preco_unitario, produto_id, produtos(nome)")
          .in("pedido_id", pedidoIds);

        if (itensErr) console.error(itensErr);
        else {
          const prodMap = new Map<string, { quantidade: number; total: number }>();
          (itens || []).forEach((item: any) => {
            const nome = item.produtos?.nome || "Produto removido";
            const existing = prodMap.get(nome) || { quantidade: 0, total: 0 };
            prodMap.set(nome, {
              quantidade: existing.quantidade + item.quantidade,
              total: existing.total + (item.quantidade * Number(item.preco_unitario)),
            });
          });
          setProdutosVendidos(Array.from(prodMap.entries()).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.quantidade - a.quantidade));
        }
      } else {
        setProdutosVendidos([]);
      }
    }

    // Fetch entregadores com entregas pendentes de acerto (entregas do dia sem acerto)
    let qEntregadores = supabase
      .from("pedidos")
      .select("entregador_id, valor_total, entregadores(nome)")
      .gte("created_at", inicio)
      .lte("created_at", fim)
      .eq("status", "entregue")
      .not("entregador_id", "is", null);
    if (unidadeAtual?.id) qEntregadores = qEntregadores.eq("unidade_id", unidadeAtual.id);
    const { data: entregasData } = await qEntregadores;
    
    const entMap = new Map<string, { nome: string; entregas: number; total: number }>();
    (entregasData || []).forEach((e: any) => {
      const id = e.entregador_id;
      const cur = entMap.get(id) || { nome: e.entregadores?.nome || "Desconhecido", entregas: 0, total: 0 };
      cur.entregas += 1;
      cur.total += Number(e.valor_total || 0);
      entMap.set(id, cur);
    });
    setEntregadoresPendentes(Array.from(entMap.values()).sort((a, b) => b.total - a.total));

    // Sangrias pendentes de aprovação
    let qSangrias = supabase
      .from("movimentacoes_caixa")
      .select("id", { count: "exact" })
      .eq("tipo", "saida")
      .eq("status", "pendente")
      .gte("created_at", inicio)
      .lte("created_at", fim);
    if (unidadeAtual?.id) qSangrias = qSangrias.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
    const { count: sangriasCount } = await qSangrias;
    setSangriasPendentes(sangriasCount || 0);

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [unidadeAtual, dataSelecionada]);

  // === Tesouraria: saldo acumulado total + contas bancárias ===
  const fetchTesouraria = async () => {
    // Saldo acumulado até o fim do dia selecionado (Brasília -03:00)
    const fimDoDiaSelecionado = getBrasiliaEndOfDay(dataSelecionada);
    let qTotal = supabase
      .from("movimentacoes_caixa")
      .select("tipo, valor")
      .neq("categoria", "Vale Gás")
      .lte("created_at", fimDoDiaSelecionado);
    if (unidadeAtual?.id) qTotal = qTotal.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
    const { data: allMovs, error: errTotal } = await qTotal;
    if (errTotal) {
      console.error("[CaixaDia] Erro ao calcular Total em Caixa:", errTotal);
    } else if (allMovs) {
      const total = allMovs.reduce((acc: number, m: any) => acc + (m.tipo === "entrada" ? Number(m.valor) : -Number(m.valor)), 0);
      setSaldoTotalCaixa(total);
    }
    let qContas = supabase.from("contas_bancarias").select("id, nome, banco, saldo_atual").eq("ativo", true);
    if (unidadeAtual?.id) qContas = qContas.eq("unidade_id", unidadeAtual.id);
    const { data: contasData, error: errContas } = await qContas;
    if (errContas) console.error("[CaixaDia] Erro ao carregar contas bancárias:", errContas);
    else setContas((contasData as ContaBancaria[]) || []);
    const desde = subDays(new Date(), 30).toISOString();
    let qChart = supabase.from("movimentacoes_caixa").select("*").gte("created_at", desde).neq("categoria", "Vale Gás").order("created_at", { ascending: false });
    if (unidadeAtual?.id) qChart = qChart.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
    const { data: cData, error: errChart } = await qChart;
    if (errChart) console.error("[CaixaDia] Erro ao carregar gráfico 30d:", errChart);
    else setChartMovs((cData as Mov[]) || []);

    // Movimentações bancárias de hoje (para mostrar status "Conectada" + extrato resumido)
    const hojeISO = format(new Date(), "yyyy-MM-dd");
    let qMovBanc = supabase.from("movimentacoes_bancarias")
      .select("id, conta_bancaria_id, tipo, descricao, valor, created_at")
      .eq("data", hojeISO)
      .order("created_at", { ascending: false });
    if (unidadeAtual?.id) qMovBanc = qMovBanc.eq("unidade_id", unidadeAtual.id);
    const { data: mbData, error: errMB } = await qMovBanc;
    if (errMB) console.error("[CaixaDia] Erro ao carregar movimentações bancárias:", errMB);
    else setMovsBancariasHoje((mbData as any) || []);
  };


  useEffect(() => { fetchTesouraria(); }, [unidadeAtual, dataSelecionada]);

  const chartData = useMemo(() => {
    const daysBack = periodoChart === "7dias" ? 6 : 29;
    const days: Record<string, { entradas: number; saidas: number }> = {};
    for (let i = daysBack; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "dd/MM");
      days[d] = { entradas: 0, saidas: 0 };
    }
    chartMovs.forEach(m => {
      const d = format(new Date(m.created_at), "dd/MM");
      if (days[d]) {
        if (m.tipo === "entrada") days[d].entradas += Number(m.valor);
        else days[d].saidas += Number(m.valor);
      }
    });
    return Object.entries(days).map(([data, v]) => ({ data, ...v }));
  }, [chartMovs, periodoChart]);

  const handleDeposito = async () => {
    const valor = parseFloat(depositoForm.valor);
    if (!depositoForm.contaId || !valor || valor <= 0) { toast.error("Selecione a conta e informe o valor"); return; }
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const desc = depositoForm.descricao || "Depósito bancário do caixa";
    const { error: errCaixa } = await supabase.from("movimentacoes_caixa").insert({
      tipo: "saida", descricao: `💰→🏦 ${desc}`, valor, categoria: "Depósito Bancário", unidade_id: unidadeAtual?.id || null,
    });
    if (errCaixa) { toast.error("Erro ao registrar saída do caixa"); return; }
    try {
      await criarMovimentacaoBancaria({ contaBancariaId: depositoForm.contaId, valor, descricao: `Depósito do caixa - ${desc}`, categoria: "deposito_caixa", unidadeId: unidadeAtual?.id, userId: authUser?.id });
    } catch (e) { console.error(e); toast.error("Erro ao creditar na conta bancária"); return; }
    toast.success("Depósito realizado!");
    setDepositoOpen(false); setDepositoForm({ contaId: "", valor: "", descricao: "" });
    fetchData(); fetchTesouraria();
  };

  const handleTransferencia = async () => {
    const valor = parseFloat(transferenciaForm.valor);
    if (!transferenciaForm.unidadeDestinoId || !valor || valor <= 0) { toast.error("Selecione a unidade destino e informe o valor"); return; }
    const unidadeDestino = unidades.find(u => u.id === transferenciaForm.unidadeDestinoId);
    const desc = transferenciaForm.descricao || `Transferência para ${unidadeDestino?.nome || "outra loja"}`;
    const { error: err1 } = await supabase.from("movimentacoes_caixa").insert({
      tipo: "saida", descricao: `🔄 Saída: ${desc}`, valor, categoria: "Transferência Caixa", unidade_id: unidadeAtual?.id || null,
    });
    if (err1) { toast.error("Erro ao registrar saída"); return; }
    const { error: err2 } = await supabase.from("movimentacoes_caixa").insert({
      tipo: "entrada", descricao: `🔄 Entrada: Transferência de ${unidadeAtual?.nome || "outra loja"}`, valor, categoria: "Transferência Caixa", unidade_id: transferenciaForm.unidadeDestinoId,
    });
    if (err2) { toast.error("Erro ao registrar entrada no destino"); return; }
    toast.success(`Transferência de R$ ${valor.toFixed(2)} para ${unidadeDestino?.nome} realizada!`);
    setTransferenciaOpen(false); setTransferenciaForm({ unidadeDestinoId: "", valor: "", descricao: "" });
    fetchData(); fetchTesouraria();
  };

  const handleSubmit = async () => {
    if (!form.descricao || !form.valor) { toast.error("Preencha os campos"); return; }
    const { error } = await supabase.from("movimentacoes_caixa").insert({
      tipo: form.tipo, descricao: form.descricao,
      valor: parseFloat(form.valor), categoria: form.categoria || null,
      unidade_id: unidadeAtual?.id || null,
    });
    if (error) { toast.error("Erro ao registrar"); console.error(error); }
    else { toast.success("Registrado!"); setDialogOpen(false); setForm({ tipo: "entrada", descricao: "", valor: "", categoria: "" }); fetchData(); }
  };

  const handleAbrirCaixa = async () => {
    if (!aberturaForm.valor) { toast.error("Informe o valor de abertura"); return; }
    const { error } = await supabase.from("caixa_sessoes").insert({
      valor_abertura: parseFloat(aberturaForm.valor),
      observacoes_abertura: aberturaForm.obs || null,
      unidade_id: unidadeAtual?.id || null,
      usuario_abertura_id: user?.id,
      data: format(dataSelecionada, "yyyy-MM-dd"),
    });
    if (error) { toast.error("Erro ao abrir caixa"); console.error(error); }
    else { toast.success("Caixa aberto!"); setAberturaOpen(false); setAberturaForm({ valor: "", obs: "" }); fetchData(); }
  };

  const handleFecharCaixa = async () => {
    if (!fechamentoForm.valor || !sessao) { toast.error("Informe o valor de fechamento"); return; }
    const valorFechamento = parseFloat(fechamentoForm.valor);
    const esperado = sessao.valor_abertura + saldo;
    const diferenca = valorFechamento - esperado;

    const { error } = await supabase.from("caixa_sessoes").update({
      valor_fechamento: valorFechamento,
      diferenca,
      observacoes_fechamento: fechamentoForm.obs || null,
      status: "fechado",
      fechado_em: new Date().toISOString(),
      usuario_fechamento_id: user?.id,
      bloqueado: true,
    }).eq("id", sessao.id);

    if (error) { toast.error("Erro ao fechar caixa"); console.error(error); }
    else { toast.success("Caixa fechado e bloqueado! Estoque, vendas e movimentações do dia estão travados."); setFechamentoOpen(false); setFechamentoForm({ valor: "", obs: "" }); fetchData(); }
  };

  const handleReabrirCaixa = async () => {
    if (!sessao) return;
    const { error } = await supabase.from("caixa_sessoes").update({
      bloqueado: false,
      desbloqueado_por: user?.id,
      desbloqueado_em: new Date().toISOString(),
    }).eq("id", sessao.id);

    if (error) { toast.error("Erro ao reabrir caixa"); console.error(error); }
    else { toast.success("Caixa reaberto! Operações desbloqueadas para edição."); fetchData(); }
  };

  const totalEntradas = movs.filter(m => m.tipo === "entrada").reduce((a, m) => a + Number(m.valor), 0);
  const totalSaidas = movs.filter(m => m.tipo === "saida").reduce((a, m) => a + Number(m.valor), 0);
  const saldo = totalEntradas - totalSaidas;
  const movimentacoesExtrato = useMemo(() => {
    let total = 0;
    return [...movs]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((mov) => {
        const valor = Number(mov.valor || 0);
        const entrada = mov.tipo === "entrada" ? valor : 0;
        const saida = mov.tipo === "saida" ? valor : 0;
        total += entrada - saida;
        return { ...mov, entrada, saida, total };
      });
  }, [movs]);
  const totalVendas = pedidos.reduce((a, p) => a + Number(p.valor_total || 0), 0);
  const qtdPedidos = pedidos.length;
  const dataFormatada = format(dataSelecionada, "dd/MM/yyyy");

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Relatório Caixa do Dia - ${dataFormatada}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Unidade: ${unidadeAtual?.nome || "Todas"}`, 14, 28);

    if (sessao) {
      doc.text(`Abertura: R$ ${Number(sessao.valor_abertura).toFixed(2)} | Status: ${sessao.status === "fechado" ? "Fechado" : "Aberto"}`, 14, 34);
      if (sessao.valor_fechamento != null) {
        doc.text(`Fechamento: R$ ${Number(sessao.valor_fechamento).toFixed(2)} | Diferença: R$ ${Number(sessao.diferenca || 0).toFixed(2)}`, 14, 40);
      }
    }

    let startY = sessao ? 48 : 36;

    // Resumo
    doc.setFontSize(12);
    doc.text("Resumo", 14, startY);
    autoTable(doc, {
      startY: startY + 4,
      head: [["Métrica", "Valor"]],
      body: [
        ["Total Vendas", `R$ ${totalVendas.toFixed(2)} (${qtdPedidos} pedidos)`],
        ["Entradas Caixa", `R$ ${totalEntradas.toFixed(2)}`],
        ["Saídas Caixa", `R$ ${totalSaidas.toFixed(2)}`],
        ["Saldo Caixa", `R$ ${saldo.toFixed(2)}`],
      ],
    });

    // Produtos
    if (produtosVendidos.length > 0) {
      const finalY = (doc as any).lastAutoTable?.finalY || startY + 40;
      doc.text("Produtos Vendidos", 14, finalY + 10);
      autoTable(doc, {
        startY: finalY + 14,
        head: [["Produto", "Qtd", "Total"]],
        body: produtosVendidos.map(p => [p.nome, String(p.quantidade), `R$ ${p.total.toFixed(2)}`]),
        foot: [["Total", String(produtosVendidos.reduce((a, p) => a + p.quantidade, 0)), `R$ ${produtosVendidos.reduce((a, p) => a + p.total, 0).toFixed(2)}`]],
      });
    }

    // Formas de pagamento
    if (formasPagamento.length > 0) {
      const finalY = (doc as any).lastAutoTable?.finalY || 100;
      doc.text("Formas de Pagamento", 14, finalY + 10);
      autoTable(doc, {
        startY: finalY + 14,
        head: [["Forma", "Pedidos", "Total"]],
        body: formasPagamento.map(fp => [fp.forma, String(fp.quantidade), `R$ ${fp.total.toFixed(2)}`]),
        foot: [["Total", String(formasPagamento.reduce((a, f) => a + f.quantidade, 0)), `R$ ${formasPagamento.reduce((a, f) => a + f.total, 0).toFixed(2)}`]],
      });
    }

    doc.save(`caixa-${format(dataSelecionada, "yyyy-MM-dd")}.pdf`);
    toast.success("PDF gerado!");
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Resumo
    const resumoData = [
      ["Relatório Caixa do Dia", dataFormatada],
      ["Unidade", unidadeAtual?.nome || "Todas"],
      [],
      ["Métrica", "Valor"],
      ["Total Vendas", totalVendas],
      ["Qtd Pedidos", qtdPedidos],
      ["Entradas Caixa", totalEntradas],
      ["Saídas Caixa", totalSaidas],
      ["Saldo Caixa", saldo],
    ];
    if (sessao) {
      resumoData.push(["Valor Abertura", sessao.valor_abertura]);
      if (sessao.valor_fechamento != null) {
        resumoData.push(["Valor Fechamento", sessao.valor_fechamento]);
        resumoData.push(["Diferença", sessao.diferenca || 0]);
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumoData), "Resumo");

    // Movimentações
    if (movimentacoesExtrato.length > 0) {
      const movsSheet = [["Data", "Histórico/Descrição", "Entrada", "Saída", "Total"]];
      movimentacoesExtrato.forEach(m => movsSheet.push([
        `${new Date(m.created_at).toLocaleDateString("pt-BR")} ${new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
        `${m.descricao}${m.categoria ? ` (${m.categoria})` : ""}`,
        m.entrada ? String(m.entrada.toFixed(2)) : "",
        m.saida ? String(m.saida.toFixed(2)) : "",
        String(m.total.toFixed(2)),
      ]));
      movsSheet.push(["", "TOTAL GERAL", String(totalEntradas.toFixed(2)), String(totalSaidas.toFixed(2)), String(saldo.toFixed(2))]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(movsSheet), "Movimentações");
    }

    // Produtos
    if (produtosVendidos.length > 0) {
      const prodSheet = [["Produto", "Qtd", "Total"]];
      produtosVendidos.forEach(p => prodSheet.push([p.nome, String(p.quantidade), String(p.total.toFixed(2))]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(prodSheet), "Produtos");
    }

    // Pagamentos
    if (formasPagamento.length > 0) {
      const fpSheet = [["Forma", "Pedidos", "Total"]];
      formasPagamento.forEach(fp => fpSheet.push([fp.forma, String(fp.quantidade), String(fp.total.toFixed(2))]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fpSheet), "Pagamentos");
    }

    XLSX.writeFile(wb, `caixa-${format(dataSelecionada, "yyyy-MM-dd")}.xlsx`);
    toast.success("Excel gerado!");
  };

  return (
    <MainLayout>
      <Header title="Caixa da Loja" subtitle="Operação diária, tesouraria e depósitos bancários" />
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dataSelecionada, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dataSelecionada} onSelect={(d) => d && setDataSelecionada(d)} locale={ptBR} initialFocus />
            </PopoverContent>
          </Popover>
          <div className="flex flex-wrap gap-2">
            {/* Abertura / Fechamento */}
            {!sessao && (
              <Dialog open={aberturaOpen} onOpenChange={setAberturaOpen}>
                <DialogTrigger asChild><Button variant="outline" className="border-success text-success hover:bg-success/10"><DoorOpen className="h-4 w-4 mr-2" />Abrir Caixa</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Abertura de Caixa</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div><Label>Valor Inicial (fundo de troco) *</Label><Input type="number" step="0.01" value={aberturaForm.valor} onChange={e => setAberturaForm({ ...aberturaForm, valor: e.target.value })} placeholder="0.00" /></div>
                    <div><Label>Observações</Label><Textarea value={aberturaForm.obs} onChange={e => setAberturaForm({ ...aberturaForm, obs: e.target.value })} placeholder="Observações da abertura..." /></div>
                    <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAberturaOpen(false)}>Cancelar</Button><Button onClick={handleAbrirCaixa}>Abrir Caixa</Button></div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {sessao?.status === "aberto" && (
              <Dialog open={fechamentoOpen} onOpenChange={setFechamentoOpen}>
                <DialogTrigger asChild><Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10"><DoorClosed className="h-4 w-4 mr-2" />Fechar Caixa</Button></DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Fechamento Inteligente de Caixa</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    {/* Resumo por forma de pagamento */}
                    <div className="rounded-lg bg-muted p-4 space-y-2">
                      <p className="text-sm font-semibold mb-2">Conferência por Forma de Pagamento</p>
                      {formasPagamento.length > 0 ? formasPagamento.map(fp => (
                        <div key={fp.forma} className="flex justify-between text-sm">
                          <span className="capitalize text-muted-foreground">{fp.forma}</span>
                          <span className="font-medium">R$ {fp.total.toFixed(2)} <span className="text-xs text-muted-foreground">({fp.quantidade} ped.)</span></span>
                        </div>
                      )) : (
                        <p className="text-xs text-muted-foreground">Nenhuma venda registrada</p>
                      )}
                      <div className="border-t pt-2 mt-2 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Abertura</span>
                          <strong>R$ {Number(sessao.valor_abertura).toFixed(2)}</strong>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-success">+ Entradas</span>
                          <strong className="text-success">R$ {totalEntradas.toFixed(2)}</strong>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-destructive">- Saídas (sangrias)</span>
                          <strong className="text-destructive">R$ {totalSaidas.toFixed(2)}</strong>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-1 font-bold">
                          <span>💰 Valor esperado no caixa</span>
                          <span>R$ {(sessao.valor_abertura + saldo).toFixed(2)}</span>
                        </div>
                        {/* Dinheiro em espécie esperado (excluindo pix/cartão que não fica no caixa) */}
                        {(() => {
                          const dinheiroVendas = formasPagamento.filter(fp => 
                            fp.forma === "Dinheiro"
                          ).reduce((s, fp) => s + fp.total, 0);
                          const dinheiroEsperado = sessao.valor_abertura + dinheiroVendas - totalSaidas;
                          return (
                            <div className="flex justify-between text-sm bg-primary/5 rounded p-1.5 mt-1">
                              <span className="text-primary font-medium">💵 Dinheiro em espécie esperado</span>
                              <span className="text-primary font-bold">R$ {dinheiroEsperado.toFixed(2)}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div><Label>Valor contado no caixa *</Label><Input type="number" step="0.01" value={fechamentoForm.valor} onChange={e => setFechamentoForm({ ...fechamentoForm, valor: e.target.value })} placeholder="0.00" /></div>
                    {fechamentoForm.valor && (() => {
                      const diff = parseFloat(fechamentoForm.valor) - (sessao.valor_abertura + saldo);
                      const isOk = Math.abs(diff) < 0.01;
                      return (
                        <div className={`rounded-lg p-3 text-sm font-medium flex items-center gap-2 ${isOk ? "bg-success/10 text-success" : Math.abs(diff) > 50 ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"}`}>
                          {isOk ? "✅" : Math.abs(diff) > 50 ? "🚨" : "⚠️"}
                          Diferença: R$ {diff.toFixed(2)}
                          {Math.abs(diff) > 50 && " — Divergência alta! Verifique."}
                        </div>
                      );
                    })()}
                    <div><Label>Observações</Label><Textarea value={fechamentoForm.obs} onChange={e => setFechamentoForm({ ...fechamentoForm, obs: e.target.value })} placeholder="Observações do fechamento..." /></div>
                    <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setFechamentoOpen(false)}>Cancelar</Button><Button variant="destructive" onClick={handleFecharCaixa}>Fechar Caixa</Button></div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {sessao?.status === "fechado" && (sessao as any).bloqueado && isGestor && (
              <Button variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-500/10" onClick={handleReabrirCaixa}>
                <Unlock className="h-4 w-4 mr-2" />Reabrir Caixa
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Movimentação</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Movimentação</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div><Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="entrada">Entrada</SelectItem><SelectItem value="saida">Saída</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></div>
                  <div><Label>Valor *</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} /></div>
                  <div><Label>Categoria</Label>
                    <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Vendas">Vendas</SelectItem><SelectItem value="Combustível">Combustível</SelectItem>
                        <SelectItem value="Alimentação">Alimentação</SelectItem><SelectItem value="Manutenção">Manutenção</SelectItem>
                        <SelectItem value="Troco">Troco</SelectItem><SelectItem value="Outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={handleSubmit}>Registrar</Button></div>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={exportPDF}><FileDown className="h-4 w-4 mr-2" />PDF</Button>
            <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
          </div>
        </div>

        {/* Status do caixa */}
        {sessao && (
          <Card className={sessao.status === "aberto" ? "border-success/50 bg-success/5" : "border-muted"}>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {sessao.status === "aberto" ? <DoorOpen className="h-5 w-5 text-success" /> : <DoorClosed className="h-5 w-5 text-muted-foreground" />}
                  <div>
                    <p className="font-medium">Caixa {sessao.status === "aberto" ? "Aberto" : "Fechado"}</p>
                    <p className="text-sm text-muted-foreground">
                      Aberto às {new Date(sessao.aberto_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {sessao.fechado_em && ` • Fechado às ${new Date(sessao.fechado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-6 text-sm">
                  <div><span className="text-muted-foreground">Abertura:</span> <strong>R$ {Number(sessao.valor_abertura).toFixed(2)}</strong></div>
                  {sessao.valor_fechamento != null && (
                    <>
                      <div><span className="text-muted-foreground">Fechamento:</span> <strong>R$ {Number(sessao.valor_fechamento).toFixed(2)}</strong></div>
                      <div><span className="text-muted-foreground">Diferença:</span> <strong className={Number(sessao.diferenca || 0) === 0 ? "text-success" : "text-destructive"}>R$ {Number(sessao.diferenca || 0).toFixed(2)}</strong></div>
                    </>
        )}

        {/* Banner caixa bloqueado */}
        {sessao && (sessao as any).bloqueado && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-destructive/10 p-3 shrink-0">
                <Lock className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-destructive">🔒 Caixa Fechado e Bloqueado</p>
                <p className="text-xs text-muted-foreground">
                  Vendas, estoque e movimentações do dia estão travados.
                  {isGestor ? " Você pode reabrir usando o botão acima." : " Solicite ao gestor para reabrir."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cards de resumo */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          <Card className="border-2 border-primary/30"><CardContent className="p-3 sm:pt-6 sm:p-6"><div className="flex items-center gap-3"><div className="status-card-icon status-card-icon-primary"><Banknote /></div><div className="min-w-0"><p className={`text-base sm:text-2xl font-bold truncate ${saldoTotalCaixa >= 0 ? "text-success" : "text-destructive"}`}>R$ {saldoTotalCaixa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p className="text-xs text-muted-foreground">💰 Total em Caixa</p></div></div></CardContent></Card>
          <Card><CardContent className="p-3 sm:pt-6 sm:p-6"><div className="flex items-center gap-3"><div className="status-card-icon status-card-icon-primary"><ShoppingCart /></div><div className="min-w-0"><p className="text-base sm:text-2xl font-bold truncate">R$ {totalVendas.toFixed(2)}</p><p className="text-xs text-muted-foreground">{qtdPedidos} vendas</p></div></div></CardContent></Card>
          <Card><CardContent className="p-3 sm:pt-6 sm:p-6"><div className="flex items-center gap-3"><div className="status-card-icon status-card-icon-success"><TrendingUp /></div><div className="min-w-0"><p className="text-base sm:text-2xl font-bold text-success truncate">R$ {totalEntradas.toFixed(2)}</p><p className="text-xs text-muted-foreground">Entradas Hoje</p></div></div></CardContent></Card>
          <Card><CardContent className="p-3 sm:pt-6 sm:p-6"><div className="flex items-center gap-3"><div className="status-card-icon status-card-icon-destructive"><TrendingDown /></div><div className="min-w-0"><p className="text-base sm:text-2xl font-bold text-destructive truncate">R$ {totalSaidas.toFixed(2)}</p><p className="text-xs text-muted-foreground">Saídas Hoje</p></div></div></CardContent></Card>
          <Card><CardContent className="p-3 sm:pt-6 sm:p-6"><div className="flex items-center gap-3"><div className="status-card-icon status-card-icon-primary"><DollarSign /></div><div className="min-w-0"><p className="text-base sm:text-2xl font-bold truncate">R$ {saldo.toFixed(2)}</p><p className="text-xs text-muted-foreground">Saldo do Dia</p></div></div></CardContent></Card>
        </div>

        {/* Dashboard em tempo real */}
        {(entregadoresPendentes.length > 0 || sangriasPendentes > 0) && (
          <div className="grid gap-3 md:grid-cols-2">
            {entregadoresPendentes.length > 0 && (
              <Card className="border-amber-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-5 w-5 text-amber-500" />
                    Entregadores — Acerto Pendente
                    <Badge variant="secondary" className="ml-auto">{entregadoresPendentes.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {entregadoresPendentes.map((ent, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{ent.nome}</p>
                          <p className="text-xs text-muted-foreground">{ent.entregas} entregas</p>
                        </div>
                        <p className="font-bold text-sm">R$ {ent.total.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {sangriasPendentes > 0 && (
              <Card className="border-destructive/30">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="rounded-lg bg-destructive/10 p-3 shrink-0">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="font-semibold">{sangriasPendentes} sangria(s) pendente(s) de aprovação</p>
                    <p className="text-xs text-muted-foreground">Acesse Despesas (Sangria) para aprovar ou rejeitar</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Abas */}
        <Tabs defaultValue="movimentacoes" className="space-y-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="movimentacoes" className="flex-1 sm:flex-none text-xs sm:text-sm">Movimentações</TabsTrigger>
            <TabsTrigger value="produtos" className="flex-1 sm:flex-none text-xs sm:text-sm">Produtos</TabsTrigger>
            <TabsTrigger value="pagamentos" className="flex-1 sm:flex-none text-xs sm:text-sm">Pagamentos</TabsTrigger>
            <TabsTrigger value="tesouraria" className="flex-1 sm:flex-none text-xs sm:text-sm">💰 Tesouraria</TabsTrigger>
          </TabsList>

          <TabsContent value="movimentacoes">
            <Card>
              <CardHeader className="pb-3"><CardTitle>Movimentações do Dia</CardTitle></CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                {loading ? (
                  <p className="text-center py-8 text-muted-foreground">Carregando...</p>
                ) : movs.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Nenhuma movimentação</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[720px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Data</TableHead>
                          <TableHead>Histórico/Descrição</TableHead>
                          <TableHead className="w-[130px] text-right">Entrada</TableHead>
                          <TableHead className="w-[130px] text-right">Saída</TableHead>
                          <TableHead className="w-[140px] text-right">Total</TableHead>
                          <TableHead className="w-[90px] text-center">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="tabular-nums">
                        {movimentacoesExtrato.map(mov => (
                          <TableRow key={mov.id}>
                            <TableCell className="text-muted-foreground text-xs">
                              <div>{new Date(mov.created_at).toLocaleDateString("pt-BR")}</div>
                              <div>{new Date(mov.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="font-medium">{mov.descricao}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Badge variant={mov.tipo === "entrada" ? "default" : "destructive"} className="text-[10px] whitespace-nowrap">{mov.tipo === "entrada" ? "Entrada" : "Saída"}</Badge>
                                <Badge variant="outline" className="text-[10px]">{mov.categoria || "—"}</Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium text-success whitespace-nowrap">
                              {mov.entrada > 0 ? `R$ ${mov.entrada.toFixed(2)}` : "—"}
                            </TableCell>
                            <TableCell className="text-right font-medium text-destructive whitespace-nowrap">
                              {mov.saida > 0 ? `R$ ${mov.saida.toFixed(2)}` : "—"}
                            </TableCell>
                            <TableCell className={cn("text-right font-semibold whitespace-nowrap", mov.total < 0 && "text-destructive")}>
                              R$ {mov.total.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={caixaBloqueado}
                                  title={caixaBloqueado ? "Caixa bloqueado — reabra para editar" : "Editar"}
                                  onClick={() => openEditMov(mov)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  disabled={caixaBloqueado}
                                  title={caixaBloqueado ? "Caixa bloqueado — reabra para excluir" : "Excluir"}
                                  onClick={() => setDeleteMovId(mov.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow className="bg-muted/60 font-semibold tabular-nums">
                          <TableCell colSpan={2}>TOTAL GERAL</TableCell>
                          <TableCell className="text-right text-success whitespace-nowrap">R$ {totalEntradas.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-destructive whitespace-nowrap">R$ {totalSaidas.toFixed(2)}</TableCell>
                          <TableCell className={cn("text-right whitespace-nowrap", saldo < 0 && "text-destructive")}>R$ {saldo.toFixed(2)}</TableCell>
                          <TableCell />
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="produtos">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Produtos Vendidos</CardTitle></CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                {loading ? (
                  <p className="text-center py-8 text-muted-foreground">Carregando...</p>
                ) : produtosVendidos.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Nenhuma venda registrada</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[300px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-center w-16">Qtd</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {produtosVendidos.map(p => (
                          <TableRow key={p.nome}>
                            <TableCell className="font-medium">{p.nome}</TableCell>
                            <TableCell className="text-center"><Badge variant="secondary">{p.quantidade}</Badge></TableCell>
                            <TableCell className="text-right font-medium whitespace-nowrap">R$ {p.total.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-center">{produtosVendidos.reduce((a, p) => a + p.quantidade, 0)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">R$ {produtosVendidos.reduce((a, p) => a + p.total, 0).toFixed(2)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pagamentos">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Formas de Pagamento</CardTitle></CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                {loading ? (
                  <p className="text-center py-8 text-muted-foreground">Carregando...</p>
                ) : formasPagamento.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Nenhuma venda registrada</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[300px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Forma</TableHead>
                          <TableHead className="text-center w-16">Qtd</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formasPagamento.map(fp => (
                          <TableRow key={fp.forma} className={fp.forma === "Acerto Pendente" ? "cursor-pointer hover:bg-amber-500/10" : ""} onClick={() => fp.forma === "Acerto Pendente" && setAcertoPendenteDialogOpen(true)}>
                            <TableCell className="font-medium capitalize">
                              {fp.forma === "Acerto Pendente" ? (
                                <span className="flex items-center gap-1.5 text-amber-600">
                                  <Clock className="h-4 w-4" />
                                  {fp.forma}
                                  <Eye className="h-3.5 w-3.5 ml-1 opacity-60" />
                                </span>
                              ) : fp.forma}
                            </TableCell>
                            <TableCell className="text-center"><Badge variant="secondary">{fp.quantidade}</Badge></TableCell>
                            <TableCell className="text-right font-medium whitespace-nowrap">R$ {fp.total.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-center">{formasPagamento.reduce((a, f) => a + f.quantidade, 0)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">R$ {formasPagamento.reduce((a, f) => a + f.total, 0).toFixed(2)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Tesouraria */}
          <TabsContent value="tesouraria">
            <div className="space-y-4">
              {/* Ações de Tesouraria */}
              <div className="flex flex-wrap gap-2">
                <Dialog open={depositoOpen} onOpenChange={setDepositoOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary"><Landmark className="h-4 w-4 mr-2" />Depositar no Banco</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" />Depositar Dinheiro no Banco</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground">O valor sairá do <strong>Caixa da Loja</strong> e entrará na <strong>Conta Bancária</strong> selecionada.</p>
                    <div className="space-y-4 pt-2">
                      <div>
                        <Label>Conta Bancária Destino *</Label>
                        <Select value={depositoForm.contaId} onValueChange={v => setDepositoForm({ ...depositoForm, contaId: v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                          <SelectContent>
                            {contas.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nome} ({c.banco}) — R$ {Number(c.saldo_atual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Valor *</Label><Input type="number" step="0.01" value={depositoForm.valor} onChange={e => setDepositoForm({ ...depositoForm, valor: e.target.value })} placeholder="0.00" /></div>
                      <div><Label>Descrição</Label><Input value={depositoForm.descricao} onChange={e => setDepositoForm({ ...depositoForm, descricao: e.target.value })} placeholder="Ex: Depósito diário" /></div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setDepositoOpen(false)}>Cancelar</Button>
                        <Button onClick={handleDeposito}><Landmark className="h-4 w-4 mr-2" />Confirmar Depósito</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {unidades.length > 1 && (
                  <Dialog open={transferenciaOpen} onOpenChange={setTransferenciaOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline"><ArrowRightLeft className="h-4 w-4 mr-2" />Transferir entre Caixas</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" />Transferência entre Caixas</DialogTitle></DialogHeader>
                      <p className="text-sm text-muted-foreground">Transfere dinheiro físico do caixa de <strong>{unidadeAtual?.nome || "esta loja"}</strong> para outra unidade.</p>
                      <div className="space-y-4 pt-2">
                        <div>
                          <Label>Unidade Destino *</Label>
                          <Select value={transferenciaForm.unidadeDestinoId} onValueChange={v => setTransferenciaForm({ ...transferenciaForm, unidadeDestinoId: v })}>
                            <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                            <SelectContent>
                              {unidades.filter(u => u.id !== unidadeAtual?.id).map(u => (
                                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div><Label>Valor *</Label><Input type="number" step="0.01" value={transferenciaForm.valor} onChange={e => setTransferenciaForm({ ...transferenciaForm, valor: e.target.value })} placeholder="0.00" /></div>
                        <div><Label>Descrição</Label><Input value={transferenciaForm.descricao} onChange={e => setTransferenciaForm({ ...transferenciaForm, descricao: e.target.value })} placeholder="Ex: Troco para filial centro" /></div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setTransferenciaOpen(false)}>Cancelar</Button>
                          <Button onClick={handleTransferencia}><ArrowRightLeft className="h-4 w-4 mr-2" />Transferir</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                <Select value={periodoChart} onValueChange={(v: "7dias" | "30dias") => setPeriodoChart(v)}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7dias">7 dias</SelectItem>
                    <SelectItem value="30dias">30 dias</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" size="icon" onClick={() => { fetchData(); fetchTesouraria(); }}><RefreshCw className="h-4 w-4" /></Button>
              </div>

              {/* Gráfico de movimentações */}
              <Card>
                <CardHeader><CardTitle>Movimentações — {periodoChart === "7dias" ? "Últimos 7 dias" : "Últimos 30 dias"}</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="data" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR")}`} />
                      <Area type="monotone" dataKey="entradas" stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.3} name="Entradas" />
                      <Area type="monotone" dataKey="saidas" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.3} name="Saídas" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Contas bancárias resumo */}
              {contas.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" />Contas Bancárias</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {contas.map(c => {
                        const movsConta = movsBancariasHoje.filter(m => m.conta_bancaria_id === c.id);
                        const conectada = movsConta.length > 0;
                        return (
                          <div key={c.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-sm truncate">{c.nome}</p>
                                  {conectada ? (
                                    <Badge variant="default" className="bg-success/15 text-success border-success/30 text-[10px] px-1.5 py-0">● Conectada</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">Sem mov. hoje</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">{c.banco}</p>
                              </div>
                              <span className="font-bold text-sm whitespace-nowrap">R$ {Number(c.saldo_atual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            </div>
                            {conectada && (
                              <div className="space-y-1 pl-1 border-l-2 border-success/30">
                                {movsConta.slice(0, 4).map(m => (
                                  <div key={m.id} className="flex justify-between items-center text-xs px-2">
                                    <span className="truncate text-muted-foreground">{m.tipo === "saida" ? "↓" : "↑"} {m.descricao}</span>
                                    <span className={m.tipo === "saida" ? "text-destructive font-medium" : "text-success font-medium"}>
                                      {m.tipo === "saida" ? "-" : "+"} R$ {Number(m.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                ))}
                                {movsConta.length > 4 && (
                                  <p className="text-[10px] text-muted-foreground px-2">+ {movsConta.length - 4} movimentações</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>


        {/* Dialog Acerto Pendente detalhes */}
        <AcertoPendenteDialog
          open={acertoPendenteDialogOpen}
          onOpenChange={setAcertoPendenteDialogOpen}
          detalhes={acertoPendenteDetalhes}
        />

        {/* Editar movimentação */}
        <Dialog open={!!editMov} onOpenChange={(o) => !o && setEditMov(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar Movimentação</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Tipo</Label>
                <Select value={editForm.tipo} onValueChange={(v) => setEditForm({ ...editForm, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data e hora</Label>
                <Input type="datetime-local" value={editForm.data} onChange={(e) => setEditForm({ ...editForm, data: e.target.value })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={editForm.descricao} onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })} />
              </div>

              <div>
                <Label>Valor</Label>
                <Input type="number" step="0.01" value={editForm.valor} onChange={(e) => setEditForm({ ...editForm, valor: e.target.value })} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input value={editForm.categoria} onChange={(e) => setEditForm({ ...editForm, categoria: e.target.value })} placeholder="Opcional" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditMov(null)}>Cancelar</Button>
                <Button onClick={handleUpdateMov}>Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Confirmar exclusão */}
        <AlertDialog open={!!deleteMovId} onOpenChange={(o) => !o && setDeleteMovId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A movimentação será removida do caixa do dia.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteMov} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}

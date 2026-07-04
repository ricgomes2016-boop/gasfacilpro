import { useState, useMemo, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { getBrasiliaDateString, cn } from "@/lib/utils";
import { useFormaPagamentoLabel } from "@/hooks/useFormasPagamentoCustom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  FileSpreadsheet, Download, Filter, TrendingUp, DollarSign, ShoppingCart, Calendar, RefreshCw, Users, Megaphone, Pencil, Upload, X, SlidersHorizontal,
} from "lucide-react";
import { SmartImportButtons } from "@/components/import/SmartImportButtons";
import { ImportReviewDialog } from "@/components/import/ImportReviewDialog";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { CelulaMesEditavel } from "./CelulaMesEditavel";
import { VendaSectionHeader } from "@/components/vendas/VendaSectionHeader";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line } from "recharts";
import { Package, CreditCard, CalendarDays, Trophy, PackageSearch, Check } from "lucide-react";
import { ProdutosVendidosTab } from "./ProdutosVendidosTab";

const formaPagamentoLabels: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  pix_maquininha: "PIX Maquininha",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  cheque: "Cheque",
  vale_gas: "Vale Gás",
  fiado: "Fiado",
  outros: "Outros",
};

function normalizarFormaPagamento(raw: string | null | undefined): string {
  if (!raw) return "outros";
  const s = String(raw).toLowerCase().trim().replace(/\s+/g, "_").replace(/[áàâã]/g, "a").replace(/[éê]/g, "e").replace(/[í]/g, "i").replace(/[óôõ]/g, "o").replace(/[ú]/g, "u").replace(/[ç]/g, "c");
  if (s.includes("dinheiro") || s === "cash" || s.includes("especie")) return "dinheiro";
  if (s.includes("pix_maq") || s.includes("pix-maq")) return "pix_maquininha";
  if (s === "pix" || s.includes("pix")) return "pix";
  if (s.includes("credit")) return "cartao_credito";
  if (s.includes("debit")) return "cartao_debito";
  if (s.includes("cheque")) return "cheque";
  if (s.includes("vale") || s.includes("gas_gratis")) return "vale_gas";
  if (s.includes("fiado") || s.includes("prazo")) return "fiado";
  return "outros";
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  em_preparo: { label: "Em Preparo", variant: "outline" },
  em_rota: { label: "Em Rota", variant: "outline" },
  entregue: { label: "Entregue", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#6366f1", "#8b5cf6", "#10b981", "#ef4444", "#2fc2b5"];

const canalLabels: Record<string, string> = {
  telefone: "Telefone",
  whatsapp: "WhatsApp",
  portaria: "Portaria",
  balcao: "Portaria",
  Entregador: "Entregador",
};

interface PedidoRelatorio {
  id: string;
  created_at: string;
  data_entrega: string | null;
  valor_total: number | null;
  status: string | null;
  forma_pagamento: string | null;
  canal_venda: string | null;
  clientes: { nome: string } | null;
  entregadores: { nome: string } | null;
  pedido_itens: Array<{
    quantidade: number;
    preco_unitario: number;
    produto_id: string | null;
    produtos: { nome: string; preco_custo?: number | null } | null;
  }>;
}

export default function RelatorioVendas() {
  const { toast } = useToast();
  const { unidadeAtual, unidades } = useUnidade();
  const { empresa } = useEmpresa();
  const queryClient = useQueryClient();
  const hoje = new Date();
  const formaLabel = useFormaPagamentoLabel();

  const [dataInicio, setDataInicio] = useState(format(startOfMonth(hoje), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(endOfMonth(hoje), "yyyy-MM-dd"));
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [canalFiltro, setCanalFiltro] = useState<string>("todos");
  const [editandoCanalId, setEditandoCanalId] = useState<string | null>(null);
  const [importItems, setImportItems] = useState<any[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [savingImport, setSavingImport] = useState(false);

  const isMatriz = unidadeAtual?.tipo === "matriz";
  const [consolidado, setConsolidado] = useState(false);
  useEffect(() => { if (!isMatriz && consolidado) setConsolidado(false); }, [isMatriz, consolidado]);
  const unidadeIds = useMemo(() => unidades.map(u => u.id), [unidades]);
  const scopeKey = consolidado ? `all:${empresa?.id || ""}` : (unidadeAtual?.id || "none");

  // Comparativo mensal (aba Produtos) — intervalo livre que pode cruzar anos
  type PeriodoMes = { ano: number; mes: number }; // mes: 0-11
  // Comparativo Mensal usa o período global (dataInicio/dataFim) como fonte da verdade
  const rangeIni = useMemo<PeriodoMes>(() => {
    const d = parseISO(dataInicio);
    return { ano: d.getFullYear(), mes: d.getMonth() };
  }, [dataInicio]);
  const rangeFim = useMemo<PeriodoMes>(() => {
    const d = parseISO(dataFim);
    return { ano: d.getFullYear(), mes: d.getMonth() };
  }, [dataFim]);
  const [metricaComparativo, setMetricaComparativo] = useState<"qtd" | "faturamento">("qtd");

  // Helpers de período
  const periodoKey = (p: PeriodoMes) => `${p.ano}-${String(p.mes + 1).padStart(2, "0")}`;
  const periodoIndex = (p: PeriodoMes) => p.ano * 12 + p.mes;
  const cmpPeriodo = (a: PeriodoMes, b: PeriodoMes) => periodoIndex(a) - periodoIndex(b);

  const periodosSelecionados = useMemo<PeriodoMes[]>(() => {
    const ini = cmpPeriodo(rangeIni, rangeFim) <= 0 ? rangeIni : rangeFim;
    const fim = cmpPeriodo(rangeIni, rangeFim) <= 0 ? rangeFim : rangeIni;
    const out: PeriodoMes[] = [];
    let ano = ini.ano, mes = ini.mes;
    while (ano < fim.ano || (ano === fim.ano && mes <= fim.mes)) {
      out.push({ ano, mes });
      mes++;
      if (mes > 11) { mes = 0; ano++; }
      if (out.length > 60) break; // safety
    }
    return out;
  }, [rangeIni, rangeFim]);

  const anosEnvolvidos = useMemo(
    () => Array.from(new Set(periodosSelecionados.map(p => p.ano))),
    [periodosSelecionados]
  );

  const NOMES_MES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const formatPeriodoCurto = (p: PeriodoMes) => `${NOMES_MES[p.mes]}/${String(p.ano).slice(-2)}`;

  // Buscar canais de venda cadastrados
  const { data: canaisVenda = [] } = useQuery({
    queryKey: ["canais-venda", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase.from("canais_venda").select("id, nome").eq("ativo", true);
      if (unidadeAtual?.id) {
        query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
      }
      const { data } = await query;
      return data || [];
    },
  });

  const alterarCanalVenda = async (pedidoId: string, novoCanal: string) => {
    const { error } = await supabase.from("pedidos").update({ canal_venda: novoCanal }).eq("id", pedidoId);
    if (error) {
      toast({ title: "Erro ao alterar canal", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Canal de venda atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["relatorio-vendas"] });
    }
    setEditandoCanalId(null);
  };

  const { data: pedidos = [], isLoading, refetch } = useQuery({
    queryKey: ["relatorio-vendas", dataInicio, dataFim, scopeKey],
    queryFn: async () => {
      let query = supabase
        .from("pedidos")
        .select(`
          id, created_at, data_entrega, valor_total, status, forma_pagamento, canal_venda,
          clientes (nome), entregadores (nome),
          pedido_itens (quantidade, preco_unitario, produto_id, produtos (nome, preco_custo))
        `)
        .gte("data_entrega", dataInicio)
        .lte("data_entrega", dataFim)
        .order("data_entrega", { ascending: false })
        .order("created_at", { ascending: false });

      if (consolidado && unidadeIds.length > 0) query = query.in("unidade_id", unidadeIds);
      else if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PedidoRelatorio[];
    },
  });

  // Buscar pedidos do período (pode cruzar anos) para comparativo mensal
  const periodoIniKey = periodosSelecionados[0] ? periodoKey(periodosSelecionados[0]) : "";
  const periodoFimKey = periodosSelecionados.length > 0 ? periodoKey(periodosSelecionados[periodosSelecionados.length - 1]) : "";
  const { data: pedidosAno = [] } = useQuery({
    queryKey: ["relatorio-vendas-periodo", periodoIniKey, periodoFimKey, scopeKey],
    enabled: periodosSelecionados.length > 0,
    queryFn: async () => {
      const pIni = periodosSelecionados[0];
      const pFim = periodosSelecionados[periodosSelecionados.length - 1];
      const inicio = `${pIni.ano}-${String(pIni.mes + 1).padStart(2, "0")}-01`;
      // último dia do mês final
      const ultimoDia = new Date(pFim.ano, pFim.mes + 1, 0).getDate();
      const fim = `${pFim.ano}-${String(pFim.mes + 1).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
      let query = supabase
        .from("pedidos")
        .select(`id, created_at, data_entrega, status, pedido_itens (quantidade, preco_unitario, produto_id, produtos (nome))`)
        .gte("data_entrega", inicio)
        .lte("data_entrega", fim);
      if (consolidado && unidadeIds.length > 0) query = query.in("unidade_id", unidadeIds);
      else if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PedidoRelatorio[];
    },
  });

  // Produtos da unidade (para incluir produtos sem pedidos no comparativo)
  const { data: produtosLista = [] } = useQuery({
    queryKey: ["relatorio-vendas-produtos", scopeKey],
    queryFn: async () => {
      let query = supabase.from("produtos").select("id, nome").eq("ativo", true);
      if (consolidado && unidadeIds.length > 0) query = query.in("unidade_id", unidadeIds);
      else if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as { id: string; nome: string }[];
    },
  });

  // Vendas históricas manuais (lançamentos do sistema antigo)
  const { data: vendasManuais = [], refetch: refetchManuais } = useQuery({
    queryKey: ["vendas-historicas-manuais", anosEnvolvidos.join(","), scopeKey],
    enabled: !!unidadeAtual?.id && anosEnvolvidos.length > 0,
    queryFn: async () => {
      let query = supabase
        .from("vendas_historicas_manuais")
        .select("id, produto_id, ano, mes, quantidade, faturamento")
        .in("ano", anosEnvolvidos);
      if (consolidado && unidadeIds.length > 0) query = query.in("unidade_id", unidadeIds);
      else query = query.eq("unidade_id", unidadeAtual!.id);
      const { data, error } = await query;
      if (error) throw error;
      // Quando consolidado, somar por produto/mes
      if (consolidado) {
        const acc = new Map<string, { id: string; produto_id: string; ano: number; mes: number; quantidade: number; faturamento: number }>();
        (data || []).forEach((v: any) => {
          const k = `${v.produto_id}-${v.mes}`;
          const cur = acc.get(k);
          if (cur) { cur.quantidade += Number(v.quantidade) || 0; cur.faturamento += Number(v.faturamento) || 0; }
          else acc.set(k, { ...v, quantidade: Number(v.quantidade) || 0, faturamento: Number(v.faturamento) || 0 });
        });
        return Array.from(acc.values());
      }
      return data || [];
    },
  });

  // Comparativo Mensal: produto x período (agrupado por NOME normalizado)
  const dadosComparativoMensal = useMemo(() => {
    const norm = (s: string) => (s || "Sem nome").trim().toLowerCase();
    // Para cada produto guardamos sistema/manual em mapa "YYYY-MM" -> number
    type Row = { nome: string; canonicalId: string | null; sistema: Map<string, number>; manual: Map<string, number> };
    const map = new Map<string, Row>();
    const ensure = (nome: string, id: string | null): Row => {
      const k = norm(nome);
      if (!map.has(k)) map.set(k, { nome: nome || "Sem nome", canonicalId: id, sistema: new Map(), manual: new Map() });
      const row = map.get(k)!;
      if (!row.canonicalId && id) row.canonicalId = id;
      return row;
    };
    const periodosKeys = periodosSelecionados.map(periodoKey);
    const periodosKeysSet = new Set(periodosKeys);

    // Sempre incluir todos os produtos da unidade (linha aparece mesmo sem dados)
    produtosLista.forEach(p => ensure(p.nome, p.id));

    // Agregar vendas reais do sistema — parse explícito YYYY-MM-DD para evitar issues de timezone
    pedidosAno.filter(p => p.status !== "cancelado").forEach(p => {
      const dataStr = p.data_entrega || p.created_at;
      if (!dataStr) return;
      const m = String(dataStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!m) return;
      const ano = Number(m[1]);
      const mes = Number(m[2]) - 1;
      const key = `${ano}-${String(mes + 1).padStart(2, "0")}`;
      if (!periodosKeysSet.has(key)) return;
      (p.pedido_itens || []).forEach(it => {
        const nome = it.produtos?.nome || "Sem nome";
        const row = ensure(nome, it.produto_id || null);
        const qtd = Number(it.quantidade) || 0;
        const preco = Number(it.preco_unitario) || 0;
        const v = metricaComparativo === "qtd" ? qtd : qtd * preco;
        row.sistema.set(key, (row.sistema.get(key) || 0) + v);
      });
    });

    // Adicionar lançamentos manuais (agrupados por nome do produto canônico)
    vendasManuais.forEach(vm => {
      const key = `${vm.ano}-${String(vm.mes).padStart(2, "0")}`;
      if (!periodosKeysSet.has(key)) return;
      const prod = produtosLista.find(p => p.id === vm.produto_id);
      const row = ensure(prod?.nome || "Produto", vm.produto_id);
      const valor = metricaComparativo === "qtd" ? Number(vm.quantidade) : Number(vm.faturamento);
      row.manual.set(key, (row.manual.get(key) || 0) + valor);
    });

    const linhas = Array.from(map.values()).map(row => {
      const valores = periodosKeys.map(k => (row.sistema.get(k) || 0) + (row.manual.get(k) || 0));
      const manual = periodosKeys.map(k => row.manual.get(k) || 0);
      const totalSelecionado = valores.reduce((s, v) => s + v, 0);
      const media = periodosKeys.length > 0 ? totalSelecionado / periodosKeys.length : 0;
      return { produto_id: row.canonicalId, nome: row.nome, valores, manual, media, totalSelecionado };
    });
    // Ordenação: vazios sempre por último; ordem fixa quando poucos produtos, alfabética quando muitos
    const isVazio = (nome: string) => /vazio|vasilhame/i.test(nome);
    const pesoFixo = (nome: string) => {
      const n = nome.toLowerCase();
      if (/[áa]gua.*20|20.*l/i.test(n)) return 0;
      if (/p\s*13/i.test(n)) return 1;
      if (/p\s*20/i.test(n)) return 2;
      if (/p\s*45/i.test(n)) return 3;
      return 99;
    };
    const usarOrdemFixa = linhas.length <= 6;
    linhas.sort((a, b) => {
      const va = isVazio(a.nome) ? 1 : 0;
      const vb = isVazio(b.nome) ? 1 : 0;
      if (va !== vb) return va - vb;
      if (usarOrdemFixa) {
        const pa = pesoFixo(a.nome);
        const pb = pesoFixo(b.nome);
        if (pa !== pb) return pa - pb;
      }
      return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
    });
    const totaisPorPeriodo = periodosKeys.map((_, i) =>
      linhas.reduce((s, l) => s + l.valores[i], 0)
    );
    const mediaTotal = periodosKeys.length > 0
      ? totaisPorPeriodo.reduce((s, v) => s + v, 0) / periodosKeys.length
      : 0;
    return { linhas, totaisPorPeriodo, mediaTotal };
  }, [pedidosAno, produtosLista, vendasManuais, periodosSelecionados, metricaComparativo]);

  // Salvar lançamento manual de venda histórica
  const salvarVendaManual = async (produto_id: string, periodoIdx: number, novoValor: number) => {
    if (!unidadeAtual?.id || !empresa?.id) {
      toast({ title: "Erro", description: "Selecione uma unidade.", variant: "destructive" });
      return;
    }
    const periodo = periodosSelecionados[periodoIdx];
    if (!periodo) return;
    const linha = dadosComparativoMensal.linhas.find(l => l.produto_id === produto_id);
    if (!linha) return;
    const sistema = (linha.valores[periodoIdx] || 0) - (linha.manual[periodoIdx] || 0);
    const manualDesejado = Math.max(0, novoValor - sistema);

    // Buscar registro existente para preservar a outra métrica
    const existente = vendasManuais.find(v => v.produto_id === produto_id && v.ano === periodo.ano && v.mes === periodo.mes + 1);
    const payload: any = {
      empresa_id: empresa.id,
      unidade_id: unidadeAtual.id,
      produto_id,
      ano: periodo.ano,
      mes: periodo.mes + 1,
      quantidade: existente?.quantidade ?? 0,
      faturamento: existente?.faturamento ?? 0,
    };
    if (metricaComparativo === "qtd") payload.quantidade = manualDesejado;
    else payload.faturamento = manualDesejado;

    const { error } = await supabase
      .from("vendas_historicas_manuais")
      .upsert(payload, { onConflict: "unidade_id,produto_id,ano,mes" });

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      sonnerToast.success("Venda histórica salva");
      refetchManuais();
    }
  };

  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((p) => {
      if (statusFiltro !== "todos" && p.status !== statusFiltro) return false;
      if (canalFiltro !== "todos" && p.canal_venda !== canalFiltro) return false;
      return true;
    });
  }, [pedidos, statusFiltro, canalFiltro]);

  const metricas = useMemo(() => {
    const vendas = pedidosFiltrados.filter((p) => p.status !== "cancelado");
    const totalVendas = vendas.reduce((acc, p) => acc + (p.valor_total || 0), 0);
    const totalPedidos = pedidosFiltrados.length;
    const pedidosEntregues = pedidosFiltrados.filter((p) => p.status === "entregue").length;
    const pedidosCancelados = pedidosFiltrados.filter((p) => p.status === "cancelado").length;
    const ticketMedio = vendas.length > 0 ? totalVendas / vendas.length : 0;
    return { totalVendas, totalPedidos, pedidosEntregues, pedidosCancelados, ticketMedio };
  }, [pedidosFiltrados]);

  // Agrupamento por Entregador
  const dadosPorEntregador = useMemo(() => {
    const map = new Map<string, { nome: string; total: number; qtd: number }>();
    pedidosFiltrados.filter(p => p.status !== "cancelado").forEach(p => {
      const nome = p.entregadores?.nome || "Sem entregador";
      const cur = map.get(nome) || { nome, total: 0, qtd: 0 };
      cur.total += p.valor_total || 0;
      cur.qtd += 1;
      map.set(nome, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [pedidosFiltrados]);

  // Agrupamento cruzado: Entregador x Canal de Venda (com produto)
  const dadosEntregadorCanal = useMemo(() => {
    const map = new Map<string, { nome: string; canais: Record<string, { qtd: number; valor: number }>; totalQtd: number; totalValor: number }>();
    const canaisSet = new Set<string>();
    pedidosFiltrados.filter(p => p.status !== "cancelado").forEach(p => {
      const nomeEntregador = p.entregadores?.nome || "Sem entregador";
      const canal = p.canal_venda || "outros";
      canaisSet.add(canal);
      const cur = map.get(nomeEntregador) || { nome: nomeEntregador, canais: {}, totalQtd: 0, totalValor: 0 };
      if (!cur.canais[canal]) cur.canais[canal] = { qtd: 0, valor: 0 };
      const qtdItens = p.pedido_itens?.reduce((acc, i) => acc + i.quantidade, 0) || 1;
      cur.canais[canal].qtd += qtdItens;
      cur.canais[canal].valor += p.valor_total || 0;
      cur.totalQtd += qtdItens;
      cur.totalValor += p.valor_total || 0;
      map.set(nomeEntregador, cur);
    });
    return { entregadores: Array.from(map.values()).sort((a, b) => b.totalQtd - a.totalQtd), canais: Array.from(canaisSet).sort() };
  }, [pedidosFiltrados]);

  // Agrupamento por Canal de Venda
  const dadosPorCanal = useMemo(() => {
    const map = new Map<string, { canal: string; label: string; total: number; qtd: number }>();
    pedidosFiltrados.filter(p => p.status !== "cancelado").forEach(p => {
      const canal = p.canal_venda || "outros";
      const label = canalLabels[canal] || canal;
      const cur = map.get(canal) || { canal, label, total: 0, qtd: 0 };
      cur.total += p.valor_total || 0;
      cur.qtd += 1;
      map.set(canal, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [pedidosFiltrados]);

  // Agrupamento por Produto
  const dadosPorProduto = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; faturamento: number; pedidos: Set<string> }>();
    pedidosFiltrados.filter(p => p.status !== "cancelado").forEach(p => {
      (p.pedido_itens || []).forEach(it => {
        const nome = it.produtos?.nome || "Sem nome";
        const cur = map.get(nome) || { nome, qtd: 0, faturamento: 0, pedidos: new Set() };
        cur.qtd += Number(it.quantidade) || 0;
        cur.faturamento += (Number(it.quantidade) || 0) * (Number(it.preco_unitario) || 0);
        cur.pedidos.add(p.id);
        map.set(nome, cur);
      });
    });
    const arr = Array.from(map.values()).map(p => ({ nome: p.nome, qtd: p.qtd, faturamento: p.faturamento, pedidosCount: p.pedidos.size }));
    return arr.sort((a, b) => b.qtd - a.qtd);
  }, [pedidosFiltrados]);

  // Agrupamento por Forma de Pagamento (normalizado)
  const dadosPorFormaPagamento = useMemo(() => {
    const map = new Map<string, { forma: string; label: string; qtd: number; total: number }>();
    pedidosFiltrados.filter(p => p.status !== "cancelado").forEach(p => {
      const forma = normalizarFormaPagamento(p.forma_pagamento);
      const label = formaPagamentoLabels[forma] || forma;
      const cur = map.get(forma) || { forma, label, qtd: 0, total: 0 };
      cur.qtd += 1;
      cur.total += p.valor_total || 0;
      map.set(forma, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [pedidosFiltrados]);

  // Evolução Diária
  const dadosPorDia = useMemo(() => {
    const map = new Map<string, { dia: string; total: number; qtd: number }>();
    pedidosFiltrados.filter(p => p.status !== "cancelado").forEach(p => {
      const dia = p.data_entrega || (p.created_at ? p.created_at.slice(0, 10) : "—");
      const cur = map.get(dia) || { dia, total: 0, qtd: 0 };
      cur.total += p.valor_total || 0;
      cur.qtd += 1;
      map.set(dia, cur);
    });
    const arr = Array.from(map.values()).sort((a, b) => a.dia.localeCompare(b.dia));
    return arr.map(d => ({ ...d, label: format(parseISO(`${d.dia}T12:00:00`), "dd/MM", { locale: ptBR }) }));
  }, [pedidosFiltrados]);

  // Top Clientes
  const dadosTopClientes = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; total: number; ultima: string }>();
    pedidosFiltrados.filter(p => p.status !== "cancelado").forEach(p => {
      const nome = p.clientes?.nome || "Não identificado";
      const data = p.data_entrega || p.created_at?.slice(0, 10) || "";
      const cur = map.get(nome) || { nome, qtd: 0, total: 0, ultima: data };
      cur.qtd += 1;
      cur.total += p.valor_total || 0;
      if (data > cur.ultima) cur.ultima = data;
      map.set(nome, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [pedidosFiltrados]);

  const exportarExcel = () => {
    if (pedidosFiltrados.length === 0) {
      toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      return;
    }

    const dadosExport = pedidosFiltrados.map((p) => ({
      "Data": p.data_entrega ? format(parseISO(`${p.data_entrega}T12:00:00`), "dd/MM/yyyy", { locale: ptBR }) : format(parseISO(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      "Pedido": p.id.slice(0, 8).toUpperCase(),
      "Cliente": p.clientes?.nome || "Não identificado",
      "Entregador": p.entregadores?.nome || "-",
      "Itens": p.pedido_itens?.map((i) => `${i.quantidade}x ${i.produtos?.nome || "?"}`).join(", ") || "-",
      "Qtd. Itens": p.pedido_itens?.reduce((acc, i) => acc + i.quantidade, 0) || 0,
      "Valor Total": p.valor_total || 0,
      "Forma Pagamento": formaLabel(p.forma_pagamento),
      "Canal": canalLabels[p.canal_venda || ""] || p.canal_venda || "-",
      "Status": statusConfig[p.status || "pendente"]?.label || p.status,
    }));

    const resumo = [
      { "Métrica": "Total de Vendas", "Valor": `R$ ${metricas.totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
      { "Métrica": "Total de Pedidos", "Valor": metricas.totalPedidos.toString() },
      { "Métrica": "Pedidos Entregues", "Valor": metricas.pedidosEntregues.toString() },
      { "Métrica": "Pedidos Cancelados", "Valor": metricas.pedidosCancelados.toString() },
      { "Métrica": "Ticket Médio", "Valor": `R$ ${metricas.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
      { "Métrica": "Período", "Valor": `${format(parseISO(dataInicio), "dd/MM/yyyy")} a ${format(parseISO(dataFim), "dd/MM/yyyy")}` },
    ];

    const wb = XLSX.utils.book_new();
    const wsPedidos = XLSX.utils.json_to_sheet(dadosExport);
    wsPedidos["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 25 }, { wch: 20 }, { wch: 40 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsPedidos, "Pedidos");

    const wsResumo = XLSX.utils.json_to_sheet(resumo);
    wsResumo["!cols"] = [{ wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

    // Aba por Entregador
    const wsEntregador = XLSX.utils.json_to_sheet(dadosPorEntregador.map(e => ({
      Entregador: e.nome, Pedidos: e.qtd,
      "Faturamento": `R$ ${e.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      "Ticket Médio": `R$ ${(e.qtd > 0 ? e.total / e.qtd : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    })));
    XLSX.utils.book_append_sheet(wb, wsEntregador, "Por Entregador");

    // Aba por Canal
    const wsCanal = XLSX.utils.json_to_sheet(dadosPorCanal.map(c => ({
      Canal: c.label, Pedidos: c.qtd,
      "Faturamento": `R$ ${c.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      "Ticket Médio": `R$ ${(c.qtd > 0 ? c.total / c.qtd : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    })));
    XLSX.utils.book_append_sheet(wb, wsCanal, "Por Canal");

    // Aba por Produto
    const wsProduto = XLSX.utils.json_to_sheet(dadosPorProduto.map(p => ({
      Produto: p.nome, "Qtd Vendida": p.qtd, Pedidos: p.pedidosCount,
      "Faturamento": `R$ ${p.faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    })));
    XLSX.utils.book_append_sheet(wb, wsProduto, "Por Produto");

    // Aba por Forma de Pagamento
    const wsPgto = XLSX.utils.json_to_sheet(dadosPorFormaPagamento.map(f => ({
      Forma: f.label, Pedidos: f.qtd,
      "Faturamento": `R$ ${f.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      "Ticket Médio": `R$ ${(f.qtd > 0 ? f.total / f.qtd : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    })));
    XLSX.utils.book_append_sheet(wb, wsPgto, "Por Pagamento");

    // Aba por Dia
    const wsDia = XLSX.utils.json_to_sheet(dadosPorDia.map(d => ({
      Data: d.label, Pedidos: d.qtd,
      "Faturamento": `R$ ${d.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    })));
    XLSX.utils.book_append_sheet(wb, wsDia, "Por Dia");

    // Aba Top Clientes
    const wsClientes = XLSX.utils.json_to_sheet(dadosTopClientes.map(c => ({
      Cliente: c.nome, Pedidos: c.qtd,
      "Faturamento": `R$ ${c.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      "Ticket Médio": `R$ ${(c.qtd > 0 ? c.total / c.qtd : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      "Última Compra": c.ultima || "-",
    })));
    XLSX.utils.book_append_sheet(wb, wsClientes, "Top Clientes");


    const nomeArquivo = `relatorio-vendas-${format(parseISO(dataInicio), "ddMMyyyy")}-${format(parseISO(dataFim), "ddMMyyyy")}.xlsx`;
    XLSX.writeFile(wb, nomeArquivo);
    toast({ title: "Relatório exportado!", description: `Arquivo ${nomeArquivo} gerado.` });
  };

  const exportarPDF = () => {
    if (pedidosFiltrados.length === 0) {
      toast({ title: "Nenhum dado para exportar", variant: "destructive" });
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Relatório de Vendas", 14, 15);
    doc.setFontSize(10);
    doc.text(`Período: ${format(parseISO(dataInicio), "dd/MM/yyyy")} a ${format(parseISO(dataFim), "dd/MM/yyyy")}`, 14, 22);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);

    // Resumo geral
    autoTable(doc, {
      head: [["Métrica", "Valor"]],
      body: [
        ["Total Vendas", `R$ ${metricas.totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
        ["Total Pedidos", String(metricas.totalPedidos)],
        ["Entregues", String(metricas.pedidosEntregues)],
        ["Cancelados", String(metricas.pedidosCancelados)],
        ["Ticket Médio", `R$ ${metricas.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
      ],
      startY: 34,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [51, 65, 85] },
    });

    // Por Entregador
    const y1 = (doc as any).lastAutoTable?.finalY || 80;
    doc.setFontSize(12);
    doc.text("Vendas por Entregador", 14, y1 + 10);
    autoTable(doc, {
      head: [["Entregador", "Pedidos", "Faturamento", "Ticket Médio"]],
      body: dadosPorEntregador.map(e => [
        e.nome, String(e.qtd),
        `R$ ${e.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        `R$ ${(e.qtd > 0 ? e.total / e.qtd : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      ]),
      startY: y1 + 14,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [51, 65, 85] },
    });

    // Por Canal
    const y2 = (doc as any).lastAutoTable?.finalY || 140;
    doc.setFontSize(12);
    doc.text("Vendas por Canal", 14, y2 + 10);
    autoTable(doc, {
      head: [["Canal", "Pedidos", "Faturamento", "Ticket Médio"]],
      body: dadosPorCanal.map(c => [
        c.label, String(c.qtd),
        `R$ ${c.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        `R$ ${(c.qtd > 0 ? c.total / c.qtd : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      ]),
      startY: y2 + 14,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [51, 65, 85] },
    });

    // Por Produto
    const y3 = (doc as any).lastAutoTable?.finalY || 200;
    doc.setFontSize(12);
    doc.text("Vendas por Produto", 14, y3 + 10);
    autoTable(doc, {
      head: [["Produto", "Qtd", "Pedidos", "Faturamento"]],
      body: dadosPorProduto.map(p => [
        p.nome, String(p.qtd), String(p.pedidosCount),
        `R$ ${p.faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      ]),
      startY: y3 + 14,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [51, 65, 85] },
    });

    doc.save(`relatorio-vendas-${format(parseISO(dataInicio), "ddMMyyyy")}-${format(parseISO(dataFim), "ddMMyyyy")}.pdf`);
    toast({ title: "PDF exportado!" });
  };

  const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const handleImportData = (data: any) => {
    const pedidos = data?.pedidos || [];
    if (pedidos.length === 0) {
      sonnerToast.error("Nenhum pedido encontrado na imagem");
      return;
    }
    const items = pedidos.map((p: any) => ({
      cliente_nome: p.cliente_nome || "",
      cliente_id: p.cliente_id || null,
      data: p.data || getBrasiliaDateString(),
      itens_desc: (p.itens || []).map((i: any) => `${i.quantidade}x ${i.nome}`).join(", "),
      itens_raw: p.itens || [],
      valor_total: p.valor_total || 0,
      forma_pagamento: p.forma_pagamento || "dinheiro",
      status: p.status || "entregue",
      endereco: p.endereco || "",
      observacoes: p.observacoes || "",
    }));
    setImportItems(items);
    setImportDialogOpen(true);
    sonnerToast.success(`${items.length} pedido(s) extraído(s)!`);
  };

  const salvarImportacao = async () => {
    setSavingImport(true);
    try {
      for (const item of importItems) {
        const pedidoData: any = {
          cliente_id: item.cliente_id || null,
          valor_total: item.valor_total,
          forma_pagamento: item.forma_pagamento,
          status: item.status,
          canal_venda: "importado",
          observacoes: `[Importado] ${item.observacoes || ""}`.trim(),
          endereco_entrega: item.endereco || null,
          data_entrega: item.data,
          created_at: `${item.data}T12:00:00-03:00`,
        };
        if (unidadeAtual?.id) pedidoData.unidade_id = unidadeAtual.id;

        const { data: pedido, error: pedidoErr } = await supabase
          .from("pedidos")
          .insert(pedidoData)
          .select("id")
          .single();

        if (pedidoErr) {
          console.error("Erro ao inserir pedido:", pedidoErr);
          continue;
        }

        if (item.itens_raw?.length > 0) {
          const itens = item.itens_raw.map((it: any) => ({
            pedido_id: pedido.id,
            produto_id: it.produto_id || null,
            quantidade: it.quantidade || 1,
            preco_unitario: it.preco_unitario || 0,
          }));
          await supabase.from("pedido_itens").insert(itens);
        }
      }

      sonnerToast.success(`${importItems.length} pedido(s) importado(s)!`);
      setImportDialogOpen(false);
      setImportItems([]);
      refetch();
    } catch (err: any) {
      sonnerToast.error(err.message || "Erro ao salvar importação");
    } finally {
      setSavingImport(false);
    }
  };

  // ---------------- Novo painel executivo (UI) ----------------
  const [entregadorFiltroUI, setEntregadorFiltroUI] = useState<string>("todos");
  const [canalFiltroUI, setCanalFiltroUI] = useState<string>("todos");
  const [produtoFiltroUI, setProdutoFiltroUI] = useState<string>("todos");
  const [produtoBuscaUI, setProdutoBuscaUI] = useState<string>("");
  const [abaUI, setAbaUI] = useState<"produto" | "entregador" | "canal">("produto");
  const [expandedEntregadorId, setExpandedEntregadorId] = useState<string | null>(null);

  const entregadoresOpcoes = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach(p => set.add(p.entregadores?.nome || "Sem entregador"));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [pedidos]);

  const canaisOpcoes = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach(p => set.add(p.canal_venda || "outros"));
    return Array.from(set).sort();
  }, [pedidos]);

  const produtosOpcoes = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach(p => (p.pedido_itens || []).forEach(it => set.add(it.produtos?.nome || "Sem nome")));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [pedidos]);

  const pedidosUI = useMemo(() => {
    return pedidos
      .filter(p => p.status !== "cancelado")
      .filter(p => {
        if (entregadorFiltroUI !== "todos" && (p.entregadores?.nome || "Sem entregador") !== entregadorFiltroUI) return false;
        if (canalFiltroUI !== "todos" && (p.canal_venda || "outros") !== canalFiltroUI) return false;
        if (produtoFiltroUI !== "todos") {
          const tem = (p.pedido_itens || []).some(it => (it.produtos?.nome || "Sem nome") === produtoFiltroUI);
          if (!tem) return false;
        }
        return true;
      });
  }, [pedidos, entregadorFiltroUI, canalFiltroUI, produtoFiltroUI]);

  const kpisUI = useMemo(() => {
    let itens = 0;
    let faturamento = 0;
    pedidosUI.forEach(p => {
      faturamento += Number(p.valor_total) || 0;
      (p.pedido_itens || []).forEach(it => { itens += Number(it.quantidade) || 0; });
    });
    return {
      faturamento,
      itens,
      precoMedio: itens > 0 ? faturamento / itens : 0,
      pedidos: pedidosUI.length,
    };
  }, [pedidosUI]);

  const porProdutoUI = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; total: number }>();
    pedidosUI.forEach(p => (p.pedido_itens || []).forEach(it => {
      const nome = it.produtos?.nome || "Sem nome";
      const cur = map.get(nome) || { nome, qtd: 0, total: 0 };
      const q = Number(it.quantidade) || 0;
      const pu = Number(it.preco_unitario) || 0;
      cur.qtd += q;
      cur.total += q * pu;
      map.set(nome, cur);
    }));
    const termo = produtoBuscaUI.trim().toLowerCase();
    return Array.from(map.values())
      .map(r => ({ ...r, precoMedio: r.qtd > 0 ? r.total / r.qtd : 0 }))
      .filter(r => !termo || r.nome.toLowerCase().includes(termo))
      .sort((a, b) => b.total - a.total);
  }, [pedidosUI, produtoBuscaUI]);

  const porEntregadorUI = useMemo(() => {
    type Det = { nome: string; qtd: number; total: number };
    type Linha = {
      id: string;
      nome: string;
      qtd: number;
      faturamento: number;
      lucro: number;
      temCusto: boolean;
      detalhes: Det[];
    };
    const map = new Map<string, Linha & { _det: Map<string, Det> }>();
    pedidosUI.forEach(p => {
      const nome = p.entregadores?.nome || "Sem entregador";
      const cur = map.get(nome) || { id: nome, nome, qtd: 0, faturamento: 0, lucro: 0, temCusto: false, detalhes: [], _det: new Map() };
      (p.pedido_itens || []).forEach(it => {
        const q = Number(it.quantidade) || 0;
        const pu = Number(it.preco_unitario) || 0;
        const pc = it.produtos?.preco_custo;
        cur.qtd += q;
        cur.faturamento += q * pu;
        if (pc !== null && pc !== undefined) {
          cur.temCusto = true;
          cur.lucro += q * (pu - Number(pc));
        }
        const dnome = it.produtos?.nome || "Sem nome";
        const d = cur._det.get(dnome) || { nome: dnome, qtd: 0, total: 0 };
        d.qtd += q;
        d.total += q * pu;
        cur._det.set(dnome, d);
      });
      map.set(nome, cur);
    });
    return Array.from(map.values()).map(l => ({
      ...l,
      detalhes: Array.from(l._det.values()).sort((a, b) => b.total - a.total),
    })).sort((a, b) => b.faturamento - a.faturamento);
  }, [pedidosUI]);

  const porCanalUI = useMemo(() => {
    const map = new Map<string, { canal: string; nome: string; qtd: number; total: number }>();
    pedidosUI.forEach(p => {
      const canal = p.canal_venda || "outros";
      const nome = canalLabels[canal] || canal.charAt(0).toUpperCase() + canal.slice(1);
      const cur = map.get(canal) || { canal, nome, qtd: 0, total: 0 };
      const qtdItens = (p.pedido_itens || []).reduce((s, it) => s + (Number(it.quantidade) || 0), 0);
      cur.qtd += qtdItens;
      cur.total += Number(p.valor_total) || 0;
      map.set(canal, cur);
    });
    return Array.from(map.values())
      .map(r => ({ ...r, precoMedio: r.qtd > 0 ? r.total / r.qtd : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [pedidosUI]);

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtInt = (v: number) => v.toLocaleString("pt-BR");

  return (
    <MainLayout>
      <Header title="Relatório de Vendas" subtitle="Acompanhe vendas por produto, entregador e canal." />
      <div className="w-full min-w-0 max-w-full p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Ações */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
          <Button variant="outline" size="sm" className="h-10 sm:h-9 gap-2" onClick={exportarExcel}>
            <FileSpreadsheet className="h-4 w-4" />Exportar Excel
          </Button>
          <Button variant="outline" size="sm" className="h-10 sm:h-9 gap-2" onClick={exportarPDF}>
            <Download className="h-4 w-4" />Exportar PDF
          </Button>
          <Button size="sm" className="h-10 sm:h-9 gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />Atualizar
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4 text-primary" />Filtros
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Data Inicial</Label>
                <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-10" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data Final</Label>
                <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-10" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Entregador</Label>
                <Select value={entregadorFiltroUI} onValueChange={setEntregadorFiltroUI}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {entregadoresOpcoes.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Canal de Venda</Label>
                <Select value={canalFiltroUI} onValueChange={setCanalFiltroUI}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {canaisOpcoes.map(c => <SelectItem key={c} value={c}>{canalLabels[c] || c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Produto</Label>
                <Select value={produtoFiltroUI} onValueChange={setProdutoFiltroUI}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {produtosOpcoes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="hover:border-primary/40 transition-colors">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><DollarSign className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Faturamento Total</p>
                <p className="text-lg sm:text-2xl font-bold mt-0.5 truncate">{fmtBRL(kpisUI.faturamento)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:border-primary/40 transition-colors">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Package className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Itens Vendidos</p>
                <p className="text-lg sm:text-2xl font-bold mt-0.5">{fmtInt(kpisUI.itens)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:border-primary/40 transition-colors">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><TrendingUp className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Preço Médio</p>
                <p className="text-lg sm:text-2xl font-bold mt-0.5 truncate">{fmtBRL(kpisUI.precoMedio)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:border-primary/40 transition-colors">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><ShoppingCart className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Total de Pedidos</p>
                <p className="text-lg sm:text-2xl font-bold mt-0.5">{fmtInt(kpisUI.pedidos)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Abas */}
        <Tabs value={abaUI} onValueChange={(v) => setAbaUI(v as any)} className="space-y-3">
          <TabsList className="grid grid-cols-3 w-full h-auto p-1">
            <TabsTrigger value="produto" className="gap-1.5 text-xs sm:text-sm py-2">
              <Package className="h-4 w-4" />Por Produto
            </TabsTrigger>
            <TabsTrigger value="entregador" className="gap-1.5 text-xs sm:text-sm py-2">
              <Users className="h-4 w-4" />Por Entregador
            </TabsTrigger>
            <TabsTrigger value="canal" className="gap-1.5 text-xs sm:text-sm py-2">
              <Megaphone className="h-4 w-4" />Por Canal
            </TabsTrigger>
          </TabsList>

          {/* Aba Produto */}
          <TabsContent value="produto" className="space-y-3">
            <Input
              placeholder="Buscar produto..."
              value={produtoBuscaUI}
              onChange={e => setProdutoBuscaUI(e.target.value)}
              className="h-10 max-w-sm"
            />
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" />
                  </div>
                ) : porProdutoUI.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">Sem vendas no período.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[520px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Qtd Vendida</TableHead>
                          <TableHead className="text-right">Preço Médio</TableHead>
                          <TableHead className="text-right">Total Vendido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {porProdutoUI.map(r => (
                          <TableRow key={r.nome}>
                            <TableCell className="font-medium max-w-[220px] truncate" title={r.nome}>{r.nome}</TableCell>
                            <TableCell className="text-right">{fmtInt(r.qtd)}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{fmtBRL(r.precoMedio)}</TableCell>
                            <TableCell className="text-right font-semibold whitespace-nowrap">{fmtBRL(r.total)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">
                            {fmtInt(porProdutoUI.reduce((s, r) => s + r.qtd, 0))}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {fmtBRL(
                              porProdutoUI.reduce((s, r) => s + r.qtd, 0) > 0
                                ? porProdutoUI.reduce((s, r) => s + r.total, 0) / porProdutoUI.reduce((s, r) => s + r.qtd, 0)
                                : 0
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {fmtBRL(porProdutoUI.reduce((s, r) => s + r.total, 0))}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Entregador */}
          <TabsContent value="entregador" className="space-y-3">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                <Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" />
              </div>
            ) : porEntregadorUI.length === 0 ? (
              <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Sem vendas no período.</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {porEntregadorUI.map(l => {
                  const expanded = expandedEntregadorId === l.id;
                  const margem = l.temCusto && l.faturamento > 0 ? (l.lucro / l.faturamento) * 100 : null;
                  return (
                    <Card key={l.id} className="hover:border-primary/40 transition-colors">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold text-base truncate uppercase tracking-wide" title={l.nome}>{l.nome}</h3>
                          <Badge variant="secondary" className="shrink-0">{fmtInt(l.qtd)} itens</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-lg bg-muted/40 px-2.5 py-2">
                            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Faturamento</p>
                            <p className="font-semibold truncate">{fmtBRL(l.faturamento)}</p>
                          </div>
                          <div className="rounded-lg bg-muted/40 px-2.5 py-2">
                            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Lucro</p>
                            <p className={cn("font-semibold truncate", l.temCusto ? (l.lucro >= 0 ? "text-emerald-500" : "text-destructive") : "text-muted-foreground")}>
                              {l.temCusto ? fmtBRL(l.lucro) : "—"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/40 px-2.5 py-2">
                            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Margem</p>
                            <p className={cn("font-semibold", margem !== null ? (margem >= 0 ? "text-emerald-500" : "text-destructive") : "text-muted-foreground")}>
                              {margem !== null ? `${margem.toFixed(2)}%` : "—"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/40 px-2.5 py-2">
                            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Itens</p>
                            <p className="font-semibold">{fmtInt(l.qtd)}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-9"
                          onClick={() => setExpandedEntregadorId(expanded ? null : l.id)}
                        >
                          {expanded ? "Ocultar Detalhes" : "Ver Detalhes"}
                        </Button>
                        {expanded && (
                          <div className="border-t pt-3 -mx-1">
                            <div className="overflow-x-auto">
                              <Table className="min-w-[320px]">
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="h-8">Produto</TableHead>
                                    <TableHead className="h-8 text-right">Qtd</TableHead>
                                    <TableHead className="h-8 text-right">Preço Médio</TableHead>
                                    <TableHead className="h-8 text-right">Total</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {l.detalhes.map(d => (
                                    <TableRow key={d.nome}>
                                      <TableCell className="py-1.5 font-medium max-w-[140px] truncate" title={d.nome}>{d.nome}</TableCell>
                                      <TableCell className="py-1.5 text-right">{fmtInt(d.qtd)}</TableCell>
                                      <TableCell className="py-1.5 text-right whitespace-nowrap">{fmtBRL(d.qtd > 0 ? d.total / d.qtd : 0)}</TableCell>
                                      <TableCell className="py-1.5 text-right font-semibold whitespace-nowrap">{fmtBRL(d.total)}</TableCell>
                                    </TableRow>
                                  ))}
                                  <TableRow className="bg-muted/50 font-bold">
                                    <TableCell className="py-1.5">Total</TableCell>
                                    <TableCell className="py-1.5 text-right">{fmtInt(l.qtd)}</TableCell>
                                    <TableCell className="py-1.5 text-right whitespace-nowrap">{fmtBRL(l.qtd > 0 ? l.faturamento / l.qtd : 0)}</TableCell>
                                    <TableCell className="py-1.5 text-right whitespace-nowrap">{fmtBRL(l.faturamento)}</TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Aba Canal */}
          <TabsContent value="canal" className="space-y-3">
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" />
                  </div>
                ) : porCanalUI.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">Sem vendas no período.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[460px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Canal</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Preço Médio</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {porCanalUI.map(r => (
                          <TableRow key={r.canal}>
                            <TableCell className="font-medium">{r.nome}</TableCell>
                            <TableCell className="text-right">{fmtInt(r.qtd)}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{fmtBRL(r.precoMedio)}</TableCell>
                            <TableCell className="text-right font-semibold whitespace-nowrap">{fmtBRL(r.total)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">{fmtInt(porCanalUI.reduce((s, r) => s + r.qtd, 0))}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {fmtBRL(
                              porCanalUI.reduce((s, r) => s + r.qtd, 0) > 0
                                ? porCanalUI.reduce((s, r) => s + r.total, 0) / porCanalUI.reduce((s, r) => s + r.qtd, 0)
                                : 0
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">{fmtBRL(porCanalUI.reduce((s, r) => s + r.total, 0))}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}


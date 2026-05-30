import { useState, useMemo, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { getBrasiliaDateString, cn } from "@/lib/utils";
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
    produtos: { nome: string } | null;
  }>;
}

export default function RelatorioVendas() {
  const { toast } = useToast();
  const { unidadeAtual, unidades } = useUnidade();
  const { empresa } = useEmpresa();
  const queryClient = useQueryClient();
  const hoje = new Date();

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
          pedido_itens (quantidade, preco_unitario, produto_id, produtos (nome))
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
      "Forma Pagamento": p.forma_pagamento || "-",
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

  return (
    <MainLayout>
      <Header title="Relatório de Vendas" subtitle="Análise detalhada das vendas" />
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="outline" className="gap-2" onClick={exportarPDF}>
              <Download className="h-4 w-4" />PDF
            </Button>
            <Button className="gap-2" onClick={exportarExcel}>
              <FileSpreadsheet className="h-4 w-4" />Excel
            </Button>
            <div className="flex items-center gap-2 border-l pl-2 ml-1">
              <span className="text-xs text-muted-foreground hidden sm:inline">Importar legado:</span>
              <SmartImportButtons
                edgeFunctionName="parse-orders-history"
                onDataExtracted={handleImportData}
              />
            </div>
          </div>
        </div>

        {/* Barra de filtros unificada (sticky) */}
        {(() => {
          const presets = [
            { label: "Mês atual", get: () => { const h = new Date(); return [startOfMonth(h), endOfMonth(h)] as const; } },
            { label: "Últimos 3 meses", get: () => { const h = new Date(); return [startOfMonth(subMonths(h, 2)), endOfMonth(h)] as const; } },
            { label: "Últimos 6 meses", get: () => { const h = new Date(); return [startOfMonth(subMonths(h, 5)), endOfMonth(h)] as const; } },
            { label: "Últimos 12 meses", get: () => { const h = new Date(); return [startOfMonth(subMonths(h, 11)), endOfMonth(h)] as const; } },
            { label: "Ano atual", get: () => { const h = new Date(); return [startOfYear(h), endOfYear(h)] as const; } },
            { label: "Ano anterior", get: () => { const h = new Date(); const ant = new Date(h.getFullYear() - 1, 0, 1); return [startOfYear(ant), endOfYear(ant)] as const; } },
          ];
          const labelPresetAtivo = presets.find(p => {
            const [i, f] = p.get();
            return dataInicio === format(i, "yyyy-MM-dd") && dataFim === format(f, "yyyy-MM-dd");
          })?.label;
          const labelPeriodo = labelPresetAtivo
            ?? `${format(parseISO(dataInicio), "dd MMM yy", { locale: ptBR })} – ${format(parseISO(dataFim), "dd MMM yy", { locale: ptBR })}`;
          const filtrosAtivos = (statusFiltro !== "todos" ? 1 : 0) + (canalFiltro !== "todos" ? 1 : 0) + (consolidado ? 1 : 0);
          return (
            <div className="sticky top-0 z-20 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 py-2 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border/60">
              <div className="flex flex-wrap items-center gap-2">
                {/* Período */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 h-9">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <span className="truncate max-w-[200px] font-medium">{labelPeriodo}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[320px] p-3 space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Atalhos</Label>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        {presets.map((p) => {
                          const [i, f] = p.get();
                          const iStr = format(i, "yyyy-MM-dd");
                          const fStr = format(f, "yyyy-MM-dd");
                          const ativo = dataInicio === iStr && dataFim === fStr;
                          return (
                            <Button
                              key={p.label}
                              type="button"
                              variant={ativo ? "default" : "outline"}
                              size="sm"
                              className="h-8 text-xs justify-start"
                              onClick={() => { setDataInicio(iStr); setDataFim(fStr); }}
                            >
                              {p.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/60">
                      <div className="space-y-1">
                        <Label className="text-xs">Início</Label>
                        <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-9" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Fim</Label>
                        <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9" />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Mais filtros */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 h-9">
                      <SlidersHorizontal className="h-4 w-4" />
                      <span className="hidden sm:inline">Filtros</span>
                      {filtrosAtivos > 0 && (
                        <Badge variant="default" className="h-5 min-w-5 px-1.5 text-[10px]">{filtrosAtivos}</Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[280px] p-3 space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Status</Label>
                      <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="em_preparo">Em Preparo</SelectItem>
                          <SelectItem value="em_rota">Em Rota</SelectItem>
                          <SelectItem value="entregue">Entregue</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Canal</Label>
                      <Select value={canalFiltro} onValueChange={setCanalFiltro}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          {canaisVenda.map((c) => (
                            <SelectItem key={c.id} value={c.nome}>{canalLabels[c.nome] || c.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {isMatriz && (
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                        <Label htmlFor="consolidado" className="text-sm cursor-pointer">
                          Consolidar unidades
                          <span className="block text-xs text-muted-foreground font-normal">{unidadeIds.length} {unidadeIds.length === 1 ? "unidade" : "unidades"}</span>
                        </Label>
                        <Switch id="consolidado" checked={consolidado} onCheckedChange={setConsolidado} />
                      </div>
                    )}
                  </PopoverContent>
                </Popover>

                <Button variant="ghost" size="sm" className="h-9 gap-2 ml-auto" onClick={() => refetch()} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Atualizar</span>
                </Button>
              </div>

              {/* Chips de filtros ativos */}
              {filtrosAtivos > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {statusFiltro !== "todos" && (
                    <Badge variant="secondary" className="gap-1 pr-1">
                      Status: {statusConfig[statusFiltro]?.label ?? statusFiltro}
                      <button onClick={() => setStatusFiltro("todos")} className="ml-1 rounded-full hover:bg-background/60 p-0.5"><X className="h-3 w-3" /></button>
                    </Badge>
                  )}
                  {canalFiltro !== "todos" && (
                    <Badge variant="secondary" className="gap-1 pr-1">
                      Canal: {canalLabels[canalFiltro] || canalFiltro}
                      <button onClick={() => setCanalFiltro("todos")} className="ml-1 rounded-full hover:bg-background/60 p-0.5"><X className="h-3 w-3" /></button>
                    </Badge>
                  )}
                  {consolidado && (
                    <Badge variant="default" className="gap-1 pr-1">
                      Consolidado · {unidadeIds.length}
                      <button onClick={() => setConsolidado(false)} className="ml-1 rounded-full hover:bg-background/30 p-0.5"><X className="h-3 w-3" /></button>
                    </Badge>
                  )}
                </div>
              )}
            </div>
          );
        })()}




        {/* Métricas */}
        <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-5">
          <Card><CardContent className="flex items-center gap-3 p-3 md:p-4"><div className="status-card-icon status-card-icon-primary"><DollarSign /></div><div className="min-w-0"><p className="text-xs text-muted-foreground">Total Vendas</p><p className="text-lg font-bold truncate">{formatCurrency(metricas.totalVendas)}</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-3 md:p-4"><div className="status-card-icon status-card-icon-info"><ShoppingCart /></div><div className="min-w-0"><p className="text-xs text-muted-foreground">Total Pedidos</p><p className="text-lg font-bold">{metricas.totalPedidos}</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-3 md:p-4"><div className="status-card-icon status-card-icon-success"><TrendingUp /></div><div className="min-w-0"><p className="text-xs text-muted-foreground">Entregues</p><p className="text-lg font-bold text-success">{metricas.pedidosEntregues}</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-3 md:p-4"><div className="status-card-icon status-card-icon-destructive"><Calendar /></div><div className="min-w-0"><p className="text-xs text-muted-foreground">Cancelados</p><p className="text-lg font-bold text-destructive">{metricas.pedidosCancelados}</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-3 md:p-4"><div className="status-card-icon status-card-icon-warning"><Download /></div><div className="min-w-0"><p className="text-xs text-muted-foreground">Ticket Médio</p><p className="text-lg font-bold truncate">{formatCurrency(metricas.ticketMedio)}</p></div></CardContent></Card>
        </div>

        {/* Tabs: Pedidos / Entregador / Canal */}
        <Tabs defaultValue="pedidos" className="space-y-4">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/60 p-1">
            <TabsTrigger value="pedidos" className="flex-1 min-w-[80px] gap-1 sm:gap-2 text-xs sm:text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"><ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden xs:inline">Pedidos</span><span className="xs:hidden">Ped.</span></TabsTrigger>
            <TabsTrigger value="produtos" className="flex-1 min-w-[80px] gap-1 sm:gap-2 text-xs sm:text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"><Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Produtos</span><span className="sm:hidden">Prod.</span></TabsTrigger>
            <TabsTrigger value="entregador" className="flex-1 min-w-[80px] gap-1 sm:gap-2 text-xs sm:text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"><Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Por Entregador</span><span className="sm:hidden">Entreg.</span></TabsTrigger>
            <TabsTrigger value="entregador-canal" className="flex-1 min-w-[80px] gap-1 sm:gap-2 text-xs sm:text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"><FileSpreadsheet className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Entregador x Canal</span><span className="sm:hidden">E×C</span></TabsTrigger>
            <TabsTrigger value="canal" className="flex-1 min-w-[80px] gap-1 sm:gap-2 text-xs sm:text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"><Megaphone className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Por Canal</span><span className="sm:hidden">Canal</span></TabsTrigger>
            <TabsTrigger value="pagamento" className="flex-1 min-w-[80px] gap-1 sm:gap-2 text-xs sm:text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"><CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Pagamento</span><span className="sm:hidden">Pgto.</span></TabsTrigger>
            <TabsTrigger value="dia" className="flex-1 min-w-[80px] gap-1 sm:gap-2 text-xs sm:text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"><CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Evolução</span><span className="sm:hidden">Dia</span></TabsTrigger>
            <TabsTrigger value="produtos-vendidos" className="flex-1 min-w-[80px] gap-1 sm:gap-2 text-xs sm:text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"><PackageSearch className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Produtos Vendidos</span><span className="sm:hidden">Vendidos</span></TabsTrigger>
          </TabsList>

          {/* Tab Pedidos */}
          <TabsContent value="pedidos">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                  <span>Pedidos do Período</span>
                  <Badge variant="secondary">{pedidosFiltrados.length} registros</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                {isLoading ? (
                  <div className="space-y-3 p-4">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : pedidosFiltrados.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado no período.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[480px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Data</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="hidden sm:table-cell">Entregador</TableHead>
                          <TableHead className="hidden md:table-cell">Canal</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="hidden sm:table-cell">Pgto</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pedidosFiltrados.slice(0, 50).map((pedido) => (
                          <TableRow key={pedido.id}>
                            <TableCell className="text-xs">{pedido.data_entrega ? format(parseISO(`${pedido.data_entrega}T12:00:00`), "dd/MM", { locale: ptBR }) : format(parseISO(pedido.created_at), "dd/MM HH:mm", { locale: ptBR })}</TableCell>
                            <TableCell className="text-sm">
                              <div className="font-medium">{pedido.clientes?.nome || "Não identificado"}</div>
                              <div className="sm:hidden text-xs text-muted-foreground mt-0.5">{pedido.entregadores?.nome || "—"}</div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-xs">{pedido.entregadores?.nome || "-"}</TableCell>
                            <TableCell className="hidden md:table-cell text-xs">
                              <Popover open={!consolidado && editandoCanalId === pedido.id} onOpenChange={(open) => !consolidado && setEditandoCanalId(open ? pedido.id : null)}>
                                <PopoverTrigger asChild>
                                  <button
                                    disabled={consolidado}
                                    title={consolidado ? "Selecione uma unidade específica para editar" : undefined}
                                    className="inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Badge variant="outline" className="text-xs">{canalLabels[pedido.canal_venda || ""] || pedido.canal_venda || "-"}</Badge>
                                    {!consolidado && <Pencil className="h-3 w-3 text-muted-foreground" />}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-2 bg-popover border border-border shadow-lg z-50" align="start">
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground px-1 mb-2">Trocar canal:</p>
                                    {canaisVenda.map((c) => (
                                      <button
                                        key={c.id}
                                        className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors ${pedido.canal_venda === c.nome ? "bg-accent font-medium" : ""}`}
                                        onClick={() => alterarCanalVenda(pedido.id, c.nome)}
                                      >
                                        {canalLabels[c.nome] || c.nome}
                                      </button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            <TableCell className="font-semibold text-xs text-right whitespace-nowrap">{formatCurrency(pedido.valor_total || 0)}</TableCell>
                            <TableCell className="hidden sm:table-cell"><Badge variant="outline" className="text-xs">{pedido.forma_pagamento || "-"}</Badge></TableCell>
                            <TableCell><Badge variant={statusConfig[pedido.status || "pendente"]?.variant || "secondary"} className="text-xs whitespace-nowrap">{statusConfig[pedido.status || "pendente"]?.label || pedido.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {pedidosFiltrados.length > 50 && (
                  <p className="text-center text-sm text-muted-foreground mt-4 pb-4">Mostrando 50 de {pedidosFiltrados.length} registros. Exporte para ver todos.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Por Entregador */}
          <TabsContent value="entregador">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-5 w-5" />Faturamento por Entregador</CardTitle></CardHeader>
                <CardContent>
                  {dadosPorEntregador.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Sem dados no período.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={dadosPorEntregador.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} className="text-xs" />
                        <YAxis type="category" dataKey="nome" width={90} className="text-xs" tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} labelStyle={{ fontWeight: "bold" }} />
                        <Bar dataKey="total" name="Faturamento" radius={[0, 4, 4, 0]}>
                          {dadosPorEntregador.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Detalhamento por Entregador</CardTitle></CardHeader>
                <CardContent className="p-0 sm:p-6 sm:pt-0">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[320px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Entregador</TableHead>
                          <TableHead className="text-right w-14">Qtd</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">Ticket Médio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dadosPorEntregador.map((e, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium text-sm">{e.nome}</TableCell>
                            <TableCell className="text-right">{e.qtd}</TableCell>
                            <TableCell className="text-right font-semibold whitespace-nowrap">{formatCurrency(e.total)}</TableCell>
                            <TableCell className="text-right hidden sm:table-cell whitespace-nowrap">{formatCurrency(e.qtd > 0 ? e.total / e.qtd : 0)}</TableCell>
                          </TableRow>
                        ))}
                        {dadosPorEntregador.length > 0 && (
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell>Total</TableCell>
                            <TableCell className="text-right">{dadosPorEntregador.reduce((s, e) => s + e.qtd, 0)}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{formatCurrency(dadosPorEntregador.reduce((s, e) => s + e.total, 0))}</TableCell>
                            <TableCell className="hidden sm:table-cell text-right">—</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Entregador x Canal */}
          <TabsContent value="entregador-canal">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSpreadsheet className="h-5 w-5" />Quantidade por Entregador e Canal de Venda
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                {dadosEntregadorCanal.entregadores.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Sem dados no período.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[400px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-background z-10 min-w-[120px]">Entregador</TableHead>
                          {dadosEntregadorCanal.canais.map(canal => (
                            <TableHead key={canal} className="text-center whitespace-nowrap">{canalLabels[canal] || canal}</TableHead>
                          ))}
                          <TableHead className="text-center font-bold whitespace-nowrap">Total Qtd</TableHead>
                          <TableHead className="text-right font-bold whitespace-nowrap">Total R$</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dadosEntregadorCanal.entregadores.map((ent, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium sticky left-0 bg-background z-10 text-sm">{ent.nome}</TableCell>
                            {dadosEntregadorCanal.canais.map(canal => (
                              <TableCell key={canal} className="text-center">{ent.canais[canal]?.qtd || 0}</TableCell>
                            ))}
                            <TableCell className="text-center font-bold">{ent.totalQtd}</TableCell>
                            <TableCell className="text-right font-semibold whitespace-nowrap">{formatCurrency(ent.totalValor)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell className="sticky left-0 bg-muted/50 z-10">Total</TableCell>
                          {dadosEntregadorCanal.canais.map(canal => {
                            const totalCanal = dadosEntregadorCanal.entregadores.reduce((s, e) => s + (e.canais[canal]?.qtd || 0), 0);
                            return <TableCell key={canal} className="text-center">{totalCanal}</TableCell>;
                          })}
                          <TableCell className="text-center">{dadosEntregadorCanal.entregadores.reduce((s, e) => s + e.totalQtd, 0)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">{formatCurrency(dadosEntregadorCanal.entregadores.reduce((s, e) => s + e.totalValor, 0))}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Por Canal */}
          <TabsContent value="canal">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-5 w-5" />Distribuição por Canal</CardTitle></CardHeader>
                <CardContent>
                  {dadosPorCanal.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Sem dados no período.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={dadosPorCanal} dataKey="total" nameKey="label" cx="50%" cy="50%" outerRadius={90} label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}>
                          {dadosPorCanal.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Detalhamento por Canal</CardTitle></CardHeader>
                <CardContent className="p-0 sm:p-6 sm:pt-0">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[320px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Canal</TableHead>
                          <TableHead className="text-right w-14">Qtd</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">Ticket</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dadosPorCanal.map((c, i) => {
                          const totalGeral = dadosPorCanal.reduce((s, x) => s + x.total, 0);
                          return (
                            <TableRow key={i}>
                              <TableCell className="font-medium text-sm">{c.label}</TableCell>
                              <TableCell className="text-right">{c.qtd}</TableCell>
                              <TableCell className="text-right font-semibold whitespace-nowrap">{formatCurrency(c.total)}</TableCell>
                              <TableCell className="text-right hidden sm:table-cell whitespace-nowrap">{formatCurrency(c.qtd > 0 ? c.total / c.qtd : 0)}</TableCell>
                              <TableCell className="text-right hidden sm:table-cell">{totalGeral > 0 ? ((c.total / totalGeral) * 100).toFixed(1) : 0}%</TableCell>
                            </TableRow>
                          );
                        })}
                        {dadosPorCanal.length > 0 && (
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell>Total</TableCell>
                            <TableCell className="text-right">{dadosPorCanal.reduce((s, c) => s + c.qtd, 0)}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{formatCurrency(dadosPorCanal.reduce((s, c) => s + c.total, 0))}</TableCell>
                            <TableCell className="hidden sm:table-cell text-right">—</TableCell>
                            <TableCell className="hidden sm:table-cell text-right">100%</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Produtos */}
          <TabsContent value="produtos">
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 mb-4">
              <Card><CardContent className="flex items-center gap-3 p-3"><div className="status-card-icon status-card-icon-primary"><Package /></div><div className="min-w-0"><p className="text-xs text-muted-foreground">Unidades vendidas</p><p className="text-lg font-bold">{dadosPorProduto.reduce((s, p) => s + p.qtd, 0)}</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-3 p-3"><div className="status-card-icon status-card-icon-info"><FileSpreadsheet /></div><div className="min-w-0"><p className="text-xs text-muted-foreground">Mix de produtos</p><p className="text-lg font-bold">{dadosPorProduto.length}</p></div></CardContent></Card>
              <Card className="col-span-2 md:col-span-1"><CardContent className="flex items-center gap-3 p-3"><div className="status-card-icon status-card-icon-success"><DollarSign /></div><div className="min-w-0"><p className="text-xs text-muted-foreground">Faturamento</p><p className="text-lg font-bold truncate">{formatCurrency(dadosPorProduto.reduce((s, p) => s + p.faturamento, 0))}</p></div></CardContent></Card>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="venda-card">
                <VendaSectionHeader tone="info" icon={<Package className="h-5 w-5" />} title="Top 10 — Quantidade" />
                <CardContent>
                  {dadosPorProduto.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Sem dados no período.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={dadosPorProduto.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" className="text-xs" />
                        <YAxis type="category" dataKey="nome" width={110} className="text-xs" tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number, n) => n === "qtd" ? [`${v} un.`, "Quantidade"] : formatCurrency(v)} />
                        <Bar dataKey="qtd" name="Quantidade" radius={[0, 4, 4, 0]}>
                          {dadosPorProduto.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="venda-card">
                <VendaSectionHeader tone="primary" icon={<FileSpreadsheet className="h-5 w-5" />} title="Detalhamento por Produto" />
                <CardContent className="p-0 sm:p-6 sm:pt-0">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[360px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right w-16">Qtd</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">Pedidos</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dadosPorProduto.map((p, i) => {
                          const totalFat = dadosPorProduto.reduce((s, x) => s + x.faturamento, 0);
                          return (
                            <TableRow key={i}>
                              <TableCell className="font-medium text-sm">{p.nome}</TableCell>
                              <TableCell className="text-right font-semibold">{p.qtd}</TableCell>
                              <TableCell className="text-right hidden sm:table-cell">{p.pedidosCount}</TableCell>
                              <TableCell className="text-right whitespace-nowrap">{formatCurrency(p.faturamento)}</TableCell>
                              <TableCell className="text-right hidden sm:table-cell">{totalFat > 0 ? ((p.faturamento / totalFat) * 100).toFixed(1) : 0}%</TableCell>
                            </TableRow>
                          );
                        })}
                        {dadosPorProduto.length > 0 && (
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell>Total</TableCell>
                            <TableCell className="text-right">{dadosPorProduto.reduce((s, p) => s + p.qtd, 0)}</TableCell>
                            <TableCell className="hidden sm:table-cell text-right">—</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{formatCurrency(dadosPorProduto.reduce((s, p) => s + p.faturamento, 0))}</TableCell>
                            <TableCell className="hidden sm:table-cell text-right">100%</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Comparativo Mensal */}
            <Card className="venda-card mt-4">
              <VendaSectionHeader
                tone="success"
                icon={<CalendarDays className="h-5 w-5" />}
                title="Comparativo Mensal por Produto"
                action={
                  <Select value={metricaComparativo} onValueChange={(v: "qtd" | "faturamento") => setMetricaComparativo(v)}>
                    <SelectTrigger className="h-9 w-[150px] bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="qtd">Quantidade</SelectItem>
                      <SelectItem value="faturamento">Faturamento</SelectItem>
                    </SelectContent>
                  </Select>
                }
              />
              <div className="px-4 pt-3 sm:px-5">
                <p className="text-xs text-muted-foreground">
                  Mostra os meses cobertos pelo período selecionado no topo. Clique em qualquer célula para lançar vendas históricas — o total mostra <span className="text-primary font-medium">sistema + manual</span>.
                </p>
              </div>

              <CardContent className="space-y-4">
                {periodosSelecionados.length > 0 && (
                  <div className="flex flex-wrap gap-2 rounded-xl border bg-muted/30 p-3">
                    {periodosSelecionados.map((p) => (
                      <span
                        key={periodoKey(p)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium shadow-sm"
                      >
                        <span className="flex items-center justify-center size-4 rounded-full bg-primary-foreground text-primary">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                        {formatPeriodoCurto(p)}
                      </span>
                    ))}
                  </div>
                )}


                {/* Tabela comparativa */}
                <div className="overflow-x-auto">
                  {dadosComparativoMensal.linhas.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Sem dados no período selecionado.</p>
                  ) : periodosSelecionados.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Selecione um período válido.</p>
                  ) : (
                    <Table className="min-w-[640px] tabular-nums [&_th]:text-center [&_td]:text-center border-collapse">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[160px] max-w-[220px] text-center bg-muted/50 font-semibold">Produto</TableHead>
                          {periodosSelecionados.map((p, idx) => (
                            <TableHead
                              key={periodoKey(p)}
                              className={cn(
                                "whitespace-nowrap w-[92px] font-semibold",
                                idx % 2 === 0 ? "bg-primary/10 text-primary" : "bg-muted/40"
                              )}
                            >
                              {formatPeriodoCurto(p)}
                            </TableHead>
                          ))}
                          <TableHead className="whitespace-nowrap w-[110px] border-l border-border/60 bg-accent/30 font-semibold">Média</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dadosComparativoMensal.linhas.map((l, i) => (
                          <TableRow key={l.produto_id || `n-${i}`}>
                            <TableCell className="font-medium text-sm truncate max-w-[220px] text-center bg-muted/20">{l.nome}</TableCell>
                            {periodosSelecionados.map((p, idx) => (
                              <TableCell
                                key={periodoKey(p)}
                                className={cn(
                                  "whitespace-nowrap w-[92px] px-2 py-2",
                                  idx % 2 === 0 ? "bg-primary/5" : ""
                                )}
                              >
                                <CelulaMesEditavel
                                  valor={l.valores[idx]}
                                  manual={l.manual[idx]}
                                  metrica={metricaComparativo}
                                  editavel={!!l.produto_id && !consolidado}
                                  onSalvar={(novo) => l.produto_id && salvarVendaManual(l.produto_id, idx, novo)}
                                />
                              </TableCell>
                            ))}
                            <TableCell className="font-semibold text-primary whitespace-nowrap w-[110px] border-l border-border/60 bg-accent/20">
                              {metricaComparativo === "qtd"
                                ? l.media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
                                : formatCurrency(l.media)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold">
                          <TableCell className="bg-muted/70 font-bold text-center">Total</TableCell>
                          {periodosSelecionados.map((p, idx) => (
                            <TableCell
                              key={periodoKey(p)}
                              className={cn(
                                "whitespace-nowrap w-[92px] font-bold",
                                idx % 2 === 0 ? "bg-primary/15" : "bg-muted/60"
                              )}
                            >
                              {metricaComparativo === "qtd"
                                ? Math.round(dadosComparativoMensal.totaisPorPeriodo[idx]).toLocaleString("pt-BR")
                                : formatCurrency(dadosComparativoMensal.totaisPorPeriodo[idx])}
                            </TableCell>
                          ))}
                          <TableCell className="text-primary whitespace-nowrap w-[110px] border-l border-border/60 bg-accent/40 font-bold">
                            {metricaComparativo === "qtd"
                              ? dadosComparativoMensal.mediaTotal.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
                              : formatCurrency(dadosComparativoMensal.mediaTotal)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pagamento">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-5 w-5" />Distribuição por Forma de Pagamento</CardTitle></CardHeader>
                <CardContent>
                  {dadosPorFormaPagamento.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Sem dados no período.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={dadosPorFormaPagamento} dataKey="total" nameKey="label" cx="50%" cy="50%" outerRadius={90} label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}>
                          {dadosPorFormaPagamento.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Detalhamento por Forma</CardTitle></CardHeader>
                <CardContent className="p-0 sm:p-6 sm:pt-0">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[320px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Forma</TableHead>
                          <TableHead className="text-right w-14">Qtd</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">Ticket</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dadosPorFormaPagamento.map((f, i) => {
                          const totalGeral = dadosPorFormaPagamento.reduce((s, x) => s + x.total, 0);
                          return (
                            <TableRow key={i}>
                              <TableCell className="font-medium text-sm">{f.label}</TableCell>
                              <TableCell className="text-right">{f.qtd}</TableCell>
                              <TableCell className="text-right font-semibold whitespace-nowrap">{formatCurrency(f.total)}</TableCell>
                              <TableCell className="text-right hidden sm:table-cell whitespace-nowrap">{formatCurrency(f.qtd > 0 ? f.total / f.qtd : 0)}</TableCell>
                              <TableCell className="text-right hidden sm:table-cell">{totalGeral > 0 ? ((f.total / totalGeral) * 100).toFixed(1) : 0}%</TableCell>
                            </TableRow>
                          );
                        })}
                        {dadosPorFormaPagamento.length > 0 && (
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell>Total</TableCell>
                            <TableCell className="text-right">{dadosPorFormaPagamento.reduce((s, c) => s + c.qtd, 0)}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{formatCurrency(dadosPorFormaPagamento.reduce((s, c) => s + c.total, 0))}</TableCell>
                            <TableCell className="hidden sm:table-cell text-right">—</TableCell>
                            <TableCell className="hidden sm:table-cell text-right">100%</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Evolução Diária */}
          <TabsContent value="dia">
            {(() => {
              const totalDias = dadosPorDia.length;
              const totalFat = dadosPorDia.reduce((s, d) => s + d.total, 0);
              const media = totalDias > 0 ? totalFat / totalDias : 0;
              const melhor = [...dadosPorDia].sort((a, b) => b.total - a.total)[0];
              const pior = [...dadosPorDia].filter(d => d.total > 0).sort((a, b) => a.total - b.total)[0];
              return (
                <>
                  <div className="grid gap-3 grid-cols-2 md:grid-cols-3 mb-4">
                    <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Média diária</p><p className="text-lg font-bold truncate">{formatCurrency(media)}</p></CardContent></Card>
                    <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Melhor dia</p><p className="text-lg font-bold text-success truncate">{melhor ? `${melhor.label} — ${formatCurrency(melhor.total)}` : "—"}</p></CardContent></Card>
                    <Card className="col-span-2 md:col-span-1"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Pior dia</p><p className="text-lg font-bold text-destructive truncate">{pior ? `${pior.label} — ${formatCurrency(pior.total)}` : "—"}</p></CardContent></Card>
                  </div>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-5 w-5" />Evolução de Vendas no Período</CardTitle></CardHeader>
                    <CardContent>
                      {dadosPorDia.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground">Sem dados no período.</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={320}>
                          <LineChart data={dadosPorDia}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="label" className="text-xs" />
                            <YAxis className="text-xs" tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
                            <Tooltip formatter={(v: number, n) => n === "total" ? formatCurrency(v) : [`${v} pedidos`, "Pedidos"]} />
                            <Legend />
                            <Line type="monotone" dataKey="total" name="Faturamento" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="qtd" name="Pedidos" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} yAxisId="right" />
                            <YAxis yAxisId="right" orientation="right" className="text-xs" />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </TabsContent>

          {/* Tab Produtos Vendidos */}
          <TabsContent value="produtos-vendidos">
            <ProdutosVendidosTab
              pedidos={pedidos}
              unidadeId={unidadeAtual?.id}
              unidadeIds={unidadeIds}
              consolidado={consolidado}
              dataInicio={dataInicio}
              dataFim={dataFim}
              onPeriodoChange={(ini, fim) => { setDataInicio(ini); setDataFim(fim); }}
            />
          </TabsContent>
        </Tabs>

        {/* Import Review Dialog */}
        <ImportReviewDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          title="Revisar Pedidos Importados"
          description="Revise e corrija os dados extraídos antes de importar para o sistema."
          items={importItems}
          columns={[
            { key: "data", label: "Data", type: "date", width: "120px" },
            { key: "cliente_nome", label: "Cliente", width: "150px" },
            { key: "itens_desc", label: "Itens", width: "180px" },
            { key: "valor_total", label: "Valor (R$)", type: "number", width: "100px" },
            { key: "forma_pagamento", label: "Pagamento", width: "120px" },
            { key: "observacoes", label: "Obs", width: "120px" },
          ]}
          onUpdateItem={(index, field, value) => {
            setImportItems(prev => prev.map((it, i) => i === index ? { ...it, [field]: value } : it));
          }}
          onRemoveItem={(index) => {
            setImportItems(prev => prev.filter((_, i) => i !== index));
          }}
          onConfirm={salvarImportacao}
          saving={savingImport}
        />
      </div>
    </MainLayout>
  );
}

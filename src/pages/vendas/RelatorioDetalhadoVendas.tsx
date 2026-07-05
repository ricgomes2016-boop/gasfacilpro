import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Link } from "react-router-dom";
import { AlertTriangle, Brain, Download, Filter, RefreshCw, Search, TrendingUp, X, Trophy, Medal, Crown, UserRound, ShoppingCart } from "lucide-react";
import * as XLSX from "xlsx";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useToast } from "@/hooks/use-toast";

interface PedidoRelatorio {
  id: string;
  data_entrega: string | null;
  created_at: string;
  valor_total: number | null;
  status: string | null;
  canal_venda: string | null;
  entregadores: { nome: string } | null;
  pedido_itens: Array<{
    quantidade: number;
    preco_unitario: number;
    produtos: { id: string; nome: string; preco_custo: number | null } | null;
  }>;
}

type LinhaDetalhe = {
  entregador: string;
  produto: string;
  canal: string;
  qtd: number;
  qtdComCusto: number;
  custoMedio: number;
  vendaMedia: number;
  totalCusto: number;
  totalVenda: number;
  vendaSemCusto: number;
  lucro: number;
  margem: number;
  temCustoIncompleto: boolean;
};

type ResumoEntregador = LinhaDetalhe & {
  participacao: number;
  posicao: number;
};

const canalLabels: Record<string, string> = {
  telefone: "Telefone",
  whatsapp: "WhatsApp",
  portaria: "Portaria",
  balcao: "Balcão",
  entregador: "Entregador",
  app_cliente: "App Cliente",
  parceiro: "Parceiro",
  importado: "Importado",
  outros: "Outros",
};

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const dataPedido = (pedido: PedidoRelatorio) => pedido.data_entrega?.slice(0, 10) || pedido.created_at?.slice(0, 10) || "";

function MultiSelectFiltro({ titulo, opcoes, selecionados, onChange }: {
  titulo: string;
  opcoes: string[];
  selecionados: string[];
  onChange: (value: string[]) => void;
}) {
  const toggle = (opcao: string) => {
    onChange(selecionados.includes(opcao) ? selecionados.filter((v) => v !== opcao) : [...selecionados, opcao]);
  };
  const label = selecionados.length === 0 ? "Todos" : selecionados.length === 1 ? selecionados[0] : `${selecionados.length} selecionados`;

  return (
    <div className="space-y-1 min-w-0">
      <Label className="text-xs">{titulo}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full h-10 justify-between font-normal min-w-0">
            <span className="truncate">{label}</span>
            {selecionados.length > 0 && <Badge variant="secondary" className="ml-2 shrink-0">{selecionados.length}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-2" align="start">
          <div className="flex items-center justify-between gap-2 px-1 pb-2 border-b">
            <span className="text-sm font-medium">{titulo}</span>
            {selecionados.length > 0 && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onChange([])}>Limpar</Button>}
          </div>
          <div className="max-h-64 overflow-y-auto py-1 space-y-1">
            {opcoes.length === 0 ? <p className="text-sm text-muted-foreground px-2 py-3">Sem opções</p> : opcoes.map((opcao) => (
              <label key={opcao} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted cursor-pointer">
                <input type="checkbox" checked={selecionados.includes(opcao)} onChange={() => toggle(opcao)} className="h-4 w-4" />
                <span className="truncate">{opcao}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function RelatorioDetalhadoVendas() {
  const { unidadeAtual } = useUnidade();
  const { toast } = useToast();
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(hoje), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(endOfMonth(hoje), "yyyy-MM-dd"));
  const [entregadoresSelecionados, setEntregadoresSelecionados] = useState<string[]>([]);
  const [canaisSelecionados, setCanaisSelecionados] = useState<string[]>([]);
  const [produtosSelecionados, setProdutosSelecionados] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [entregadorAberto, setEntregadorAberto] = useState<ResumoEntregador | null>(null);

  const { data: pedidos = [], isLoading, refetch } = useQuery({
    queryKey: ["relatorio-vendas-unificado", unidadeAtual?.id, dataInicio, dataFim],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      const inicioCriacao = `${dataInicio}T00:00:00`;
      const fimCriacao = `${dataFim}T23:59:59`;
      const { data, error } = await supabase
        .from("pedidos")
        .select(`
          id, data_entrega, created_at, valor_total, status, canal_venda,
          entregadores (nome),
          pedido_itens (quantidade, preco_unitario, produtos (id, nome, preco_custo))
        `)
        .eq("unidade_id", unidadeAtual!.id)
        .neq("status", "cancelado")
        .or(`and(data_entrega.gte.${dataInicio},data_entrega.lte.${dataFim}),and(created_at.gte.${inicioCriacao},created_at.lte.${fimCriacao})`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data || []) as PedidoRelatorio[]).filter((pedido) => {
        const d = dataPedido(pedido);
        return d >= dataInicio && d <= dataFim;
      });
    },
  });

  const novaLinha = (entregador: string, produto: string, canal: string): LinhaDetalhe => ({
    entregador, produto, canal,
    qtd: 0, qtdComCusto: 0, custoMedio: 0, vendaMedia: 0,
    totalCusto: 0, totalVenda: 0, vendaSemCusto: 0, lucro: 0, margem: 0,
    temCustoIncompleto: false,
  });

  const finalizarLinha = (l: LinhaDetalhe): LinhaDetalhe => {
    const lucro = l.totalVenda - l.totalCusto;
    // Margem calculada apenas sobre venda com custo conhecido (evita distorção).
    const baseMargem = l.totalVenda - l.vendaSemCusto;
    return {
      ...l,
      custoMedio: l.qtdComCusto ? l.totalCusto / l.qtdComCusto : 0,
      vendaMedia: l.qtd ? l.totalVenda / l.qtd : 0,
      lucro,
      margem: baseMargem > 0 ? ((baseMargem - l.totalCusto) / baseMargem) * 100 : 0,
      temCustoIncompleto: l.vendaSemCusto > 0,
    };
  };

  const produtosSemCusto = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach((p) => p.pedido_itens?.forEach((i) => {
      const custo = Number(i.produtos?.preco_custo) || 0;
      if (custo <= 0 && i.produtos?.nome) set.add(i.produtos.nome);
    }));
    return Array.from(set).sort();
  }, [pedidos]);

  const linhas = useMemo<LinhaDetalhe[]>(() => {
    const map = new Map<string, LinhaDetalhe>();
    pedidos.forEach((pedido) => {
      const entregador = pedido.entregadores?.nome || "Sem entregador";
      const canalKey = pedido.canal_venda || "outros";
      const canal = canalLabels[canalKey] || canalKey;
      pedido.pedido_itens?.forEach((item) => {
        const produto = item.produtos?.nome || "Produto sem nome";
        const qtd = Number(item.quantidade) || 0;
        const vendaUnit = Number(item.preco_unitario) || 0;
        const custoUnit = Number(item.produtos?.preco_custo) || 0;
        const key = `${entregador}|||${produto}|||${canal}`;
        const atual = map.get(key) || novaLinha(entregador, produto, canal);
        atual.qtd += qtd;
        atual.totalVenda += qtd * vendaUnit;
        if (custoUnit > 0) {
          atual.qtdComCusto += qtd;
          atual.totalCusto += qtd * custoUnit;
        } else {
          atual.vendaSemCusto += qtd * vendaUnit;
        }
        map.set(key, atual);
      });
    });
    return Array.from(map.values()).map(finalizarLinha).sort((a, b) => b.totalVenda - a.totalVenda);
  }, [pedidos]);

  const opcoesEntregador = useMemo(() => Array.from(new Set(linhas.map(l => l.entregador))).sort(), [linhas]);
  const opcoesProduto = useMemo(() => Array.from(new Set(linhas.map(l => l.produto))).sort(), [linhas]);
  const opcoesCanal = useMemo(() => Array.from(new Set(linhas.map(l => l.canal))).sort(), [linhas]);

  const filtradas = useMemo(() => linhas.filter(l => {
    if (entregadoresSelecionados.length > 0 && !entregadoresSelecionados.includes(l.entregador)) return false;
    if (canaisSelecionados.length > 0 && !canaisSelecionados.includes(l.canal)) return false;
    if (produtosSelecionados.length > 0 && !produtosSelecionados.includes(l.produto)) return false;
    if (busca && !`${l.entregador} ${l.produto} ${l.canal}`.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  }), [linhas, entregadoresSelecionados, canaisSelecionados, produtosSelecionados, busca]);

  const resumo = useMemo(() => {
    const qtd = filtradas.reduce((s, l) => s + l.qtd, 0);
    const totalVenda = filtradas.reduce((s, l) => s + l.totalVenda, 0);
    const totalCusto = filtradas.reduce((s, l) => s + l.totalCusto, 0);
    const lucro = totalVenda - totalCusto;
    return { qtd, totalVenda, totalCusto, lucro, vendaMedia: qtd ? totalVenda / qtd : 0, margem: totalVenda ? (lucro / totalVenda) * 100 : 0 };
  }, [filtradas]);

  const agregado = (campo: "entregador" | "produto" | "canal") => {
    const map = new Map<string, LinhaDetalhe>();
    filtradas.forEach(l => {
      const nome = l[campo];
      const atual = map.get(nome) || novaLinha(nome, nome, nome);
      atual.qtd += l.qtd;
      atual.qtdComCusto += l.qtdComCusto;
      atual.totalVenda += l.totalVenda;
      atual.totalCusto += l.totalCusto;
      atual.vendaSemCusto += l.vendaSemCusto;
      map.set(nome, atual);
    });
    return Array.from(map.values()).map(finalizarLinha).sort((a, b) => b.totalVenda - a.totalVenda);
  };

  const rankingEntregadores = useMemo<ResumoEntregador[]>(() => agregado("entregador").map((l, index) => ({
    ...l,
    participacao: resumo.totalVenda ? (l.totalVenda / resumo.totalVenda) * 100 : 0,
    posicao: index + 1,
  })), [filtradas, resumo.totalVenda]);

  const detalhesSelecionado = useMemo(() => {
    if (!entregadorAberto) return null;
    const dados = filtradas.filter(l => l.entregador === entregadorAberto.entregador);
    const porProduto = new Map<string, LinhaDetalhe>();
    const porCanal = new Map<string, LinhaDetalhe>();
    dados.forEach(l => {
      const prod = porProduto.get(l.produto) || novaLinha(l.entregador, l.produto, l.canal);
      prod.qtd += l.qtd; prod.qtdComCusto += l.qtdComCusto; prod.totalCusto += l.totalCusto; prod.totalVenda += l.totalVenda; prod.vendaSemCusto += l.vendaSemCusto;
      porProduto.set(l.produto, prod);
      const canal = porCanal.get(l.canal) || novaLinha(l.entregador, l.produto, l.canal);
      canal.qtd += l.qtd; canal.qtdComCusto += l.qtdComCusto; canal.totalCusto += l.totalCusto; canal.totalVenda += l.totalVenda; canal.vendaSemCusto += l.vendaSemCusto;
      porCanal.set(l.canal, canal);
    });
    const finalizar = (list: LinhaDetalhe[]) => list.map(finalizarLinha).sort((a, b) => b.totalVenda - a.totalVenda);
    return { produtos: finalizar(Array.from(porProduto.values())), canais: finalizar(Array.from(porCanal.values())) };
  }, [entregadorAberto, filtradas]);

  const limparFiltros = () => { setEntregadoresSelecionados([]); setCanaisSelecionados([]); setProdutosSelecionados([]); setBusca(""); };
  const filtrosAtivos = entregadoresSelecionados.length + canaisSelecionados.length + produtosSelecionados.length + (busca ? 1 : 0);

  const insights = useMemo(() => {
    const porEntregador = rankingEntregadores;
    const porProduto = agregado("produto");
    const porCanal = agregado("canal");
    const topEnt = porEntregador[0]; const topProd = porProduto[0]; const topCanal = porCanal[0];
    const baixaMargem = filtradas.filter(l => l.totalVenda > 0 && l.margem < 20).slice(0, 3);
    return [
      topProd ? `Produto destaque: ${topProd.produto} com ${topProd.qtd.toLocaleString("pt-BR")} unidades e ${money(topProd.totalVenda)}.` : null,
      topEnt ? `Entregador destaque: ${topEnt.entregador} faturou ${money(topEnt.totalVenda)} e representa ${pct(topEnt.participacao)} das vendas.` : null,
      topCanal ? `Canal destaque: ${topCanal.canal} representa ${pct(resumo.totalVenda ? topCanal.totalVenda / resumo.totalVenda * 100 : 0)} do faturamento filtrado.` : null,
      baixaMargem.length ? `Atenção: ${baixaMargem.map(l => `${l.produto}/${l.entregador}/${l.canal}`).join("; ")} com margem abaixo de 20%.` : null,
    ].filter(Boolean) as string[];
  }, [filtradas, resumo.totalVenda, rankingEntregadores]);

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtradas.map(l => ({ Entregador: l.entregador, Produto: l.produto, Canal: l.canal, Quantidade: l.qtd, "Custo Médio": l.custoMedio, "Preço Médio Venda": l.vendaMedia, "Total Custo": l.totalCusto, "Total Venda": l.totalVenda, Lucro: l.lucro, "Margem %": l.margem }))), "Detalhado");
    XLSX.writeFile(wb, `relatorio-vendas-${dataInicio}-${dataFim}.xlsx`);
    toast({ title: "Relatório exportado" });
  };

  const TabelaDetalhada = () => (
    <Card><CardHeader className="pb-3"><CardTitle className="text-base">Entregador x Produto x Canal</CardTitle></CardHeader><CardContent className="p-0 sm:p-6 sm:pt-0">
      {isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div> : filtradas.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem dados para os filtros selecionados.</p> : <div className="overflow-x-auto"><Table className="min-w-[980px]"><TableHeader><TableRow><TableHead>Entregador</TableHead><TableHead>Produto</TableHead><TableHead>Canal</TableHead><TableHead className="text-right">Qt</TableHead><TableHead className="text-right">Custo médio</TableHead><TableHead className="text-right">Preço médio</TableHead><TableHead className="text-right">Total venda</TableHead><TableHead className="text-right">Lucro</TableHead><TableHead className="text-right">Margem</TableHead></TableRow></TableHeader><TableBody>{filtradas.map((l, i) => <TableRow key={`det-${i}`}><TableCell className="font-medium whitespace-nowrap">{l.entregador}</TableCell><TableCell>{l.produto}</TableCell><TableCell>{l.canal}</TableCell><TableCell className="text-right">{l.qtd.toLocaleString("pt-BR")}</TableCell><TableCell className="text-right">{l.custoMedio > 0 ? money(l.custoMedio) : <span className="text-xs text-muted-foreground italic">sem custo</span>}</TableCell><TableCell className="text-right">{money(l.vendaMedia)}</TableCell><TableCell className="text-right font-semibold">{money(l.totalVenda)}</TableCell><TableCell className="text-right text-emerald-700">{l.custoMedio > 0 ? money(l.lucro) : "—"}</TableCell><TableCell className="text-right">{l.custoMedio > 0 ? <Badge variant={l.margem < 20 ? "destructive" : "secondary"}>{pct(l.margem)}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell></TableRow>)}<TableRow className="bg-muted/50 font-bold"><TableCell colSpan={3}>Total</TableCell><TableCell className="text-right">{resumo.qtd.toLocaleString("pt-BR")}</TableCell><TableCell className="text-right">—</TableCell><TableCell className="text-right">{money(resumo.vendaMedia)}</TableCell><TableCell className="text-right">{money(resumo.totalVenda)}</TableCell><TableCell className="text-right text-emerald-700">{money(resumo.lucro)}</TableCell><TableCell className="text-right">{pct(resumo.margem)}</TableCell></TableRow></TableBody></Table></div>}
    </CardContent></Card>
  );

  const TabelaResumo = ({ rows, titulo, campo }: { rows: LinhaDetalhe[]; titulo: string; campo: "produto" | "canal" }) => {
    const totQtd = rows.reduce((s, r) => s + r.qtd, 0);
    const totVenda = rows.reduce((s, r) => s + r.totalVenda, 0);
    const totCusto = rows.reduce((s, r) => s + r.totalCusto, 0);
    const totLucro = totVenda - totCusto;
    return (
    <Card><CardHeader className="pb-3"><CardTitle className="text-base">{titulo}</CardTitle></CardHeader><CardContent className="p-0 sm:p-6 sm:pt-0">
      {isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div> : rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem dados.</p> : <div className="overflow-x-auto"><Table className="min-w-[720px]"><TableHeader><TableRow><TableHead>{campo === "produto" ? "Produto" : "Canal"}</TableHead><TableHead className="text-right">Qt</TableHead><TableHead className="text-right">Custo médio</TableHead><TableHead className="text-right">Preço médio</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Lucro</TableHead></TableRow></TableHeader><TableBody>{rows.map((l, i) => <TableRow key={`${campo}-${i}`}><TableCell className="font-medium">{campo === "produto" ? l.produto : l.canal}{l.temCustoIncompleto && <Badge variant="outline" className="ml-2 text-[10px]">custo parcial</Badge>}</TableCell><TableCell className="text-right">{l.qtd}</TableCell><TableCell className="text-right">{l.custoMedio > 0 ? money(l.custoMedio) : <span className="text-xs text-muted-foreground italic">sem custo</span>}</TableCell><TableCell className="text-right">{money(l.vendaMedia)}</TableCell><TableCell className="text-right font-semibold">{money(l.totalVenda)}</TableCell><TableCell className="text-right text-emerald-700">{l.custoMedio > 0 ? money(l.lucro) : "—"}</TableCell></TableRow>)}<TableRow className="bg-muted/50 font-bold"><TableCell>Total</TableCell><TableCell className="text-right">{totQtd.toLocaleString("pt-BR")}</TableCell><TableCell className="text-right">—</TableCell><TableCell className="text-right">{money(totQtd ? totVenda / totQtd : 0)}</TableCell><TableCell className="text-right">{money(totVenda)}</TableCell><TableCell className="text-right text-emerald-700">{money(totLucro)}</TableCell></TableRow></TableBody></Table></div>}
    </CardContent></Card>
    );
  };

  const MedalhaIcon = ({ posicao }: { posicao: number }) => posicao === 1 ? <Crown className="h-5 w-5 text-yellow-500" /> : posicao === 2 ? <Medal className="h-5 w-5 text-slate-400" /> : posicao === 3 ? <Medal className="h-5 w-5 text-amber-600" /> : <span className="text-sm text-muted-foreground">{posicao}º</span>;

  const RankingEntregadores = () => (
    <div className="space-y-4">
      {rankingEntregadores.length > 0 && <div className="grid gap-3 md:grid-cols-3">
        {rankingEntregadores.slice(0, 3).map(e => <Card key={e.entregador} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setEntregadorAberto(e)}><CardContent className="p-4 space-y-3"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><MedalhaIcon posicao={e.posicao} /><p className="font-semibold truncate">{e.entregador}</p></div><Badge variant="secondary">{pct(e.participacao)}</Badge></div><div className="grid grid-cols-2 gap-2 text-sm"><div><p className="text-xs text-muted-foreground">Faturamento</p><p className="font-bold">{money(e.totalVenda)}</p></div><div><p className="text-xs text-muted-foreground">Lucro</p><p className="font-bold text-emerald-700">{money(e.lucro)}</p></div><div><p className="text-xs text-muted-foreground">Quantidade</p><p className="font-semibold">{e.qtd.toLocaleString("pt-BR")}</p></div><div><p className="text-xs text-muted-foreground">Preço médio</p><p className="font-semibold">{money(e.vendaMedia)}</p></div></div><Button variant="outline" size="sm" className="w-full">Ver análise</Button></CardContent></Card>)}
      </div>}
      <Card><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" />Ranking por faturamento</CardTitle></CardHeader><CardContent className="p-0 sm:p-6 sm:pt-0"><div className="overflow-x-auto"><Table className="min-w-[760px]"><TableHeader><TableRow><TableHead className="w-14">#</TableHead><TableHead>Entregador</TableHead><TableHead className="text-right">Qt</TableHead><TableHead className="text-right">Faturamento</TableHead><TableHead className="text-right">Lucro</TableHead><TableHead className="text-right">Participação</TableHead><TableHead className="text-right">Margem</TableHead></TableRow></TableHeader><TableBody>{rankingEntregadores.map(e => <TableRow key={e.entregador} className="cursor-pointer hover:bg-muted/60" onClick={() => setEntregadorAberto(e)}><TableCell><MedalhaIcon posicao={e.posicao} /></TableCell><TableCell className="font-medium">{e.entregador}</TableCell><TableCell className="text-right">{e.qtd.toLocaleString("pt-BR")}</TableCell><TableCell className="text-right font-semibold">{money(e.totalVenda)}</TableCell><TableCell className="text-right text-emerald-700">{money(e.lucro)}</TableCell><TableCell className="text-right">{pct(e.participacao)}</TableCell><TableCell className="text-right"><Badge variant={e.margem < 20 ? "destructive" : "secondary"}>{pct(e.margem)}</Badge></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
    </div>
  );

  return (
    <MainLayout>
      <Header title="Relatório de Vendas" subtitle="Resumo e detalhamento inteligente em uma única tela" />
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 min-w-0">
        <Card><CardContent className="p-3 sm:p-4 space-y-3"><div className="flex items-center justify-between gap-3 flex-wrap"><div className="flex items-center gap-2 text-sm font-medium"><Filter className="h-4 w-4 text-primary" />Filtros inteligentes</div>{filtrosAtivos > 0 && <Button size="sm" variant="ghost" onClick={limparFiltros}><X className="h-4 w-4 mr-1" />Limpar filtros</Button>}</div><div className="grid grid-cols-2 lg:grid-cols-7 gap-2 sm:gap-3"><div className="space-y-1"><Label className="text-xs">Início</Label><Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></div><div className="space-y-1"><Label className="text-xs">Fim</Label><Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} /></div><div className="lg:col-span-1 col-span-2"><MultiSelectFiltro titulo="Entregadores" opcoes={opcoesEntregador} selecionados={entregadoresSelecionados} onChange={setEntregadoresSelecionados} /></div><div className="lg:col-span-1 col-span-2"><MultiSelectFiltro titulo="Produtos" opcoes={opcoesProduto} selecionados={produtosSelecionados} onChange={setProdutosSelecionados} /></div><div className="lg:col-span-1 col-span-2"><MultiSelectFiltro titulo="Canais" opcoes={opcoesCanal} selecionados={canaisSelecionados} onChange={setCanaisSelecionados} /></div><div className="col-span-2 lg:col-span-1 flex items-end"><Button variant="outline" className="w-full" onClick={() => refetch()} disabled={isLoading}><RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />Atualizar</Button></div></div><div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar entregador, produto ou canal..." value={busca} onChange={e => setBusca(e.target.value)} /></div></CardContent></Card>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3"><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Qt vendida</p><p className="text-xl font-bold">{resumo.qtd.toLocaleString("pt-BR")}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total venda</p><p className="text-lg font-bold truncate">{money(resumo.totalVenda)}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Preço médio</p><p className="text-lg font-bold truncate">{money(resumo.vendaMedia)}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Lucro estimado</p><p className="text-lg font-bold text-emerald-700 truncate">{money(resumo.lucro)}</p></CardContent></Card><Card className="col-span-2 lg:col-span-1"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Margem média</p><p className="text-xl font-bold">{pct(resumo.margem)}</p></CardContent></Card></div>
        <div className="flex justify-end"><Button onClick={exportarExcel}><Download className="h-4 w-4 mr-2" />Exportar Excel</Button></div>
        <Tabs defaultValue="geral" className="space-y-3"><TabsList className="w-full h-auto p-1 grid grid-cols-3 md:grid-cols-6"><TabsTrigger value="geral">Geral</TabsTrigger><TabsTrigger value="produto">Produtos</TabsTrigger><TabsTrigger value="entregador">Entregadores</TabsTrigger><TabsTrigger value="canal">Canais</TabsTrigger><TabsTrigger value="detalhado">Detalhado</TabsTrigger><TabsTrigger value="ia">Inteligência</TabsTrigger></TabsList><TabsContent value="geral" className="space-y-3"><div className="grid gap-3 lg:grid-cols-2"><TabelaResumo rows={agregado("produto").slice(0, 10)} titulo="Top produtos" campo="produto" /><TabelaResumo rows={agregado("canal").slice(0, 10)} titulo="Top canais" campo="canal" /></div></TabsContent><TabsContent value="produto"><TabelaResumo rows={agregado("produto")} titulo="Resumo por Produto" campo="produto" /></TabsContent><TabsContent value="entregador"><RankingEntregadores /></TabsContent><TabsContent value="canal"><TabelaResumo rows={agregado("canal")} titulo="Resumo por Canal" campo="canal" /></TabsContent><TabsContent value="detalhado"><TabelaDetalhada /></TabsContent><TabsContent value="ia"><Card className="border-primary/20 bg-primary/5"><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Brain className="h-5 w-5 text-primary" />Insights automáticos</CardTitle></CardHeader><CardContent className="space-y-2">{insights.length ? insights.map((i, idx) => <div key={idx} className="text-sm flex gap-2"><TrendingUp className="h-4 w-4 text-primary mt-0.5" /><span>{i}</span></div>) : <p className="text-sm text-muted-foreground">Sem dados suficientes para gerar insights.</p>}</CardContent></Card></TabsContent></Tabs>
      </div>

      <Dialog open={!!entregadorAberto} onOpenChange={(open) => !open && setEntregadorAberto(null)}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          {entregadorAberto && detalhesSelecionado && <>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" />{entregadorAberto.entregador}</DialogTitle><DialogDescription>Análise comercial no período selecionado</DialogDescription></DialogHeader>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3"><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Quantidade</p><p className="text-xl font-bold">{entregadorAberto.qtd}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Faturamento</p><p className="font-bold">{money(entregadorAberto.totalVenda)}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Lucro</p><p className="font-bold text-emerald-700">{money(entregadorAberto.lucro)}</p></CardContent></Card><Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Margem</p><p className="font-bold">{pct(entregadorAberto.margem)}</p></CardContent></Card><Card className="col-span-2 lg:col-span-1"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Participação</p><p className="font-bold">{pct(entregadorAberto.participacao)}</p></CardContent></Card></div>
            <Tabs defaultValue="produtos" className="space-y-3"><TabsList className="grid grid-cols-3 w-full"><TabsTrigger value="produtos">Produtos</TabsTrigger><TabsTrigger value="canais">Canais</TabsTrigger><TabsTrigger value="financeiro">Financeiro</TabsTrigger></TabsList><TabsContent value="produtos"><TabelaResumo rows={detalhesSelecionado.produtos} titulo="Produtos vendidos" campo="produto" /></TabsContent><TabsContent value="canais"><TabelaResumo rows={detalhesSelecionado.canais} titulo="Canais utilizados" campo="canal" /></TabsContent><TabsContent value="financeiro"><Card><CardContent className="p-4 grid gap-3 sm:grid-cols-2"><div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Venda bruta</span><strong>{money(entregadorAberto.totalVenda)}</strong></div><div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Custo estimado</span><strong>{money(entregadorAberto.totalCusto)}</strong></div><div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Lucro</span><strong className="text-emerald-700">{money(entregadorAberto.lucro)}</strong></div><div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Margem</span><strong>{pct(entregadorAberto.margem)}</strong></div></CardContent></Card></TabsContent></Tabs>
          </>}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

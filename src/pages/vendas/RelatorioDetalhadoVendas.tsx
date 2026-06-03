import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Brain, Download, Filter, RefreshCw, Search, TrendingUp } from "lucide-react";
import * as XLSX from "xlsx";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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
    produtos: { nome: string; custo_medio?: number | null; preco_custo?: number | null; custo?: number | null } | null;
  }>;
}

type LinhaDetalhe = {
  entregador: string;
  produto: string;
  canal: string;
  qtd: number;
  custoMedio: number;
  vendaMedia: number;
  totalCusto: number;
  totalVenda: number;
  lucro: number;
  margem: number;
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

const custoPadrao = (produto: string) => {
  const nome = produto.toLowerCase();
  if (nome.includes("água") || nome.includes("agua")) return 8;
  if (nome.includes("p13") || nome.includes("13 kg")) return 78.84;
  if (nome.includes("p20") || nome.includes("20 kg")) return 135.03;
  if (nome.includes("p45") || nome.includes("45 kg")) return 315.1;
  return 0;
};

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const dataPedido = (pedido: PedidoRelatorio) => {
  if (pedido.data_entrega) return pedido.data_entrega.slice(0, 10);
  if (pedido.created_at) return pedido.created_at.slice(0, 10);
  return "";
};

export default function RelatorioDetalhadoVendas() {
  const { unidadeAtual } = useUnidade();
  const { toast } = useToast();
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(hoje), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(endOfMonth(hoje), "yyyy-MM-dd"));
  const [entregadorFiltro, setEntregadorFiltro] = useState("todos");
  const [canalFiltro, setCanalFiltro] = useState("todos");
  const [produtoFiltro, setProdutoFiltro] = useState("todos");
  const [busca, setBusca] = useState("");

  const { data: pedidos = [], isLoading, refetch } = useQuery({
    queryKey: ["relatorio-detalhado-vendas", unidadeAtual?.id, dataInicio, dataFim],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      const inicioCriacao = `${dataInicio}T00:00:00`;
      const fimCriacao = `${dataFim}T23:59:59`;

      // Busca por data_entrega OU created_at. Isso corrige vendas antigas/retroativas
      // que aparecem no relatório normal, mas não tinham data_entrega preenchida.
      const { data, error } = await supabase
        .from("pedidos")
        .select(`
          id, data_entrega, created_at, valor_total, status, canal_venda,
          entregadores (nome),
          pedido_itens (quantidade, preco_unitario, produtos (nome, custo_medio, preco_custo, custo))
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
        const custoUnit = Number(item.produtos?.custo_medio ?? item.produtos?.preco_custo ?? item.produtos?.custo ?? custoPadrao(produto)) || 0;
        const key = `${entregador}|||${produto}|||${canal}`;
        const atual = map.get(key) || {
          entregador,
          produto,
          canal,
          qtd: 0,
          custoMedio: 0,
          vendaMedia: 0,
          totalCusto: 0,
          totalVenda: 0,
          lucro: 0,
          margem: 0,
        };
        atual.qtd += qtd;
        atual.totalVenda += qtd * vendaUnit;
        atual.totalCusto += qtd * custoUnit;
        map.set(key, atual);
      });
    });

    return Array.from(map.values()).map((l) => {
      const lucro = l.totalVenda - l.totalCusto;
      return {
        ...l,
        custoMedio: l.qtd ? l.totalCusto / l.qtd : 0,
        vendaMedia: l.qtd ? l.totalVenda / l.qtd : 0,
        lucro,
        margem: l.totalVenda ? (lucro / l.totalVenda) * 100 : 0,
      };
    }).sort((a, b) => b.totalVenda - a.totalVenda);
  }, [pedidos]);

  const opcoesEntregador = useMemo(() => Array.from(new Set(linhas.map(l => l.entregador))).sort(), [linhas]);
  const opcoesProduto = useMemo(() => Array.from(new Set(linhas.map(l => l.produto))).sort(), [linhas]);
  const opcoesCanal = useMemo(() => Array.from(new Set(linhas.map(l => l.canal))).sort(), [linhas]);

  const filtradas = useMemo(() => linhas.filter(l => {
    if (entregadorFiltro !== "todos" && l.entregador !== entregadorFiltro) return false;
    if (canalFiltro !== "todos" && l.canal !== canalFiltro) return false;
    if (produtoFiltro !== "todos" && l.produto !== produtoFiltro) return false;
    if (busca && !`${l.entregador} ${l.produto} ${l.canal}`.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  }), [linhas, entregadorFiltro, canalFiltro, produtoFiltro, busca]);

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
      const atual = map.get(nome) || {
        entregador: campo === "entregador" ? nome : "",
        produto: campo === "produto" ? nome : "",
        canal: campo === "canal" ? nome : "",
        qtd: 0,
        custoMedio: 0,
        vendaMedia: 0,
        totalCusto: 0,
        totalVenda: 0,
        lucro: 0,
        margem: 0,
      };
      atual.qtd += l.qtd;
      atual.totalVenda += l.totalVenda;
      atual.totalCusto += l.totalCusto;
      map.set(nome, atual);
    });
    return Array.from(map.values()).map(l => {
      const lucro = l.totalVenda - l.totalCusto;
      return { ...l, custoMedio: l.qtd ? l.totalCusto / l.qtd : 0, vendaMedia: l.qtd ? l.totalVenda / l.qtd : 0, lucro, margem: l.totalVenda ? lucro / l.totalVenda * 100 : 0 };
    }).sort((a, b) => b.totalVenda - a.totalVenda);
  };

  const insights = useMemo(() => {
    const topEnt = agregado("entregador")[0];
    const topProd = agregado("produto")[0];
    const topCanal = agregado("canal")[0];
    const baixaMargem = filtradas.filter(l => l.totalVenda > 0 && l.margem < 20).slice(0, 2);
    return [
      topProd ? `Produto destaque: ${topProd.produto} com ${topProd.qtd.toLocaleString("pt-BR")} unidades e ${money(topProd.totalVenda)}.` : null,
      topEnt ? `Entregador destaque: ${topEnt.entregador} faturou ${money(topEnt.totalVenda)} com margem de ${pct(topEnt.margem)}.` : null,
      topCanal ? `Canal destaque: ${topCanal.canal} representa ${pct(resumo.totalVenda ? topCanal.totalVenda / resumo.totalVenda * 100 : 0)} do faturamento filtrado.` : null,
      baixaMargem.length ? `Atenção: ${baixaMargem.map(l => `${l.produto}/${l.entregador}`).join(" e ")} com margem abaixo de 20%.` : null,
    ].filter(Boolean) as string[];
  }, [filtradas, resumo.totalVenda]);

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtradas.map(l => ({
      Entregador: l.entregador,
      Produto: l.produto,
      Canal: l.canal,
      Quantidade: l.qtd,
      "Custo Médio": l.custoMedio,
      "Preço Médio Venda": l.vendaMedia,
      "Total Custo": l.totalCusto,
      "Total Venda": l.totalVenda,
      Lucro: l.lucro,
      "Margem %": l.margem,
    }))), "Detalhado");
    XLSX.writeFile(wb, `relatorio-detalhado-vendas-${dataInicio}-${dataFim}.xlsx`);
    toast({ title: "Relatório detalhado exportado" });
  };

  const TabelaDetalhada = () => (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Entregador x Produto x Canal</CardTitle></CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div> : filtradas.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem dados para os filtros selecionados.</p> : (
          <div className="overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader><TableRow><TableHead>Entregador</TableHead><TableHead>Produto</TableHead><TableHead>Canal</TableHead><TableHead className="text-right">Qt</TableHead><TableHead className="text-right">Custo médio</TableHead><TableHead className="text-right">Preço médio</TableHead><TableHead className="text-right">Total venda</TableHead><TableHead className="text-right">Lucro</TableHead><TableHead className="text-right">Margem</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtradas.map((l, i) => <TableRow key={`det-${i}`}><TableCell className="font-medium whitespace-nowrap">{l.entregador}</TableCell><TableCell className="font-medium max-w-[220px] truncate">{l.produto}</TableCell><TableCell>{l.canal}</TableCell><TableCell className="text-right">{l.qtd.toLocaleString("pt-BR")}</TableCell><TableCell className="text-right whitespace-nowrap">{money(l.custoMedio)}</TableCell><TableCell className="text-right whitespace-nowrap">{money(l.vendaMedia)}</TableCell><TableCell className="text-right font-semibold whitespace-nowrap">{money(l.totalVenda)}</TableCell><TableCell className="text-right whitespace-nowrap text-emerald-700">{money(l.lucro)}</TableCell><TableCell className="text-right"><Badge variant={l.margem < 20 ? "destructive" : "secondary"}>{pct(l.margem)}</Badge></TableCell></TableRow>)}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const TabelaResumo = ({ rows, titulo, campo }: { rows: LinhaDetalhe[]; titulo: string; campo: "entregador" | "produto" | "canal" }) => (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div> : rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem dados para os filtros selecionados.</p> : (
          <div className="overflow-x-auto">
            <Table className="min-w-[780px]">
              <TableHeader><TableRow><TableHead>{campo === "entregador" ? "Entregador" : campo === "produto" ? "Produto" : "Canal"}</TableHead><TableHead className="text-right">Qt</TableHead><TableHead className="text-right">Custo médio</TableHead><TableHead className="text-right">Preço médio</TableHead><TableHead className="text-right">Total venda</TableHead><TableHead className="text-right">Lucro</TableHead><TableHead className="text-right">Margem</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((l, i) => {
                  const nome = campo === "entregador" ? l.entregador : campo === "produto" ? l.produto : l.canal;
                  return <TableRow key={`${campo}-${i}`}><TableCell className="font-medium max-w-[220px] truncate">{nome}</TableCell><TableCell className="text-right">{l.qtd.toLocaleString("pt-BR")}</TableCell><TableCell className="text-right whitespace-nowrap">{money(l.custoMedio)}</TableCell><TableCell className="text-right whitespace-nowrap">{money(l.vendaMedia)}</TableCell><TableCell className="text-right font-semibold whitespace-nowrap">{money(l.totalVenda)}</TableCell><TableCell className="text-right whitespace-nowrap text-emerald-700">{money(l.lucro)}</TableCell><TableCell className="text-right"><Badge variant={l.margem < 20 ? "destructive" : "secondary"}>{pct(l.margem)}</Badge></TableCell></TableRow>;
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <MainLayout>
      <Header title="Relatório Detalhado" subtitle="Análise inteligente por entregador, produto, canal, custo e lucro" />
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 min-w-0">
        <Card><CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium"><Filter className="h-4 w-4 text-primary" />Filtros detalhados</div>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-3">
            <div className="space-y-1"><Label className="text-xs">Início</Label><Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Fim</Label><Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Entregador</Label><Select value={entregadorFiltro} onValueChange={setEntregadorFiltro}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{opcoesEntregador.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs">Canal</Label><Select value={canalFiltro} onValueChange={setCanalFiltro}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{opcoesCanal.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs">Produto</Label><Select value={produtoFiltro} onValueChange={setProdutoFiltro}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{opcoesProduto.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex items-end gap-2"><Button variant="outline" className="w-full" onClick={() => refetch()} disabled={isLoading}><RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />Atualizar</Button></div>
          </div>
          <div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar entregador, produto ou canal..." value={busca} onChange={e => setBusca(e.target.value)} /></div>
        </CardContent></Card>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Qt vendida</p><p className="text-xl font-bold">{resumo.qtd.toLocaleString("pt-BR")}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total venda</p><p className="text-lg font-bold truncate">{money(resumo.totalVenda)}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Preço médio</p><p className="text-lg font-bold truncate">{money(resumo.vendaMedia)}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Lucro estimado</p><p className="text-lg font-bold text-emerald-700 truncate">{money(resumo.lucro)}</p></CardContent></Card>
          <Card className="col-span-2 lg:col-span-1"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Margem média</p><p className="text-xl font-bold">{pct(resumo.margem)}</p></CardContent></Card>
        </div>

        <Card className="border-primary/20 bg-primary/5"><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Brain className="h-5 w-5 text-primary" />Insights automáticos</CardTitle></CardHeader><CardContent className="space-y-2">{insights.length ? insights.map((i, idx) => <div key={idx} className="text-sm flex gap-2"><TrendingUp className="h-4 w-4 text-primary mt-0.5" /><span>{i}</span></div>) : <p className="text-sm text-muted-foreground">Sem dados suficientes para gerar insights.</p>}</CardContent></Card>

        <div className="flex justify-end"><Button onClick={exportarExcel}><Download className="h-4 w-4 mr-2" />Exportar Excel</Button></div>

        <Tabs defaultValue="detalhado" className="space-y-3">
          <TabsList className="grid grid-cols-4 w-full h-auto p-1 overflow-x-auto"><TabsTrigger value="detalhado">Detalhado</TabsTrigger><TabsTrigger value="entregador">Entregador</TabsTrigger><TabsTrigger value="produto">Produto</TabsTrigger><TabsTrigger value="canal">Canal</TabsTrigger></TabsList>
          <TabsContent value="detalhado"><TabelaDetalhada /></TabsContent>
          <TabsContent value="entregador"><TabelaResumo rows={agregado("entregador")} titulo="Resumo por Entregador" campo="entregador" /></TabsContent>
          <TabsContent value="produto"><TabelaResumo rows={agregado("produto")} titulo="Resumo por Produto" campo="produto" /></TabsContent>
          <TabsContent value="canal"><TabelaResumo rows={agregado("canal")} titulo="Resumo por Canal" campo="canal" /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

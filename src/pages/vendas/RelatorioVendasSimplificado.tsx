import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { AlertTriangle, Download, FileSpreadsheet, Filter, Megaphone, Package, RefreshCw, Truck, DollarSign, ShoppingCart } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
import { cn } from "@/lib/utils";

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
    produtos: { nome: string; preco_custo: number | null } | null;
  }>;
}

const canalLabels: Record<string, string> = {
  telefone: "Telefone",
  whatsapp: "WhatsApp",
  portaria: "Portaria",
  balcao: "Balcão",
  entregador: "Entregador",
  app_cliente: "App Cliente",
};

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Normaliza canal para evitar duplicidade por espaços/nulos residuais
const normCanal = (c: string | null | undefined) => {
  const trimmed = (c || "").trim();
  return trimmed || "outros";
};

interface LinhaResumo {
  nome: string;
  qtd: number;
  total: number;
  basePrecoMedio: number;
  custoTotal: number;
  temCusto: boolean;
  precoMedio: number;
  custoMedio: number;
  margem: number;
  abaixoCusto: boolean;
  margemBaixa: boolean;
}

type LinhaResumoBase = {
  nome: string;
  qtd: number;
  total: number;
  basePrecoMedio: number;
  custoTotal: number;
  temCusto: boolean;
};

const criarLinhaBase = (nome: string): LinhaResumoBase => ({
  nome,
  qtd: 0,
  total: 0,
  basePrecoMedio: 0,
  custoTotal: 0,
  temCusto: false,
});

const finalizar = (item: LinhaResumoBase): LinhaResumo => {
  const precoMedio = item.qtd ? item.basePrecoMedio / item.qtd : 0;
  const custoMedio = item.qtd && item.temCusto ? item.custoTotal / item.qtd : 0;
  const margem = item.temCusto ? precoMedio - custoMedio : 0;
  const abaixoCusto = item.temCusto && custoMedio > 0 && precoMedio < custoMedio;
  const margemBaixa = item.temCusto && custoMedio > 0 && !abaixoCusto && margem < custoMedio * 0.05;
  return { ...item, precoMedio, custoMedio, margem, abaixoCusto, margemBaixa };
};

export default function RelatorioVendasSimplificado() {
  const { unidadeAtual } = useUnidade();
  const { toast } = useToast();
  const hoje = new Date();
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(hoje), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(endOfMonth(hoje), "yyyy-MM-dd"));
  const [canalFiltro, setCanalFiltro] = useState("todos");
  const [entregadorFiltro, setEntregadorFiltro] = useState("todos");
  const [produtoBusca, setProdutoBusca] = useState("");

  const { data: pedidos = [], isLoading, refetch } = useQuery({
    queryKey: ["relatorio-vendas-simples", unidadeAtual?.id, dataInicio, dataFim],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select(`
          id, data_entrega, created_at, valor_total, status, canal_venda,
          entregadores (nome),
          pedido_itens (quantidade, preco_unitario, produtos (nome, preco_custo))
        `)
        .eq("unidade_id", unidadeAtual!.id)
        .gte("data_entrega", dataInicio)
        .lte("data_entrega", dataFim)
        .neq("status", "cancelado")
        .order("data_entrega", { ascending: false });
      if (error) throw error;
      return (data || []) as PedidoRelatorio[];
    },
  });

  const entregadores = useMemo(() => Array.from(new Set(pedidos.map(p => p.entregadores?.nome || "Sem entregador"))).sort(), [pedidos]);
  const canais = useMemo(() => Array.from(new Set(pedidos.map(p => normCanal(p.canal_venda)))).sort(), [pedidos]);

  const pedidosFiltrados = useMemo(() => pedidos.filter(p => {
    const canalOk = canalFiltro === "todos" || normCanal(p.canal_venda) === canalFiltro;
    const entregadorOk = entregadorFiltro === "todos" || (p.entregadores?.nome || "Sem entregador") === entregadorFiltro;
    return canalOk && entregadorOk;
  }), [pedidos, canalFiltro, entregadorFiltro]);

  const acumular = (map: Map<string, LinhaResumoBase>, chave: string, nomeVisivel: string, qtd: number, preco: number, custo: number | null) => {
    const atual = map.get(chave) || criarLinhaBase(nomeVisivel);
    atual.qtd += qtd;
    atual.total += qtd * preco;
    atual.basePrecoMedio += qtd * preco;
    if (custo != null && custo > 0) {
      atual.custoTotal += qtd * custo;
      atual.temCusto = true;
    }
    map.set(chave, atual);
  };

  const porProduto = useMemo(() => {
    const map = new Map<string, LinhaResumoBase>();
    pedidosFiltrados.forEach(p => p.pedido_itens?.forEach(item => {
      const nome = item.produtos?.nome || "Produto sem nome";
      const qtd = Number(item.quantidade) || 0;
      const preco = Number(item.preco_unitario) || 0;
      const custo = item.produtos?.preco_custo != null ? Number(item.produtos.preco_custo) : null;
      acumular(map, nome, nome, qtd, preco, custo);
    }));
    return Array.from(map.values())
      .map(finalizar)
      .filter(item => item.nome.toLowerCase().includes(produtoBusca.toLowerCase()))
      .sort((a, b) => b.total - a.total);
  }, [pedidosFiltrados, produtoBusca]);

  const porEntregador = useMemo(() => {
    const map = new Map<string, LinhaResumoBase>();
    pedidosFiltrados.forEach(p => {
      const nome = p.entregadores?.nome || "Sem entregador";
      const atual = map.get(nome) || criarLinhaBase(nome);
      // Total do pedido inclui taxas/descontos — usar valor_total para bater com caixa.
      atual.total += Number(p.valor_total) || 0;
      p.pedido_itens?.forEach(item => {
        const qtd = Number(item.quantidade) || 0;
        const preco = Number(item.preco_unitario) || 0;
        const custo = item.produtos?.preco_custo != null ? Number(item.produtos.preco_custo) : null;
        atual.qtd += qtd;
        atual.basePrecoMedio += qtd * preco;
        if (custo != null && custo > 0) {
          atual.custoTotal += qtd * custo;
          atual.temCusto = true;
        }
      });
      map.set(nome, atual);
    });
    return Array.from(map.values()).map(finalizar).sort((a, b) => b.total - a.total);
  }, [pedidosFiltrados]);

  const porCanal = useMemo(() => {
    const map = new Map<string, LinhaResumoBase>();
    pedidosFiltrados.forEach(p => {
      const canal = normCanal(p.canal_venda);
      const nomeVisivel = canalLabels[canal] || canal;
      const atual = map.get(canal) || criarLinhaBase(nomeVisivel);
      atual.total += Number(p.valor_total) || 0;
      p.pedido_itens?.forEach(item => {
        const qtd = Number(item.quantidade) || 0;
        const preco = Number(item.preco_unitario) || 0;
        const custo = item.produtos?.preco_custo != null ? Number(item.produtos.preco_custo) : null;
        atual.qtd += qtd;
        atual.basePrecoMedio += qtd * preco;
        if (custo != null && custo > 0) {
          atual.custoTotal += qtd * custo;
          atual.temCusto = true;
        }
      });
      map.set(canal, atual);
    });
    return Array.from(map.values()).map(finalizar).sort((a, b) => b.total - a.total);
  }, [pedidosFiltrados]);

  const totalQtd = porProduto.reduce((sum, item) => sum + item.qtd, 0);
  // Total vendido = soma de valor_total dos pedidos (bate com caixa/relatórios).
  const totalVenda = pedidosFiltrados.reduce((sum, p) => sum + (Number(p.valor_total) || 0), 0);
  const totalBasePrecoMedio = porProduto.reduce((sum, item) => sum + item.basePrecoMedio, 0);
  const precoMedio = totalQtd ? totalBasePrecoMedio / totalQtd : 0;
  const alertasAbaixoCusto = porProduto.filter(p => p.abaixoCusto).length + porCanal.filter(p => p.abaixoCusto).length + porEntregador.filter(p => p.abaixoCusto).length;

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    const linha = (p: LinhaResumo) => ({ Nome: p.nome, Quantidade: p.qtd, "Preço médio": p.precoMedio, "Custo médio": p.temCusto ? p.custoMedio : null, Margem: p.temCusto ? p.margem : null, Total: p.total, Alerta: p.abaixoCusto ? "ABAIXO DO CUSTO" : p.margemBaixa ? "MARGEM BAIXA" : "" });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porProduto.map(linha)), "Produtos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porEntregador.map(linha)), "Entregadores");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porCanal.map(linha)), "Canais");
    XLSX.writeFile(wb, `vendas-resumo-${dataInicio}-${dataFim}.xlsx`);
    toast({ title: "Excel exportado" });
  };

  const exportarPdf = () => {
    const doc = new jsPDF();
    doc.text("Relatório de Vendas", 14, 16);
    doc.setFontSize(10);
    doc.text(`${format(parseISO(dataInicio), "dd/MM/yyyy")} a ${format(parseISO(dataFim), "dd/MM/yyyy")}`, 14, 23);
    autoTable(doc, {
      startY: 30,
      head: [["Produto", "Qtd", "Preço médio", "Custo médio", "Margem", "Total"]],
      body: porProduto.map(p => [p.nome, String(p.qtd), money(p.precoMedio), p.temCusto ? money(p.custoMedio) : "—", p.temCusto ? money(p.margem) : "—", money(p.total)]),
      didParseCell: (data) => {
        if (data.section === "body") {
          const row = porProduto[data.row.index];
          if (row?.abaixoCusto) data.cell.styles.textColor = [200, 30, 30];
        }
      },
    });
    doc.save(`vendas-resumo-${dataInicio}-${dataFim}.pdf`);
    toast({ title: "PDF exportado" });
  };

  const TabelaResumo = ({ rows, titulo }: { rows: LinhaResumo[]; titulo: string }) => {
    const totQtd = rows.reduce((s, r) => s + r.qtd, 0);
    const totVal = rows.reduce((s, r) => s + r.total, 0);
    const totBasePrecoMedio = rows.reduce((s, r) => s + r.basePrecoMedio, 0);
    const totCusto = rows.reduce((s, r) => s + r.custoTotal, 0);
    const temCustoTotal = rows.some(r => r.temCusto);
    const alertas = rows.filter(r => r.abaixoCusto).length;
    return (
      <Card className="w-full min-w-0">
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{titulo}</CardTitle>
          {alertas > 0 && (
            <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{alertas} abaixo do custo</Badge>
          )}
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem vendas no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{titulo.replace("Vendas por ", "")}</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Preço médio</TableHead>
                    <TableHead className="text-right">Custo médio</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row.nome} className={cn(row.abaixoCusto && "bg-destructive/10")}>
                      <TableCell className="font-medium max-w-[160px] truncate" title={row.nome}>
                        <div className="flex items-center gap-1.5">
                          {row.abaixoCusto && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                          <span className="truncate">{row.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{row.qtd.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className={cn("text-right whitespace-nowrap", row.abaixoCusto && "text-destructive font-semibold")}>{money(row.precoMedio)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap text-muted-foreground">{row.temCusto ? money(row.custoMedio) : "—"}</TableCell>
                      <TableCell className={cn(
                        "text-right whitespace-nowrap font-medium",
                        row.abaixoCusto && "text-destructive",
                        row.margemBaixa && "text-warning dark:text-warning",
                      )}>{row.temCusto ? money(row.margem) : "—"}</TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">{money(row.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{totQtd.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right">{money(totQtd ? totBasePrecoMedio / totQtd : 0)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{temCustoTotal && totQtd ? money(totCusto / totQtd) : "—"}</TableCell>
                    <TableCell className="text-right">{temCustoTotal && totQtd ? money(totBasePrecoMedio / totQtd - totCusto / totQtd) : "—"}</TableCell>
                    <TableCell className="text-right">{money(totVal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <MainLayout>
      <Header title="Relatório de Vendas" subtitle="Visão clara por produto, entregador e canal" />
      <div className="w-full min-w-0 max-w-full p-3 sm:p-6 space-y-4 sm:space-y-6">
        <Card className="border-primary/20">
          <CardContent className="p-3 sm:p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium"><Filter className="h-4 w-4 text-primary" />Filtros</div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
              <div className="space-y-1"><Label className="text-xs">Início</Label><Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-10" /></div>
              <div className="space-y-1"><Label className="text-xs">Fim</Label><Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-10" /></div>
              <div className="space-y-1"><Label className="text-xs">Entregador</Label><Select value={entregadorFiltro} onValueChange={setEntregadorFiltro}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{entregadores.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Canal</Label><Select value={canalFiltro} onValueChange={setCanalFiltro}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{canais.map(c => <SelectItem key={c} value={c}>{canalLabels[c] || c}</SelectItem>)}</SelectContent></Select></div>
              <div className="col-span-2 lg:col-span-1 flex items-end gap-2"><Button variant="outline" className="h-10 flex-1" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-1" />Atualizar</Button></div>
            </div>
          </CardContent>
        </Card>

        {alertasAbaixoCusto > 0 && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-destructive">{alertasAbaixoCusto} linha(s) com preço médio abaixo do custo</p>
                <p className="text-muted-foreground text-xs mt-0.5">Verifique produtos, entregadores ou canais destacados em vermelho nas tabelas abaixo.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card><CardContent className="p-3 sm:p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Package className="h-4 w-4" />Itens vendidos</div><p className="text-xl sm:text-2xl font-bold mt-1">{totalQtd.toLocaleString("pt-BR")}</p></CardContent></Card>
          <Card><CardContent className="p-3 sm:p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="h-4 w-4" />Total vendido</div><p className="text-lg sm:text-2xl font-bold mt-1 truncate">{money(totalVenda)}</p></CardContent></Card>
          <Card><CardContent className="p-3 sm:p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><ShoppingCart className="h-4 w-4" />Pedidos</div><p className="text-xl sm:text-2xl font-bold mt-1">{pedidosFiltrados.length}</p></CardContent></Card>
          <Card><CardContent className="p-3 sm:p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="h-4 w-4" />Preço médio</div><p className="text-lg sm:text-2xl font-bold mt-1 truncate">{money(precoMedio)}</p></CardContent></Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button variant="outline" className="h-10" onClick={exportarPdf}><Download className="h-4 w-4 mr-2" />PDF</Button>
          <Button className="h-10" onClick={exportarExcel}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
        </div>

        <Tabs defaultValue="produto" className="space-y-3">
          <TabsList className="grid grid-cols-3 w-full h-auto p-1">
            <TabsTrigger value="produto" className="gap-1.5 text-xs sm:text-sm"><Package className="h-4 w-4" />Produto</TabsTrigger>
            <TabsTrigger value="entregador" className="gap-1.5 text-xs sm:text-sm"><Truck className="h-4 w-4" />Entregador</TabsTrigger>
            <TabsTrigger value="canal" className="gap-1.5 text-xs sm:text-sm"><Megaphone className="h-4 w-4" />Canal</TabsTrigger>
          </TabsList>
          <TabsContent value="produto" className="space-y-3">
            <Input placeholder="Buscar produto..." value={produtoBusca} onChange={e => setProdutoBusca(e.target.value)} className="h-10 max-w-sm" />
            <TabelaResumo rows={porProduto} titulo="Vendas por Produto" />
          </TabsContent>
          <TabsContent value="entregador"><TabelaResumo rows={porEntregador} titulo="Vendas por Entregador" /></TabsContent>
          <TabsContent value="canal"><TabelaResumo rows={porCanal} titulo="Vendas por Canal" /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

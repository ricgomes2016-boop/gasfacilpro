import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, FileSpreadsheet, Filter, Megaphone, Package, RefreshCw, Truck, DollarSign, ShoppingCart } from "lucide-react";
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
    produtos: { nome: string } | null;
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
          pedido_itens (quantidade, preco_unitario, produtos (nome))
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
  const canais = useMemo(() => Array.from(new Set(pedidos.map(p => p.canal_venda || "outros"))).sort(), [pedidos]);

  const pedidosFiltrados = useMemo(() => pedidos.filter(p => {
    const canalOk = canalFiltro === "todos" || (p.canal_venda || "outros") === canalFiltro;
    const entregadorOk = entregadorFiltro === "todos" || (p.entregadores?.nome || "Sem entregador") === entregadorFiltro;
    return canalOk && entregadorOk;
  }), [pedidos, canalFiltro, entregadorFiltro]);

  const porProduto = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; total: number }>();
    pedidosFiltrados.forEach(p => p.pedido_itens?.forEach(item => {
      const nome = item.produtos?.nome || "Produto sem nome";
      const current = map.get(nome) || { nome, qtd: 0, total: 0 };
      const qtd = Number(item.quantidade) || 0;
      current.qtd += qtd;
      current.total += qtd * (Number(item.preco_unitario) || 0);
      map.set(nome, current);
    }));
    return Array.from(map.values())
      .map(item => ({ ...item, precoMedio: item.qtd ? item.total / item.qtd : 0 }))
      .filter(item => item.nome.toLowerCase().includes(produtoBusca.toLowerCase()))
      .sort((a, b) => b.total - a.total);
  }, [pedidosFiltrados, produtoBusca]);

  const porEntregador = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; total: number }>();
    pedidosFiltrados.forEach(p => {
      const nome = p.entregadores?.nome || "Sem entregador";
      const atual = map.get(nome) || { nome, qtd: 0, total: 0 };
      p.pedido_itens?.forEach(item => {
        const qtd = Number(item.quantidade) || 0;
        atual.qtd += qtd;
        atual.total += qtd * (Number(item.preco_unitario) || 0);
      });
      map.set(nome, atual);
    });
    return Array.from(map.values()).map(item => ({ ...item, precoMedio: item.qtd ? item.total / item.qtd : 0 })).sort((a, b) => b.total - a.total);
  }, [pedidosFiltrados]);

  const porCanal = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; total: number }>();
    pedidosFiltrados.forEach(p => {
      const canal = p.canal_venda || "outros";
      const nome = canalLabels[canal] || canal;
      const atual = map.get(canal) || { nome, qtd: 0, total: 0 };
      p.pedido_itens?.forEach(item => {
        const qtd = Number(item.quantidade) || 0;
        atual.qtd += qtd;
        atual.total += qtd * (Number(item.preco_unitario) || 0);
      });
      map.set(canal, atual);
    });
    return Array.from(map.values()).map(item => ({ ...item, precoMedio: item.qtd ? item.total / item.qtd : 0 })).sort((a, b) => b.total - a.total);
  }, [pedidosFiltrados]);

  const totalQtd = porProduto.reduce((sum, item) => sum + item.qtd, 0);
  const totalVenda = porProduto.reduce((sum, item) => sum + item.total, 0);
  const precoMedio = totalQtd ? totalVenda / totalQtd : 0;

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porProduto.map(p => ({ Produto: p.nome, Quantidade: p.qtd, "Preço Médio": p.precoMedio, Total: p.total }))), "Produtos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porEntregador.map(p => ({ Entregador: p.nome, Quantidade: p.qtd, "Preço Médio": p.precoMedio, Total: p.total }))), "Entregadores");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porCanal.map(p => ({ Canal: p.nome, Quantidade: p.qtd, "Preço Médio": p.precoMedio, Total: p.total }))), "Canais");
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
      head: [["Produto", "Qtd", "Preço médio", "Total"]],
      body: porProduto.map(p => [p.nome, String(p.qtd), money(p.precoMedio), money(p.total)]),
    });
    doc.save(`vendas-resumo-${dataInicio}-${dataFim}.pdf`);
    toast({ title: "PDF exportado" });
  };

  const TabelaResumo = ({ rows, titulo }: { rows: Array<{ nome: string; qtd: number; precoMedio: number; total: number }>; titulo: string }) => (
    <Card className="w-full min-w-0">
      <CardHeader className="pb-3"><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem vendas no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[420px]">
              <TableHeader><TableRow><TableHead>{titulo.replace("Vendas por ", "")}</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Preço médio</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map(row => <TableRow key={row.nome}><TableCell className="font-medium max-w-[160px] truncate" title={row.nome}>{row.nome}</TableCell><TableCell className="text-right">{row.qtd.toLocaleString("pt-BR")}</TableCell><TableCell className="text-right whitespace-nowrap">{money(row.precoMedio)}</TableCell><TableCell className="text-right font-semibold whitespace-nowrap">{money(row.total)}</TableCell></TableRow>)}
                <TableRow className="bg-muted/50 font-bold"><TableCell>Total</TableCell><TableCell className="text-right">{rows.reduce((s, r) => s + r.qtd, 0).toLocaleString("pt-BR")}</TableCell><TableCell className="text-right">{money(rows.reduce((s, r) => s + r.qtd, 0) ? rows.reduce((s, r) => s + r.total, 0) / rows.reduce((s, r) => s + r.qtd, 0) : 0)}</TableCell><TableCell className="text-right">{money(rows.reduce((s, r) => s + r.total, 0))}</TableCell></TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

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

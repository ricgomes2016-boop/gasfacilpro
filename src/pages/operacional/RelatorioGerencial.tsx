import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDate } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { DollarSign, TrendingUp, ShoppingCart, Truck, Package, Users, Percent, AlertTriangle, Brain, Loader2, FileText, Download } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";

export default function RelatorioGerencial() {
  const { unidadeAtual } = useUnidade();
  const [vendas, setVendas] = useState<any[]>([]);
  const [despesas, setDespesas] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [relatorioIA, setRelatorioIA] = useState("");
  const [gerandoIA, setGerandoIA] = useState(false);
  const [periodoIA, setPeriodoIA] = useState<"semanal" | "mensal">("mensal");

  useState(() => {
    const fetchAll = async () => {
      const inicio = format(startOfMonth(getBrasiliaDate()), "yyyy-MM-dd");
      const fim = format(endOfMonth(getBrasiliaDate()), "yyyy-MM-dd");

      let pedQ = supabase.from("pedidos").select("id, valor_total, status, created_at, forma_pagamento").gte("created_at", inicio).lte("created_at", fim + "T23:59:59");
      if (unidadeAtual?.id) pedQ = pedQ.eq("unidade_id", unidadeAtual.id);

      let despQ = supabase.from("contas_pagar").select("id, valor, categoria, status, vencimento").gte("vencimento", inicio).lte("vencimento", fim);
      if (unidadeAtual?.id) despQ = despQ.eq("unidade_id", unidadeAtual.id);

      let prodQ = supabase.from("produtos").select("id, nome, preco_venda, preco_custo, estoque_atual");
      if (unidadeAtual?.id) prodQ = prodQ.eq("unidade_id", unidadeAtual.id);

      let cliQ = supabase.from("clientes").select("id, nome, created_at");

      const [vendasRes, despesasRes, produtosRes, clientesRes] = await Promise.all([
        pedQ, despQ, prodQ, cliQ,
      ]);

      setVendas(vendasRes.data || []);
      setDespesas(despesasRes.data || []);
      setProdutos(produtosRes.data || []);
      setClientes(clientesRes.data || []);
      setLoading(false);
    };
    fetchAll();
  });

  const gerarRelatorioIA = async () => {
    setGerandoIA(true);
    try {
      const { data, error } = await supabase.functions.invoke("relatorio-gerencial-ia", {
        body: { unidade_id: unidadeAtual?.id || null, periodo: periodoIA },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        return;
      }
      setRelatorioIA(data?.relatorio || "");
      toast({ title: "Relatório gerado com sucesso!" });
    } catch (e) {
      toast({ title: "Erro ao gerar relatório", variant: "destructive" });
    } finally {
      setGerandoIA(false);
    }
  };

  const exportarPDF = () => {
    if (!relatorioIA) return;
    const doc = new jsPDF();
    const titulo = `Relatório Gerencial - ${periodoIA === "semanal" ? "Semanal" : "Mensal"}`;
    doc.setFontSize(16);
    doc.text(titulo, 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);

    // Simple text wrapping for PDF
    const lines = doc.splitTextToSize(relatorioIA.replace(/[#*`]/g, "").replace(/\n{2,}/g, "\n\n"), 180);
    doc.setFontSize(9);
    let y = 38;
    for (const line of lines) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, 14, y);
      y += 5;
    }
    doc.save(`relatorio-gerencial-${periodoIA}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  // KPIs
  const vendasConcluidas = vendas.filter((v) => v.status === "entregue" || v.status === "concluido");
  const faturamento = vendasConcluidas.reduce((s, v) => s + Number(v.valor_total), 0);
  const totalDespesas = despesas.reduce((s, d) => s + Number(d.valor), 0);
  const lucroOperacional = faturamento - totalDespesas;
  const margemOperacional = faturamento > 0 ? (lucroOperacional / faturamento) * 100 : 0;
  const ticketMedio = vendasConcluidas.length > 0 ? faturamento / vendasConcluidas.length : 0;
  const totalPedidos = vendas.length;
  const custoMedioEntrega = vendasConcluidas.length > 0 ? totalDespesas * 0.3 / vendasConcluidas.length : 0;

  // Charts data
  const vendasPorDia = Array.from({ length: 30 }, (_, i) => {
    const dia = subDays(new Date(), 29 - i);
    const diaStr = format(dia, "yyyy-MM-dd");
    const total = vendas.filter((v) => v.created_at?.startsWith(diaStr)).reduce((s, v) => s + Number(v.valor_total), 0);
    return { dia: format(dia, "dd/MM"), total };
  });

  const despesasPorCategoria = despesas.reduce((acc: Record<string, number>, d) => {
    const cat = d.categoria || "Outros";
    acc[cat] = (acc[cat] || 0) + Number(d.valor);
    return acc;
  }, {});
  const despesasChart = Object.entries(despesasPorCategoria).map(([name, value]) => ({ name, value }));

  const formaPagamento = vendas.reduce((acc: Record<string, number>, v) => {
    const fp = v.forma_pagamento || "Não informado";
    acc[fp] = (acc[fp] || 0) + 1;
    return acc;
  }, {});
  const pagamentoChart = Object.entries(formaPagamento).map(([name, value]) => ({ name, value }));

  const topProdutos = produtos
    .filter((p) => p.preco_venda && p.preco_custo)
    .map((p) => ({ nome: p.nome, margem: ((Number(p.preco_venda) - Number(p.preco_custo)) / Number(p.preco_venda)) * 100, estoque: p.estoque_atual || 0 }))
    .sort((a, b) => b.margem - a.margem)
    .slice(0, 8);

  const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#8884d8", "#82ca9d", "#ffc658"];

  return (
    <MainLayout>
      <Header title="Relatório Gerencial" subtitle={`Consolidado de ${format(new Date(), "MMMM yyyy", { locale: ptBR })}`} />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <Tabs defaultValue="graficos" className="space-y-6">
          <TabsList>
            <TabsTrigger value="graficos" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />Gráficos
            </TabsTrigger>
            <TabsTrigger value="relatorio-ia" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />Relatório IA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="graficos" className="space-y-6">
            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
              {[
                { icon: DollarSign, label: "Faturamento", value: `R$ ${(faturamento / 1000).toFixed(1)}k`, color: "text-green-600" },
                { icon: TrendingUp, label: "Lucro Op.", value: `R$ ${(lucroOperacional / 1000).toFixed(1)}k`, color: lucroOperacional >= 0 ? "text-green-600" : "text-destructive" },
                { icon: Percent, label: "Margem", value: `${margemOperacional.toFixed(1)}%`, color: "text-blue-600" },
                { icon: ShoppingCart, label: "Pedidos", value: totalPedidos.toString(), color: "text-primary" },
                { icon: DollarSign, label: "Ticket Médio", value: `R$ ${ticketMedio.toFixed(0)}`, color: "text-primary" },
                { icon: AlertTriangle, label: "Despesas", value: `R$ ${(totalDespesas / 1000).toFixed(1)}k`, color: "text-destructive" },
                { icon: Truck, label: "Custo/Entrega", value: `R$ ${custoMedioEntrega.toFixed(2)}`, color: "text-orange-600" },
                { icon: Users, label: "Clientes", value: clientes.length.toString(), color: "text-primary" },
              ].map((kpi, i) => (
                <Card key={i}>
                  <CardContent className="pt-4 pb-3 px-3">
                    <kpi.icon className={`h-4 w-4 ${kpi.color} mb-1`} />
                    <p className="text-lg font-bold">{kpi.value}</p>
                    <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts Row 1 */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-sm">Faturamento Diário</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={vendasPorDia}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                      <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Despesas por Categoria</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={despesasChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {despesasChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-sm">Margem por Produto (Top 8)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={topProdutos} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 10 }} unit="%" />
                      <YAxis dataKey="nome" type="category" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                      <Bar dataKey="margem" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Formas de Pagamento</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={pagamentoChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                        {pagamentoChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="relatorio-ia" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    Relatório Gerencial por IA
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Tabs value={periodoIA} onValueChange={(v) => setPeriodoIA(v as any)}>
                      <TabsList className="h-8">
                        <TabsTrigger value="semanal" className="text-xs h-7">Semanal</TabsTrigger>
                        <TabsTrigger value="mensal" className="text-xs h-7">Mensal</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <Button onClick={gerarRelatorioIA} disabled={gerandoIA} size="sm">
                      {gerandoIA ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
                      {gerandoIA ? "Gerando..." : "Gerar Relatório"}
                    </Button>
                    {relatorioIA && (
                      <Button onClick={exportarPDF} variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />PDF
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {relatorioIA ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{relatorioIA}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium mb-2">Relatório Inteligente</p>
                    <p className="text-sm mb-4">Clique em "Gerar Relatório" para a IA analisar seus dados e criar um relatório executivo completo com recomendações.</p>
                    <Button onClick={gerarRelatorioIA} disabled={gerandoIA}>
                      <Brain className="h-4 w-4 mr-2" />Gerar Relatório {periodoIA === "semanal" ? "Semanal" : "Mensal"}
                    </Button>
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

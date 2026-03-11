import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Package, Flame, Droplets, AlertTriangle, TrendingUp, DollarSign, BarChart3, Cylinder, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { subDays, format, startOfDay, endOfDay } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function DashboardEstoque() {
  const { unidadeAtual } = useUnidade();
  const [chartViewGiro, setChartViewGiro] = useState<"categoria" | "produto">("produto");
  const [chartViewValor, setChartViewValor] = useState<"categoria" | "produto">("produto");

  const { data: produtos = [] } = useQuery({
    queryKey: ["dashboard-estoque-produtos", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("produtos").select("id, nome, categoria, tipo_botijao, estoque, preco").eq("ativo", true);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: vendasRaw = [] } = useQuery({
    queryKey: ["dashboard-estoque-vendas", unidadeAtual?.id],
    queryFn: async () => {
      const desde = subDays(new Date(), 30);
      let q = supabase
        .from("pedido_itens")
        .select("produto_id, quantidade, preco_unitario, produtos(nome, preco, categoria), pedidos!inner(created_at, status, unidade_id)")
        .gte("pedidos.created_at", startOfDay(desde).toISOString())
        .neq("pedidos.status", "cancelado");
      if (unidadeAtual?.id) q = q.eq("pedidos.unidade_id", unidadeAtual.id);
      const { data } = await q;
      return (data || []) as any[];
    },
  });

  const { data: alertasRuptura = [] } = useQuery({
    queryKey: ["dashboard-estoque-ruptura", unidadeAtual?.id],
    queryFn: async () => {
      let q = (supabase as any).from("vw_previsao_ruptura")
        .select("id, nome, estoque, giro_diario, estoque_minimo_calculado, dias_ate_ruptura, situacao")
        .neq("situacao", "ok")
        .order("dias_ate_ruptura", { ascending: true, nullsFirst: false });
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return (data || []) as any[];
    },
  });

  // KPIs
  const kpis = useMemo(() => {
    const cheios = produtos.filter((p: any) => p.tipo_botijao === "cheio");
    const vazios = produtos.filter((p: any) => p.tipo_botijao === "vazio");
    const totalCheios = cheios.reduce((s: number, p: any) => s + (p.estoque || 0), 0);
    const totalVazios = vazios.reduce((s: number, p: any) => s + (p.estoque || 0), 0);
    const valorEstoque = produtos.filter((p: any) => p.tipo_botijao !== "vazio").reduce((s: number, p: any) => s + (p.estoque || 0) * (p.preco || 0), 0);
    const totalProdutos = produtos.length;
    const rupturaEm7Dias = alertasRuptura.filter((a: any) => a.dias_ate_ruptura !== null && a.dias_ate_ruptura <= 7).length;
    return { totalCheios, totalVazios, valorEstoque, totalProdutos, rupturaEm7Dias };
  }, [produtos, alertasRuptura]);

  // Curva ABC
  const curvaABC = useMemo(() => {
    // Agrupa por NOME do produto para não duplicar (ex: Gas P13 de unidades diferentes)
    const vendasPorNome: Record<string, { qty: number; valor: number }> = {};
    vendasRaw.forEach((v: any) => {
      const prodNome = v.produtos?.nome || produtos.find((p: any) => p.id === v.produto_id)?.nome || null;
      if (!prodNome) return;
      const preco = v.preco_unitario || v.produtos?.preco || produtos.find((p: any) => p.id === v.produto_id)?.preco || 0;
      if (!vendasPorNome[prodNome]) vendasPorNome[prodNome] = { qty: 0, valor: 0 };
      vendasPorNome[prodNome].qty += v.quantidade;
      vendasPorNome[prodNome].valor += v.quantidade * preco;
    });

    const items = Object.entries(vendasPorNome)
      .map(([nome, data]) => ({
        id: nome,
        nome,
        quantidade: data.qty,
        valor: data.valor,
      }))
      .sort((a, b) => b.valor - a.valor);

    const totalValor = items.reduce((s, i) => s + i.valor, 0);
    let acumulado = 0;
    return items.map((item) => {
      acumulado += item.valor;
      const percentual = totalValor > 0 ? (acumulado / totalValor) * 100 : 0;
      const classe = percentual <= 80 ? "A" : percentual <= 95 ? "B" : "C";
      return { ...item, percentual: Math.round(percentual), classe };
    });
  }, [produtos, vendasRaw]);

  // Giro por categoria
  const giroPorCategoria = useMemo(() => {
    const categorias: Record<string, { vendas: number; estoque: number }> = {};
    vendasRaw.forEach((v: any) => {
      const cat = v.produtos?.categoria || produtos.find((p: any) => p.id === v.produto_id)?.categoria || "outro";
      if (!categorias[cat]) categorias[cat] = { vendas: 0, estoque: 0 };
      categorias[cat].vendas += v.quantidade;
    });
    produtos.forEach((p: any) => {
      const cat = p.categoria || "outro";
      if (!categorias[cat]) categorias[cat] = { vendas: 0, estoque: 0 };
      if (p.tipo_botijao !== "vazio") categorias[cat].estoque += p.estoque || 0;
    });
    return Object.entries(categorias).map(([cat, data]) => ({
      nome: cat === "gas" ? "Gás" : cat === "agua" ? "Água" : cat === "acessorio" ? "Acessórios" : "Outros",
      giro: data.estoque > 0 ? +(data.vendas / data.estoque).toFixed(2) : 0,
      vendas: data.vendas,
      estoque: data.estoque,
    }));
  }, [produtos, vendasRaw]);

  // Giro por produto
  const giroPorProduto = useMemo(() => {
    const prods: Record<string, { vendas: number; estoque: number }> = {};
    vendasRaw.forEach((v: any) => {
      const nome = v.produtos?.nome || produtos.find((p: any) => p.id === v.produto_id)?.nome || null;
      if (!nome) return;
      if (!prods[nome]) prods[nome] = { vendas: 0, estoque: 0 };
      prods[nome].vendas += v.quantidade;
    });
    produtos.filter((p: any) => p.tipo_botijao !== "vazio").forEach((p: any) => {
      if (!prods[p.nome]) prods[p.nome] = { vendas: 0, estoque: 0 };
      prods[p.nome].estoque += p.estoque || 0;
    });
    return Object.entries(prods)
      .map(([nome, data]) => ({
        nome,
        giro: data.estoque > 0 ? +(data.vendas / data.estoque).toFixed(2) : 0,
        vendas: data.vendas,
        estoque: data.estoque,
      }))
      .sort((a, b) => b.giro - a.giro)
      .slice(0, 15);
  }, [produtos, vendasRaw]);

  // Distribuição valor por categoria (para pie chart)
  const distribuicaoValorCategoria = useMemo(() => {
    const cats: Record<string, number> = {};
    produtos.filter((p: any) => p.tipo_botijao !== "vazio").forEach((p: any) => {
      const cat = p.categoria === "gas" ? "Gás" : p.categoria === "agua" ? "Água" : p.categoria === "acessorio" ? "Acessórios" : "Outros";
      cats[cat] = (cats[cat] || 0) + (p.estoque || 0) * (p.preco || 0);
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value: +value.toFixed(2) }));
  }, [produtos]);

  // Distribuição valor por produto
  const distribuicaoValorProduto = useMemo(() => {
    const prods: Record<string, number> = {};
    produtos.filter((p: any) => p.tipo_botijao !== "vazio").forEach((p: any) => {
      prods[p.nome] = (prods[p.nome] || 0) + (p.estoque || 0) * (p.preco || 0);
    });
    return Object.entries(prods)
      .map(([name, value]) => ({ name, value: +value.toFixed(2) }))
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [produtos]);

  const situacaoBadge = (situacao: string) => {
    if (situacao === "sem_estoque") return <Badge variant="destructive">Sem estoque</Badge>;
    if (situacao === "critico") return <Badge variant="destructive">Crítico</Badge>;
    if (situacao === "alerta") return <Badge className="bg-yellow-500 text-white">Alerta</Badge>;
    return <Badge variant="secondary">OK</Badge>;
  };

  return (
    <MainLayout>
      <Header title="Dashboard de Estoque" subtitle="Visão consolidada do inventário" />
      <div className="p-3 sm:p-6 space-y-6">
        {/* Filtro de unidade */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Unidade:</span>
          <Select value={filtroUnidadeId} onValueChange={setFiltroUnidadeId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as unidades</SelectItem>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">Cheios</p>
              </div>
              <p className="text-2xl font-bold">{kpis.totalCheios}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Cylinder className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">Vazios</p>
              </div>
              <p className="text-2xl font-bold">{kpis.totalVazios}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-accent-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">Valor Imobilizado</p>
              </div>
              <p className="text-lg font-bold">R$ {kpis.valorEstoque.toLocaleString("pt-BR")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-xs text-muted-foreground">Alertas Ruptura</p>
              </div>
              <p className="text-2xl font-bold">{alertasRuptura.length}</p>
            </CardContent>
          </Card>
          <Card className={kpis.rupturaEm7Dias > 0 ? "border-destructive/50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className={`h-4 w-4 shrink-0 ${kpis.rupturaEm7Dias > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                <p className="text-xs text-muted-foreground">Ruptura em 7d</p>
              </div>
              <p className={`text-2xl font-bold ${kpis.rupturaEm7Dias > 0 ? "text-destructive" : ""}`}>{kpis.rupturaEm7Dias}</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts row */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Giro de Estoque */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Giro de Estoque (30d)</CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant={chartViewGiro === "produto" ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => setChartViewGiro("produto")}>Produto</Button>
                <Button size="sm" variant={chartViewGiro === "categoria" ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => setChartViewGiro("categoria")}>Categoria</Button>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartViewGiro === "categoria" ? giroPorCategoria : giroPorProduto}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="nome" className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis className="text-xs fill-muted-foreground" />
                  <Tooltip />
                  <Bar dataKey="giro" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Giro" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Distribuição Valor */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Valor Imobilizado</CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant={chartViewValor === "produto" ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => setChartViewValor("produto")}>Produto</Button>
                <Button size="sm" variant={chartViewValor === "categoria" ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => setChartViewValor("categoria")}>Categoria</Button>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={chartViewValor === "categoria" ? distribuicaoValorCategoria : distribuicaoValorProduto} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {(chartViewValor === "categoria" ? distribuicaoValorCategoria : distribuicaoValorProduto).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Alertas de Ruptura — dinâmicos via vw_previsao_ruptura */}
        {alertasRuptura.length > 0 && (
          <Card className="border-destructive/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" /> Previsão de Ruptura — Ação Necessária
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Estoque</TableHead>
                      <TableHead className="text-center">Giro/Dia</TableHead>
                      <TableHead className="text-center">Mínimo (MCMM)</TableHead>
                      <TableHead className="text-center">Dias até Zerar</TableHead>
                      <TableHead className="text-center">Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alertasRuptura.map((a: any) => (
                      <TableRow key={a.id} className={a.situacao === "critico" || a.situacao === "sem_estoque" ? "bg-destructive/5" : "bg-yellow-50 dark:bg-yellow-950/10"}>
                        <TableCell className="font-medium">{a.nome}</TableCell>
                        <TableCell className="text-center font-bold">{a.estoque}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{Number(a.giro_diario).toFixed(1)}/d</TableCell>
                        <TableCell className="text-center">{a.estoque_minimo_calculado}</TableCell>
                        <TableCell className="text-center font-bold">
                          {a.dias_ate_ruptura !== null ? (
                            <span className={a.dias_ate_ruptura <= 3 ? "text-destructive" : a.dias_ate_ruptura <= 7 ? "text-yellow-600" : ""}>
                              {a.dias_ate_ruptura === 0 ? "hoje" : `${a.dias_ate_ruptura}d`}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-center">{situacaoBadge(a.situacao)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Curva ABC */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Curva ABC — Últimos 30 dias
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Vendas (un)</TableHead>
                    <TableHead className="text-center">Faturamento</TableHead>
                    <TableHead className="text-center">% Acumulado</TableHead>
                    <TableHead className="text-center">Classe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {curvaABC.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sem dados de vendas nos últimos 30 dias</TableCell></TableRow>
                  ) : curvaABC.slice(0, 20).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell className="text-center">{item.quantidade}</TableCell>
                      <TableCell className="text-center">R$ {item.valor.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-center">{item.percentual}%</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.classe === "A" ? "default" : item.classe === "B" ? "secondary" : "outline"}>
                          {item.classe}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

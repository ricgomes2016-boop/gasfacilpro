import { useState, useMemo, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { PageSectionLoader } from "@/components/ui/page-loader";
import { ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Line, Area } from "recharts";
import { Calculator, TrendingUp, DollarSign, Package, AlertTriangle, Plus, Trash2, CheckCircle2, XCircle, FileDown, Printer } from "lucide-react";
import { exportPEtoPdf, handlePrint } from "@/services/reportPdfService";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { startOfMonth, endOfMonth } from "date-fns";

interface CustoFixo {
  id: string;
  descricao: string;
  valor: number;
  auto?: boolean;
}

const isTransferenciaInterna = (categoria?: string | null, descricao?: string | null) => {
  const text = `${categoria || ""} ${descricao || ""}`.toLowerCase();
  return text.includes("depósito banc") || text.includes("deposito banc") || text.includes("transferência caixa") || text.includes("transferencia caixa");
};

export default function PontoEquilibrio({ embedded = false }: { embedded?: boolean }) {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [custosFixos, setCustosFixos] = useState<CustoFixo[]>([]);
  const [novoDesc, setNovoDesc] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [precoVendaUnit, setPrecoVendaUnit] = useState(0);
  const [custoVariavelUnit, setCustoVariavelUnit] = useState(0);
  const [vendasMesAtual, setVendasMesAtual] = useState(0);

  useEffect(() => { fetchRealData(); }, [unidadeAtual]);

  const fetchRealData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const inicio = startOfMonth(now).toISOString();
      const fim = endOfMonth(now).toISOString();

      // Fetch categorias, produtos, pedidos, funcionarios, abastecimentos in parallel
      const [
        { data: categorias },
        produtosRes,
        pedidosRes,
        funcRes,
        abastRes,
        caixaRes,
      ] = await Promise.all([
        (() => {
          let q = supabase.from("categorias_despesa").select("*").eq("ativo", true).eq("tipo", "fixo").order("ordem");
          if (unidadeAtual?.id) q = q.or(`unidade_id.is.null,unidade_id.eq.${unidadeAtual.id}`);
          return q;
        })(),
        supabase.from("produtos").select("id, nome, preco"),
        (() => {
          let q = supabase.from("pedidos")
            .select("valor_total, pedido_itens(quantidade, preco_unitario, produto_id)")
            .gte("created_at", inicio).lte("created_at", fim).neq("status", "cancelado");
          if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
          return q;
        })(),
        (() => {
          let q = supabase.from("funcionarios").select("salario").eq("ativo", true);
          if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
          return q;
        })(),
        (() => {
          let q = supabase.from("abastecimentos").select("valor").gte("created_at", inicio).lte("created_at", fim);
          if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
          return q;
        })(),
        (() => {
          let q = supabase.from("movimentacoes_caixa")
            .select("valor, categoria, descricao, status")
            .eq("tipo", "saida")
            .neq("status", "rejeitada")
            .is("compra_id", null)
            .is("pedido_id", null)
            .gte("created_at", inicio)
            .lte("created_at", fim);
          if (unidadeAtual?.id) q = q.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
          return q;
        })(),
      ]);

      const produtos = produtosRes.data || [];
      const pedidos = pedidosRes.data || [];
      const funcionarios = funcRes.data || [];
      const abastecimentos = abastRes.data || [];
      const despesasCaixa = (caixaRes.data || []).filter((d: any) => !isTransferenciaInterna(d.categoria, d.descricao));

      // Auto custos fixos from categorias + real system data
      const totalSalarios = funcionarios.reduce((s, f) => s + (Number(f.salario) || 0), 0);
      const totalCombustivel = abastecimentos.reduce((s, a) => s + (Number(a.valor) || 0), 0);
      const caixaPorCategoria = new Map<string, number>();
      despesasCaixa.forEach((d: any) => {
        const cat = (d.categoria || d.descricao || "Despesas do Caixa").toString().trim();
        caixaPorCategoria.set(cat, (caixaPorCategoria.get(cat) || 0) + (Number(d.valor) || 0));
      });
      const categoriasCaixaUsadas = new Set<string>();

      const custosAuto: CustoFixo[] = (categorias || []).map((cat: any) => {
        let valor = cat.valor_padrao || 0;
        const nomeLC = cat.nome.toLowerCase();
        if (nomeLC.includes("salário") || nomeLC.includes("salario")) valor = totalSalarios || valor;
        else if (nomeLC.includes("combustível") || nomeLC.includes("combustivel")) valor = totalCombustivel || valor;
        for (const [categoria, total] of caixaPorCategoria.entries()) {
          const caixaLC = categoria.toLowerCase();
          if (caixaLC === nomeLC || caixaLC.includes(nomeLC) || nomeLC.includes(caixaLC)) {
            valor = total;
            categoriasCaixaUsadas.add(categoria);
          }
        }
        return { id: cat.id, descricao: cat.nome, valor, auto: true };
      });

      caixaPorCategoria.forEach((valor, categoria) => {
        if (categoriasCaixaUsadas.has(categoria) || valor <= 0) return;
        custosAuto.push({ id: `caixa-${categoria}`, descricao: `Despesa caixa: ${categoria}`, valor, auto: true });
      });
      setCustosFixos(custosAuto);

      // Calculate avg price from real sales
      const produtoMap = new Map(produtos.map(p => [p.id, Number(p.preco) || 0]));
      let totalUnidades = 0;
      let totalReceita = 0;
      let totalCustoCompra = 0;

      pedidos.forEach(ped => {
        totalReceita += Number(ped.valor_total) || 0;
        (ped.pedido_itens || []).forEach((item: any) => {
          const qty = item.quantidade || 0;
          totalUnidades += qty;
          totalCustoCompra += qty * (produtoMap.get(item.produto_id) || 0) * 0.7;
        });
      });

      setVendasMesAtual(totalUnidades);

      if (totalUnidades > 0) {
        setPrecoVendaUnit(Math.round((totalReceita / totalUnidades) * 100) / 100);
        setCustoVariavelUnit(Math.round((totalCustoCompra / totalUnidades) * 100) / 100);
      } else {
        // Fallback: use P13 product price
        const p13 = produtos.find(p => p.nome?.toLowerCase().includes("p13") || p.nome?.toLowerCase().includes("13kg"));
        if (p13) {
          setPrecoVendaUnit(Number(p13.preco) || 120);
          setCustoVariavelUnit((Number(p13.preco) || 120) * 0.7);
        } else {
          setPrecoVendaUnit(120);
          setCustoVariavelUnit(75);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const totalCustosFixos = useMemo(() => custosFixos.reduce((s, c) => s + c.valor, 0), [custosFixos]);
  const margemContribuicao = precoVendaUnit - custoVariavelUnit;
  const margemPercentual = precoVendaUnit > 0 ? (margemContribuicao / precoVendaUnit) * 100 : 0;
  const peUnidades = margemContribuicao > 0 ? Math.ceil(totalCustosFixos / margemContribuicao) : 0;
  const peReais = margemPercentual > 0 ? totalCustosFixos / (margemPercentual / 100) : 0;
  const atingiuPE = vendasMesAtual >= peUnidades;
  const faltamUnidades = Math.max(0, peUnidades - vendasMesAtual);
  const progressoPE = peUnidades > 0 ? Math.min(100, (vendasMesAtual / peUnidades) * 100) : 0;

  const addCusto = () => {
    if (!novoDesc || !novoValor) return;
    setCustosFixos([...custosFixos, { id: Date.now().toString(), descricao: novoDesc, valor: parseFloat(novoValor) }]);
    setNovoDesc("");
    setNovoValor("");
  };

  const removeCusto = (id: string) => setCustosFixos(custosFixos.filter((c) => c.id !== id));

  const chartData = useMemo(() => {
    const maxUnid = Math.max(peUnidades * 2, vendasMesAtual * 1.5, 20);
    const step = Math.max(1, Math.floor(maxUnid / 20));
    const data = [];
    for (let q = 0; q <= maxUnid; q += step) {
      const receita = q * precoVendaUnit;
      const custoTotal = totalCustosFixos + q * custoVariavelUnit;
      const lucro = receita - custoTotal;
      data.push({ unidades: q, receita, custoTotal, lucro });
    }
    return data;
  }, [peUnidades, precoVendaUnit, custoVariavelUnit, totalCustosFixos, vendasMesAtual]);

  if (loading) {
    const loader = <PageSectionLoader label="Carregando ponto de equilíbrio..." />;
    if (embedded) return loader;
    return (
      <MainLayout>
        <Header title="Ponto de Equilíbrio" subtitle="Análise de break-even da operação" />
        {loader}
      </MainLayout>
    );
  }

  const content = (
    <div className="space-y-6 w-full min-w-0 max-w-full overflow-hidden">
      {/* Ações */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end w-full min-w-0">
        <Button variant="outline" size="sm" className="h-10 sm:h-9 min-w-0" onClick={() => exportPEtoPdf(peUnidades, peReais, margemContribuicao, margemPercentual, totalCustosFixos, precoVendaUnit, custoVariavelUnit, custosFixos, vendasMesAtual)}>
          <FileDown className="h-4 w-4 mr-2" /> PDF
        </Button>
        <Button variant="outline" size="sm" className="h-10 sm:h-9 min-w-0" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" /> Imprimir
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 w-full min-w-0">
        <Card className="relative overflow-hidden min-w-0">
          <div className="absolute inset-0 bg-gradient-to-br from-info/5 to-transparent pointer-events-none" />
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-info" />
              <p className="text-xs text-muted-foreground">PE Unidades</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold tabular-nums truncate">{peUnidades.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">un./mês</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden min-w-0">
          <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent pointer-events-none" />
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-success" />
              <p className="text-xs text-muted-foreground">PE Faturamento</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold tabular-nums truncate">R$ {(peReais / 1000).toFixed(1)}k</p>
            <p className="text-xs text-muted-foreground">receita mínima</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden min-w-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Margem Contrib.</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold tabular-nums truncate">R$ {margemContribuicao.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{margemPercentual.toFixed(1)}% por un.</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden min-w-0">
          <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent pointer-events-none" />
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-xs text-muted-foreground">Custos Fixos</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold tabular-nums truncate">R$ {(totalCustosFixos / 1000).toFixed(1)}k</p>
            <p className="text-xs text-muted-foreground">mensais</p>
          </CardContent>
        </Card>
        {/* Status do mês */}
        <Card className={`relative overflow-hidden min-w-0 col-span-2 lg:col-span-1 ${atingiuPE ? "border-success/30" : "border-warning/30"}`}>
          <div className={`absolute inset-0 bg-gradient-to-br ${atingiuPE ? "from-success/5" : "from-warning/5"} to-transparent pointer-events-none`} />
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 mb-1">
              {atingiuPE
                ? <CheckCircle2 className="h-4 w-4 text-success" />
                : <XCircle className="h-4 w-4 text-warning" />}
              <p className="text-xs text-muted-foreground">Status Mês</p>
            </div>
            <p className="text-2xl font-bold tabular-nums">{vendasMesAtual}</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${atingiuPE ? "bg-success" : "bg-warning"}`}
                  style={{ width: `${progressoPE}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{progressoPE.toFixed(0)}%</span>
            </div>
            {!atingiuPE && (
              <p className="text-[10px] text-warning mt-0.5">Faltam {faltamUnidades} un.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico */}
      <Card className="min-w-0 overflow-hidden border-border/60 bg-card/95 shadow-[var(--elev-2)]">
        <CardHeader className="border-b border-border/60 bg-muted/25 pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            Gráfico de Ponto de Equilíbrio
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 w-full max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain">
          <div className="min-w-[520px] sm:min-w-0">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="gradLucro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.55} vertical={false} />
              <XAxis dataKey="unidades" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                  name === "receita" ? "Receita" : name === "custoTotal" ? "Custo Total" : "Lucro/Prejuízo"
                ]}
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
              />
              <Area type="monotone" dataKey="lucro" fill="url(#gradLucro)" stroke="none" />
              <Line type="monotone" dataKey="receita" stroke="hsl(var(--success))" strokeWidth={2.5} name="Receita Total" dot={false} />
              <Line type="monotone" dataKey="custoTotal" stroke="hsl(var(--destructive))" strokeWidth={2.5} name="Custo Total" dot={false} />
              <Line type="monotone" dataKey="lucro" stroke="hsl(var(--primary))" strokeWidth={2.5} strokeDasharray="5 5" name="Lucro / Prejuízo" dot={false} />
              {peUnidades > 0 && (
                <ReferenceLine x={peUnidades} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" label={{ value: `PE: ${peUnidades}`, position: "top", fill: "hsl(var(--foreground))", fontSize: 11 }} />
              )}
              {vendasMesAtual > 0 && (
                <ReferenceLine x={vendasMesAtual} stroke="hsl(var(--primary))" strokeWidth={2} label={{ value: `Atual: ${vendasMesAtual}`, position: "insideTopRight", fill: "hsl(var(--primary))", fontSize: 11 }} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full min-w-0">
        {/* Parâmetros de Venda */}
        <Card className="min-w-0 overflow-hidden border-border/60 bg-card/95 shadow-[var(--elev-2)]">
          <CardHeader className="border-b border-border/60 bg-muted/25 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
              <CardTitle className="text-base">Parâmetros de Venda</CardTitle>
              {vendasMesAtual > 0 && (
                <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success">
                  Dados reais
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Preço de Venda Unitário (R$)</Label>
              <Input type="number" step="0.01" value={precoVendaUnit} onChange={(e) => setPrecoVendaUnit(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Custo Variável Unitário (R$)</Label>
              <Input type="number" step="0.01" value={custoVariavelUnit} onChange={(e) => setCustoVariavelUnit(parseFloat(e.target.value) || 0)} />
              <p className="text-xs text-muted-foreground">Custo do produto + comissão + impostos por unidade</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Margem de Contribuição</span>
                <span className="font-medium text-right">R$ {margemContribuicao.toFixed(2)} ({margemPercentual.toFixed(1)}%)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">PE em Unidades</span>
                <span className="font-bold text-primary">{peUnidades.toLocaleString("pt-BR")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">PE em Faturamento</span>
                <span className="font-bold text-primary">R$ {peReais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custos Fixos */}
        <Card className="min-w-0 overflow-hidden border-border/60 bg-card/95 shadow-[var(--elev-2)]">
          <CardHeader className="border-b border-border/60 bg-muted/25 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
              <CardTitle className="text-base">Custos Fixos Mensais</CardTitle>
              <Badge variant="outline">R$ {totalCustosFixos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 min-w-0 max-w-full overflow-hidden">
            <div className="w-full min-w-0 max-w-full max-h-[350px] overflow-x-auto overflow-y-auto overscroll-x-contain">
              <Table className="min-w-[420px]">
                <TableHeader>
                  <TableRow className="bg-muted/45">
                    <TableHead className="py-2 text-[11px] font-bold uppercase tracking-wide">Descrição</TableHead>
                    <TableHead className="py-2 text-right text-[11px] font-bold uppercase tracking-wide">Valor (R$)</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {custosFixos.map((c) => (
                    <TableRow key={c.id} className="border-border/50 hover:bg-muted/30">
                      <TableCell className="py-2 text-sm">
                        <div className="flex items-center gap-1.5">
                          {c.descricao}
                          {c.auto && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-success/10 text-success border-success">
                              auto
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold py-2 tabular-nums">{c.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="py-2">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCusto(c.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-primary/10">
                    <TableCell className="font-bold py-2">Total</TableCell>
                    <TableCell className="text-right font-bold py-2 tabular-nums">R$ {totalCustosFixos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_7rem_auto] gap-2 w-full min-w-0">
              <Input placeholder="Descrição" value={novoDesc} onChange={(e) => setNovoDesc(e.target.value)} className="w-full min-w-0 h-10 sm:h-8 text-sm" />
              <Input type="number" step="0.01" placeholder="Valor" value={novoValor} onChange={(e) => setNovoValor(e.target.value)} className="w-full min-w-0 h-10 sm:h-8 text-sm" />
              <Button size="sm" variant="outline" className="h-10 sm:h-8 w-full sm:w-auto" onClick={addCusto}><Plus className="h-3 w-3" /></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (embedded) return content;
  return (
    <MainLayout>
      <Header title="Ponto de Equilíbrio" subtitle="Análise de break-even da operação" />
      <div className="p-3 sm:p-4 md:p-6 w-full min-w-0 max-w-full overflow-x-hidden">{content}</div>
    </MainLayout>
  );
}
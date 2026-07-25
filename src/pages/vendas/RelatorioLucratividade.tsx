import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, RefreshCw, TrendingUp, TrendingDown, DollarSign, Package, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { cn } from "@/lib/utils";

type Granularidade = "diario" | "mensal";

interface PedidoRow {
  id: string;
  data_entrega: string | null;
  created_at: string;
  status: string | null;
  pedido_itens: Array<{
    quantidade: number;
    preco_unitario: number;
    produtos: { id: string; nome: string; preco_custo: number | null } | null;
  }>;
}

interface DespesaFonte {
  contas_pagar: number;
  movimentacoes_caixa: number;
  despesas_contabeis: number;
}

const money = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const dataPedido = (p: PedidoRow) =>
  (p.data_entrega || p.created_at || "").slice(0, 10);

export default function RelatorioLucratividade() {
  const { unidadeAtual } = useUnidade();
  const hoje = new Date();
  const [inicio, setInicio] = useState(format(startOfMonth(hoje), "yyyy-MM-dd"));
  const [fim, setFim] = useState(format(endOfMonth(hoje), "yyyy-MM-dd"));
  const [granularidade, setGranularidade] = useState<Granularidade>("diario");
  const [incluirCP, setIncluirCP] = useState(true);
  const [incluirMC, setIncluirMC] = useState(true);
  const [incluirDC, setIncluirDC] = useState(true);

  const unidadeId = unidadeAtual?.id ?? null;

  const inicioISO = `${inicio}T00:00:00`;
  const fimISO = `${fim}T23:59:59`;

  const pedidosQ = useQuery({
    queryKey: ["rel-lucro-pedidos", unidadeId, inicio, fim],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select(
          "id, data_entrega, created_at, status, pedido_itens(quantidade, preco_unitario, produtos(id, nome, preco_custo))"
        )
        .eq("unidade_id", unidadeId!)
        .in("status", ["entregue", "finalizado", "pago"])
        .gte("created_at", inicioISO)
        .lte("created_at", fimISO)
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as PedidoRow[];
    },
  });

  const despesasQ = useQuery({
    queryKey: ["rel-lucro-despesas", unidadeId, inicio, fim],
    enabled: !!unidadeId,
    queryFn: async (): Promise<DespesaFonte & { detalhado: Record<string, DespesaFonte> }> => {
      const detalhado: Record<string, DespesaFonte> = {};
      const bump = (key: string, campo: keyof DespesaFonte, v: number) => {
        if (!detalhado[key]) detalhado[key] = { contas_pagar: 0, movimentacoes_caixa: 0, despesas_contabeis: 0 };
        detalhado[key][campo] += v;
      };

      // Contas a pagar pagas
      const cp = await supabase
        .from("contas_pagar")
        .select("valor, data_pagamento, vencimento, status")
        .eq("unidade_id", unidadeId!)
        .eq("status", "paga")
        .gte("data_pagamento", inicio)
        .lte("data_pagamento", fim);
      let totalCP = 0;
      (cp.data ?? []).forEach((r: any) => {
        const v = Number(r.valor) || 0;
        const d = (r.data_pagamento || r.vencimento || "").slice(0, 10);
        totalCP += v;
        if (d) bump(d, "contas_pagar", v);
      });

      // Movimentações de caixa - saídas (excluir as vinculadas a compra_id para evitar dupla contagem com contas_pagar)
      const mc = await supabase
        .from("movimentacoes_caixa")
        .select("valor, created_at, tipo, compra_id, categoria")
        .eq("unidade_id", unidadeId!)
        .eq("tipo", "saida")
        .gte("created_at", inicioISO)
        .lte("created_at", fimISO);
      let totalMC = 0;
      (mc.data ?? []).forEach((r: any) => {
        if (r.compra_id) return; // já contabilizado em contas_pagar
        const v = Number(r.valor) || 0;
        const d = (r.created_at || "").slice(0, 10);
        totalMC += v;
        if (d) bump(d, "movimentacoes_caixa", v);
      });

      // Despesas contábeis
      const dc = await supabase
        .from("despesas_contabeis")
        .select("valor, data_despesa")
        .eq("unidade_id", unidadeId!)
        .gte("data_despesa", inicio)
        .lte("data_despesa", fim);
      let totalDC = 0;
      (dc.data ?? []).forEach((r: any) => {
        const v = Number(r.valor) || 0;
        const d = (r.data_despesa || "").slice(0, 10);
        totalDC += v;
        if (d) bump(d, "despesas_contabeis", v);
      });

      return {
        contas_pagar: totalCP,
        movimentacoes_caixa: totalMC,
        despesas_contabeis: totalDC,
        detalhado,
      };
    },
  });

  const despesasTotal = useMemo(() => {
    const d = despesasQ.data;
    if (!d) return 0;
    return (
      (incluirCP ? d.contas_pagar : 0) +
      (incluirMC ? d.movimentacoes_caixa : 0) +
      (incluirDC ? d.despesas_contabeis : 0)
    );
  }, [despesasQ.data, incluirCP, incluirMC, incluirDC]);

  // Agregação por produto
  const porProduto = useMemo(() => {
    const map = new Map<
      string,
      { produto: string; qtd: number; qtdComCusto: number; receita: number; custoTotal: number }
    >();
    (pedidosQ.data ?? []).forEach((p) => {
      (p.pedido_itens ?? []).forEach((it) => {
        const nome = it.produtos?.nome ?? "Produto removido";
        const qtd = Number(it.quantidade) || 0;
        const preco = Number(it.preco_unitario) || 0;
        const custoU = Number(it.produtos?.preco_custo) || 0;
        const cur =
          map.get(nome) ??
          { produto: nome, qtd: 0, qtdComCusto: 0, receita: 0, custoTotal: 0 };
        cur.qtd += qtd;
        cur.receita += qtd * preco;
        if (custoU > 0) {
          cur.qtdComCusto += qtd;
          cur.custoTotal += qtd * custoU;
        }
        map.set(nome, cur);
      });
    });
    return Array.from(map.values())
      .map((r) => {
        const custoMedio = r.qtdComCusto > 0 ? r.custoTotal / r.qtdComCusto : 0;
        const precoMedio = r.qtd > 0 ? r.receita / r.qtd : 0;
        const lucroBruto = r.receita - r.custoTotal;
        const margem = r.receita > 0 ? (lucroBruto / r.receita) * 100 : 0;
        return { ...r, custoMedio, precoMedio, lucroBruto, margem };
      })
      .sort((a, b) => b.receita - a.receita);
  }, [pedidosQ.data]);

  const totais = useMemo(() => {
    const receita = porProduto.reduce((s, r) => s + r.receita, 0);
    const custo = porProduto.reduce((s, r) => s + r.custoTotal, 0);
    const lucroBruto = receita - custo;
    const lucroLiquido = lucroBruto - despesasTotal;
    const margemBruta = receita > 0 ? (lucroBruto / receita) * 100 : 0;
    const margemLiquida = receita > 0 ? (lucroLiquido / receita) * 100 : 0;
    return { receita, custo, lucroBruto, lucroLiquido, margemBruta, margemLiquida };
  }, [porProduto, despesasTotal]);

  // Agregação temporal (diário/mensal)
  const porPeriodo = useMemo(() => {
    const map = new Map<string, { chave: string; receita: number; custo: number; despesas: number }>();
    (pedidosQ.data ?? []).forEach((p) => {
      const d = dataPedido(p);
      if (!d) return;
      const chave = granularidade === "diario" ? d : d.slice(0, 7);
      const cur = map.get(chave) ?? { chave, receita: 0, custo: 0, despesas: 0 };
      (p.pedido_itens ?? []).forEach((it) => {
        const qtd = Number(it.quantidade) || 0;
        const preco = Number(it.preco_unitario) || 0;
        const custoU = Number(it.produtos?.preco_custo) || 0;
        cur.receita += qtd * preco;
        cur.custo += qtd * custoU;
      });
      map.set(chave, cur);
    });
    const det = despesasQ.data?.detalhado ?? {};
    Object.entries(det).forEach(([data, fontes]) => {
      const chave = granularidade === "diario" ? data : data.slice(0, 7);
      const cur = map.get(chave) ?? { chave, receita: 0, custo: 0, despesas: 0 };
      cur.despesas +=
        (incluirCP ? fontes.contas_pagar : 0) +
        (incluirMC ? fontes.movimentacoes_caixa : 0) +
        (incluirDC ? fontes.despesas_contabeis : 0);
      map.set(chave, cur);
    });
    return Array.from(map.values())
      .map((r) => {
        const lucroBruto = r.receita - r.custo;
        const lucroLiquido = lucroBruto - r.despesas;
        const margem = r.receita > 0 ? (lucroLiquido / r.receita) * 100 : 0;
        return { ...r, lucroBruto, lucroLiquido, margem };
      })
      .sort((a, b) => a.chave.localeCompare(b.chave));
  }, [pedidosQ.data, despesasQ.data, granularidade, incluirCP, incluirMC, incluirDC]);

  const formatarChave = (k: string) => {
    if (granularidade === "mensal") {
      const [y, m] = k.split("-");
      return `${m}/${y}`;
    }
    try {
      return format(parseISO(k), "dd/MM (EEE)", { locale: ptBR });
    } catch {
      return k;
    }
  };

  const exportar = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        porProduto.map((r) => ({
          Produto: r.produto,
          Quantidade: r.qtd,
          "Custo médio (un)": r.custoMedio,
          "Preço médio venda (un)": r.precoMedio,
          "Receita total": r.receita,
          "Custo total": r.custoTotal,
          "Lucro bruto": r.lucroBruto,
          "Margem %": r.margem,
        }))
      ),
      "Por Produto"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        porPeriodo.map((r) => ({
          Período: formatarChave(r.chave),
          Receita: r.receita,
          Custo: r.custo,
          Despesas: r.despesas,
          "Lucro bruto": r.lucroBruto,
          "Lucro líquido": r.lucroLiquido,
          "Margem líquida %": r.margem,
        }))
      ),
      granularidade === "diario" ? "Diário" : "Mensal"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { Métrica: "Receita total", Valor: totais.receita },
        { Métrica: "Custo dos produtos vendidos (CMV)", Valor: totais.custo },
        { Métrica: "Lucro bruto", Valor: totais.lucroBruto },
        { Métrica: "Despesas (Contas a pagar)", Valor: despesasQ.data?.contas_pagar ?? 0 },
        { Métrica: "Despesas (Movimentações caixa)", Valor: despesasQ.data?.movimentacoes_caixa ?? 0 },
        { Métrica: "Despesas (Despesas contábeis)", Valor: despesasQ.data?.despesas_contabeis ?? 0 },
        { Métrica: "Despesas consideradas", Valor: despesasTotal },
        { Métrica: "Lucro líquido", Valor: totais.lucroLiquido },
        { Métrica: "Margem bruta %", Valor: totais.margemBruta },
        { Métrica: "Margem líquida %", Valor: totais.margemLiquida },
      ]),
      "Resumo"
    );
    XLSX.writeFile(wb, `lucratividade_${inicio}_a_${fim}.xlsx`);
  };

  const loading = pedidosQ.isLoading || despesasQ.isLoading;

  return (
    <MainLayout>
      <Header title="Relatório Detalhado — Lucratividade" />
      <div className="space-y-4 p-4 pb-24 md:pb-4">
        {/* Filtros */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:flex-wrap md:items-end">
            <div className="flex flex-col gap-1">
              <Label htmlFor="ini" className="text-xs text-muted-foreground">Início</Label>
              <Input id="ini" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-11" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="fim" className="text-xs text-muted-foreground">Fim</Label>
              <Input id="fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="h-11" />
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-4 md:justify-end">
              <div className="flex items-center gap-2">
                <Checkbox id="cp" checked={incluirCP} onCheckedChange={(v) => setIncluirCP(!!v)} />
                <Label htmlFor="cp" className="text-sm">Contas a pagar</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="mc" checked={incluirMC} onCheckedChange={(v) => setIncluirMC(!!v)} />
                <Label htmlFor="mc" className="text-sm">Sangria/Caixa</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="dc" checked={incluirDC} onCheckedChange={(v) => setIncluirDC(!!v)} />
                <Label htmlFor="dc" className="text-sm">Despesas contábeis</Label>
              </div>
              <Button variant="outline" size="sm" onClick={() => { pedidosQ.refetch(); despesasQ.refetch(); }} className="h-11">
                <RefreshCw className="mr-2 h-4 w-4" />Atualizar
              </Button>
              <Button size="sm" onClick={exportar} disabled={loading} className="h-11">
                <Download className="mr-2 h-4 w-4" />Exportar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiBox loading={loading} label="Receita" value={money(totais.receita)} icon={<DollarSign className="h-4 w-4" />} tone="neutral" />
          <KpiBox loading={loading} label="CMV (custo produtos)" value={money(totais.custo)} icon={<Package className="h-4 w-4" />} tone="neutral" />
          <KpiBox
            loading={loading}
            label={`Lucro bruto (${pct(totais.margemBruta)})`}
            value={money(totais.lucroBruto)}
            icon={<TrendingUp className="h-4 w-4" />}
            tone={totais.lucroBruto >= 0 ? "positive" : "negative"}
          />
          <KpiBox
            loading={loading}
            label={`Lucro líquido (${pct(totais.margemLiquida)})`}
            value={money(totais.lucroLiquido)}
            icon={totais.lucroLiquido >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            tone={totais.lucroLiquido >= 0 ? "positive" : "negative"}
          />
        </div>

        {/* Breakdown despesas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Despesas consideradas — {money(despesasTotal)}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <FonteBadge on={incluirCP} label="Contas a pagar (pagas)" valor={despesasQ.data?.contas_pagar ?? 0} />
            <FonteBadge on={incluirMC} label="Sangria/Caixa (saídas)" valor={despesasQ.data?.movimentacoes_caixa ?? 0} />
            <FonteBadge on={incluirDC} label="Despesas contábeis" valor={despesasQ.data?.despesas_contabeis ?? 0} />
          </CardContent>
        </Card>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Saídas de caixa vinculadas a compras são ignoradas para evitar dupla contagem com o contas a pagar. Ative/desative as fontes acima conforme sua contabilidade.
          </AlertDescription>
        </Alert>

        {/* Tabelas */}
        <Tabs defaultValue="produto" className="space-y-3">
          <TabsList>
            <TabsTrigger value="produto">Por produto</TabsTrigger>
            <TabsTrigger value="periodo">Diário / Mensal</TabsTrigger>
          </TabsList>

          <TabsContent value="produto">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd vendida</TableHead>
                        <TableHead className="text-right">Custo médio (un)</TableHead>
                        <TableHead className="text-right">Preço médio (un)</TableHead>
                        <TableHead className="text-right">Receita total</TableHead>
                        <TableHead className="text-right">Custo total</TableHead>
                        <TableHead className="text-right">Lucro bruto</TableHead>
                        <TableHead className="text-right">Margem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                        ))
                      ) : porProduto.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Sem vendas no período.</TableCell></TableRow>
                      ) : (
                        porProduto.map((r) => (
                          <TableRow key={r.produto}>
                            <TableCell className="font-medium">
                              {r.produto}
                              {r.qtdComCusto < r.qtd && (
                                <Badge variant="outline" className="ml-2 text-[10px]">custo parcial</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{r.qtd.toLocaleString("pt-BR")}</TableCell>
                            <TableCell className="text-right">{money(r.custoMedio)}</TableCell>
                            <TableCell className="text-right">{money(r.precoMedio)}</TableCell>
                            <TableCell className="text-right">{money(r.receita)}</TableCell>
                            <TableCell className="text-right">{money(r.custoTotal)}</TableCell>
                            <TableCell className={cn("text-right font-semibold", r.lucroBruto >= 0 ? "text-emerald-600" : "text-rose-600")}>
                              {money(r.lucroBruto)}
                            </TableCell>
                            <TableCell className="text-right">{pct(r.margem)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="periodo">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Lucratividade {granularidade === "diario" ? "diária" : "mensal"}</CardTitle>
                <Tabs value={granularidade} onValueChange={(v) => setGranularidade(v as Granularidade)}>
                  <TabsList>
                    <TabsTrigger value="diario">Diário</TabsTrigger>
                    <TabsTrigger value="mensal">Mensal</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                        <TableHead className="text-right">Despesas</TableHead>
                        <TableHead className="text-right">Lucro bruto</TableHead>
                        <TableHead className="text-right">Lucro líquido</TableHead>
                        <TableHead className="text-right">Margem líq.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                        ))
                      ) : porPeriodo.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Sem dados no período.</TableCell></TableRow>
                      ) : (
                        porPeriodo.map((r) => (
                          <TableRow key={r.chave}>
                            <TableCell className="font-medium">{formatarChave(r.chave)}</TableCell>
                            <TableCell className="text-right">{money(r.receita)}</TableCell>
                            <TableCell className="text-right">{money(r.custo)}</TableCell>
                            <TableCell className="text-right">{money(r.despesas)}</TableCell>
                            <TableCell className={cn("text-right", r.lucroBruto >= 0 ? "text-emerald-600" : "text-rose-600")}>
                              {money(r.lucroBruto)}
                            </TableCell>
                            <TableCell className={cn("text-right font-semibold", r.lucroLiquido >= 0 ? "text-emerald-600" : "text-rose-600")}>
                              {money(r.lucroLiquido)}
                            </TableCell>
                            <TableCell className="text-right">{pct(r.margem)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function KpiBox({ loading, label, value, icon, tone }: {
  loading: boolean; label: string; value: string; icon: React.ReactNode;
  tone: "positive" | "negative" | "neutral";
}) {
  const toneCls =
    tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          {icon}
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-32" />
        ) : (
          <div className={cn("mt-1 text-xl font-bold sm:text-2xl", toneCls)}>{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

function FonteBadge({ on, label, valor }: { on: boolean; label: string; valor: number }) {
  return (
    <div className={cn("flex items-center justify-between rounded-md border px-3 py-2", on ? "bg-card" : "bg-muted/40 opacity-60")}>
      <span className="text-xs">{label}</span>
      <span className="font-medium">{money(valor)}</span>
    </div>
  );
}

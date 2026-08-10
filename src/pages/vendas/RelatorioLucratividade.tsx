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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { cn } from "@/lib/utils";
import { isDespesaOperacionalResultado } from "@/lib/financeiro/despesasResultado";

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
  const [drillProduto, setDrillProduto] = useState<string | null>(null);
  const [drillPeriodo, setDrillPeriodo] = useState<string | null>(null);

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
        .select("valor, data_pagamento, vencimento, status, categoria, descricao, compra_id")
        .eq("unidade_id", unidadeId!)
        .eq("status", "paga")
        .gte("data_pagamento", inicio)
        .lte("data_pagamento", fim);
      let totalCP = 0;
      (cp.data ?? []).forEach((r: any) => {
        if (!isDespesaOperacionalResultado({ categoria: r.categoria, descricao: r.descricao, compraId: r.compra_id })) return;
        const v = Number(r.valor) || 0;
        const d = (r.data_pagamento || r.vencimento || "").slice(0, 10);
        totalCP += v;
        if (d) bump(d, "contas_pagar", v);
      });

      // Movimentações de caixa - saídas (excluir as vinculadas a compra_id para evitar dupla contagem com contas_pagar)
      const mc = await supabase
        .from("movimentacoes_caixa")
        .select("valor, created_at, tipo, compra_id, categoria, descricao")
        .eq("unidade_id", unidadeId!)
        .eq("tipo", "saida")
        .gte("created_at", inicioISO)
        .lte("created_at", fimISO);
      let totalMC = 0;
      (mc.data ?? []).forEach((r: any) => {
        if (!isDespesaOperacionalResultado({ categoria: r.categoria, descricao: r.descricao, compraId: r.compra_id })) return;
        const v = Number(r.valor) || 0;
        const d = (r.created_at || "").slice(0, 10);
        totalMC += v;
        if (d) bump(d, "movimentacoes_caixa", v);
      });

      // Despesas contábeis
      const dc = await supabase
        .from("despesas_contabeis")
        .select("valor, data_despesa, categoria, descricao")
        .eq("unidade_id", unidadeId!)
        .gte("data_despesa", inicio)
        .lte("data_despesa", fim);
      let totalDC = 0;
      (dc.data ?? []).forEach((r: any) => {
        if (!isDespesaOperacionalResultado({ categoria: r.categoria, descricao: r.descricao })) return;
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

  // ---- Drill-down por produto ----
  const drillProdutoItens = useMemo(() => {
    if (!drillProduto) return [];
    const rows: { pedidoId: string; data: string; qtd: number; preco: number; custo: number; subtotal: number; lucro: number }[] = [];
    (pedidosQ.data ?? []).forEach((p) => {
      (p.pedido_itens ?? []).forEach((it) => {
        const nome = it.produtos?.nome ?? "Produto removido";
        if (nome !== drillProduto) return;
        const qtd = Number(it.quantidade) || 0;
        const preco = Number(it.preco_unitario) || 0;
        const custo = Number(it.produtos?.preco_custo) || 0;
        rows.push({
          pedidoId: p.id,
          data: dataPedido(p),
          qtd,
          preco,
          custo,
          subtotal: qtd * preco,
          lucro: qtd * (preco - custo),
        });
      });
    });
    return rows.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [drillProduto, pedidosQ.data]);

  // ---- Drill-down por período: vendas ----
  const drillPeriodoVendas = useMemo(() => {
    if (!drillPeriodo) return [];
    const inRange = (d: string) =>
      granularidade === "diario" ? d === drillPeriodo : d.slice(0, 7) === drillPeriodo;
    return (pedidosQ.data ?? [])
      .filter((p) => inRange(dataPedido(p)))
      .map((p) => {
        let receita = 0;
        let custo = 0;
        (p.pedido_itens ?? []).forEach((it) => {
          const qtd = Number(it.quantidade) || 0;
          const preco = Number(it.preco_unitario) || 0;
          const cu = Number(it.produtos?.preco_custo) || 0;
          receita += qtd * preco;
          custo += qtd * cu;
        });
        return { id: p.id, data: dataPedido(p), receita, custo, lucro: receita - custo };
      })
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [drillPeriodo, pedidosQ.data, granularidade]);

  // ---- Drill-down por período: despesas (detalhado, lazy) ----
  const drillDespesasQ = useQuery({
    queryKey: ["rel-lucro-drill-despesas", unidadeId, drillPeriodo, granularidade, incluirCP, incluirMC, incluirDC],
    enabled: !!unidadeId && !!drillPeriodo,
    queryFn: async () => {
      let ini = drillPeriodo!;
      let fim2 = drillPeriodo!;
      if (granularidade === "mensal") {
        const [y, m] = drillPeriodo!.split("-").map(Number);
        ini = format(new Date(y, m - 1, 1), "yyyy-MM-dd");
        fim2 = format(new Date(y, m, 0), "yyyy-MM-dd");
      }
      const items: { fonte: string; data: string; descricao: string; valor: number }[] = [];
      if (incluirCP) {
        const { data } = await supabase
          .from("contas_pagar")
          .select("valor, data_pagamento, descricao, fornecedor, categoria, compra_id")
          .eq("unidade_id", unidadeId!)
          .eq("status", "paga")
          .gte("data_pagamento", ini)
          .lte("data_pagamento", fim2);
        (data ?? []).filter((r: any) =>
          isDespesaOperacionalResultado({ categoria: r.categoria, descricao: r.descricao || r.fornecedor, compraId: r.compra_id })
        ).forEach((r: any) =>
          items.push({
            fonte: "Contas a pagar",
            data: (r.data_pagamento || "").slice(0, 10),
            descricao: r.descricao || r.fornecedor || "—",
            valor: Number(r.valor) || 0,
          })
        );
      }
      if (incluirMC) {
        const { data } = await supabase
          .from("movimentacoes_caixa")
          .select("valor, created_at, categoria, descricao, compra_id")
          .eq("unidade_id", unidadeId!)
          .eq("tipo", "saida")
          .gte("created_at", `${ini}T00:00:00`)
          .lte("created_at", `${fim2}T23:59:59`);
        (data ?? []).forEach((r: any) => {
          if (!isDespesaOperacionalResultado({ categoria: r.categoria, descricao: r.descricao, compraId: r.compra_id })) return;
          items.push({
            fonte: "Sangria/Caixa",
            data: (r.created_at || "").slice(0, 10),
            descricao: r.descricao || r.categoria || "—",
            valor: Number(r.valor) || 0,
          });
        });
      }
      if (incluirDC) {
        const { data } = await supabase
          .from("despesas_contabeis")
          .select("valor, data_despesa, descricao, categoria")
          .eq("unidade_id", unidadeId!)
          .gte("data_despesa", ini)
          .lte("data_despesa", fim2);
        (data ?? []).filter((r: any) =>
          isDespesaOperacionalResultado({ categoria: r.categoria, descricao: r.descricao })
        ).forEach((r: any) =>
          items.push({
            fonte: "Contábil",
            data: (r.data_despesa || "").slice(0, 10),
            descricao: r.descricao || r.categoria || "—",
            valor: Number(r.valor) || 0,
          })
        );
      }
      return items.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    },
  });



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
      <div className="space-y-5 p-4 pb-24 md:pb-6">
        {/* Cabeçalho editorial */}
        <div className="px-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Relatório Detalhado</h1>
          <p className="mt-0.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Lucratividade Operacional
          </p>
        </div>

        {/* Hero: Lucro Líquido */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900 to-emerald-700 p-5 text-white shadow-lg shadow-emerald-900/20">
          <div className="relative z-10">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-100/80">
              Lucro líquido total
            </p>
            {loading ? (
              <Skeleton className="mt-1 h-9 w-48 bg-white/20" />
            ) : (
              <h2 className={cn("mt-1 text-3xl font-bold sm:text-4xl", totais.lucroLiquido < 0 && "text-rose-100")}>
                {money(totais.lucroLiquido)}
              </h2>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-white/20 px-2 py-1 text-[11px] font-bold">
                Margem líquida {pct(totais.margemLiquida)}
              </span>
              <span className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium text-emerald-50">
                Despesas: {money(despesasTotal)}
              </span>
            </div>
          </div>
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -left-4 -bottom-4 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        {/* Bento KPI grid 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          <BentoKpi
            label="Receita bruta"
            value={money(totais.receita)}
            tone="neutral"
            loading={loading}
            icon={<DollarSign className="h-3.5 w-3.5" />}
          />
          <BentoKpi
            label="CMV"
            value={money(totais.custo)}
            tone="negative"
            loading={loading}
            icon={<Package className="h-3.5 w-3.5" />}
          />
          <BentoKpi
            label={`Lucro bruto · ${pct(totais.margemBruta)}`}
            value={money(totais.lucroBruto)}
            tone="positive"
            loading={loading}
            icon={<TrendingUp className="h-3.5 w-3.5" />}
          />
          <BentoKpi
            label="Despesas totais"
            value={money(despesasTotal)}
            tone="dark"
            loading={loading}
            icon={<TrendingDown className="h-3.5 w-3.5" />}
          />
        </div>

        {/* Filtros & Controles */}
        <Card className="border-slate-100">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-1 gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <Label htmlFor="ini" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Início
                  </Label>
                  <Input id="ini" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <Label htmlFor="fim" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Fim
                  </Label>
                  <Input id="fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { pedidosQ.refetch(); despesasQ.refetch(); }}
                  className="h-11 flex-1 rounded-xl sm:flex-none"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />Atualizar
                </Button>
                <Button
                  onClick={exportar}
                  disabled={loading}
                  className="h-11 flex-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 sm:flex-none"
                >
                  <Download className="mr-2 h-4 w-4" />Exportar
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
              <FonteToggle checked={incluirCP} onChange={setIncluirCP} label="Contas a pagar" valor={despesasQ.data?.contas_pagar ?? 0} />
              <FonteToggle checked={incluirMC} onChange={setIncluirMC} label="Sangria/Caixa" valor={despesasQ.data?.movimentacoes_caixa ?? 0} />
              <FonteToggle checked={incluirDC} onChange={setIncluirDC} label="Despesas contábeis" valor={despesasQ.data?.despesas_contabeis ?? 0} />
            </div>
          </CardContent>
        </Card>

        <Alert className="rounded-xl border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Saídas de caixa vinculadas a compras são ignoradas para evitar dupla contagem com o contas a pagar.
          </AlertDescription>
        </Alert>

        {/* Tabs de análise */}
        <Tabs defaultValue="produto" className="space-y-3">
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted p-1 sm:w-auto">
            <TabsTrigger value="produto" className="rounded-lg text-xs font-bold">Por produto</TabsTrigger>
            <TabsTrigger value="periodo" className="rounded-lg text-xs font-bold">Diário / Mensal</TabsTrigger>
          </TabsList>

          {/* Por Produto — cards no mobile, tabela no desktop */}
          <TabsContent value="produto" className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-foreground">Performance por Produto</h3>
              <span className="text-[11px] font-medium text-muted-foreground">
                {porProduto.length} {porProduto.length === 1 ? "item" : "itens"}
              </span>
            </div>

            {/* Mobile: cards */}
            <div className="space-y-2 md:hidden">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
              ) : porProduto.length === 0 ? (
                <EmptyState message="Sem vendas no período." />
              ) : (
                porProduto.map((r) => <ProdutoCard key={r.produto} r={r} onClick={() => setDrillProduto(r.produto)} />)
              )}
            </div>

            {/* Desktop: tabela */}
            <Card className="hidden md:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Custo médio</TableHead>
                        <TableHead className="text-right">Preço médio</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
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
                        <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Sem vendas no período.</TableCell></TableRow>
                      ) : (
                        porProduto.map((r) => (
                          <TableRow
                            key={r.produto}
                            onClick={() => setDrillProduto(r.produto)}
                            className="cursor-pointer hover:bg-muted/50"
                          >
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
                            <TableCell className="text-right">
                              <MargemPill margem={r.margem} />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Diário / Mensal */}
          <TabsContent value="periodo" className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-foreground">
                Lucratividade {granularidade === "diario" ? "diária" : "mensal"}
              </h3>
              <div className="flex rounded-lg bg-muted p-1">
                <button
                  onClick={() => setGranularidade("diario")}
                  className={cn(
                    "rounded-md px-3 py-1 text-[11px] font-bold transition",
                    granularidade === "diario" ? "bg-background text-emerald-700 shadow-sm" : "text-muted-foreground"
                  )}
                >
                  Diário
                </button>
                <button
                  onClick={() => setGranularidade("mensal")}
                  className={cn(
                    "rounded-md px-3 py-1 text-[11px] font-bold transition",
                    granularidade === "mensal" ? "bg-background text-emerald-700 shadow-sm" : "text-muted-foreground"
                  )}
                >
                  Mensal
                </button>
              </div>
            </div>

            {/* Mobile: cards */}
            <div className="space-y-2 md:hidden">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
              ) : porPeriodo.length === 0 ? (
                <EmptyState message="Sem dados no período." />
              ) : (
                porPeriodo.map((r) => <PeriodoCard key={r.chave} r={r} label={formatarChave(r.chave)} onClick={() => setDrillPeriodo(r.chave)} />)
              )}
            </div>

            {/* Desktop: tabela */}
            <Card className="hidden md:block">
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
                        <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</TableCell></TableRow>
                      ) : (
                        porPeriodo.map((r) => (
                          <TableRow
                            key={r.chave}
                            onClick={() => setDrillPeriodo(r.chave)}
                            className="cursor-pointer hover:bg-muted/50"
                          >
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
                            <TableCell className="text-right">
                              <MargemPill margem={r.margem} />
                            </TableCell>
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

      {/* Drill-down Produto */}
      <Dialog open={!!drillProduto} onOpenChange={(v) => !v && setDrillProduto(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0">
          <DialogHeader className="border-b border-border bg-emerald-50/60 p-4 dark:bg-emerald-950/20">
            <DialogTitle className="text-base">{drillProduto}</DialogTitle>
            <DialogDescription className="text-xs">
              Vendas que compõem o lucro no período {format(parseISO(inicio), "dd/MM")} — {format(parseISO(fim), "dd/MM/yyyy")}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto p-4">
            {drillProdutoItens.length === 0 ? (
              <EmptyState message="Sem itens." />
            ) : (
              <>
                <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-center text-xs">
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Receita</p>
                    <p className="font-bold">{money(drillProdutoItens.reduce((s, x) => s + x.subtotal, 0))}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Custo</p>
                    <p className="font-bold text-rose-600">{money(drillProdutoItens.reduce((s, x) => s + x.qtd * x.custo, 0))}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Lucro</p>
                    <p className="font-bold text-emerald-600">{money(drillProdutoItens.reduce((s, x) => s + x.lucro, 0))}</p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">Custo un</TableHead>
                      <TableHead className="text-right">Lucro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillProdutoItens.map((row, i) => (
                      <TableRow key={`${row.pedidoId}-${i}`}>
                        <TableCell className="text-xs">{row.data ? format(parseISO(row.data), "dd/MM") : "—"}</TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">#{row.pedidoId.slice(0, 8)}</TableCell>
                        <TableCell className="text-right">{row.qtd}</TableCell>
                        <TableCell className="text-right">{money(row.preco)}</TableCell>
                        <TableCell className="text-right text-rose-600">{money(row.custo)}</TableCell>
                        <TableCell className={cn("text-right font-semibold", row.lucro >= 0 ? "text-emerald-600" : "text-rose-600")}>
                          {money(row.lucro)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Drill-down Período */}
      <Dialog open={!!drillPeriodo} onOpenChange={(v) => !v && setDrillPeriodo(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-0">
          <DialogHeader className="border-b border-border bg-emerald-50/60 p-4 dark:bg-emerald-950/20">
            <DialogTitle className="text-base">
              {drillPeriodo ? formatarChave(drillPeriodo) : ""}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Vendas e despesas que compõem o lucro do período
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
            <section>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700">
                Vendas ({drillPeriodoVendas.length})
              </h4>
              {drillPeriodoVendas.length === 0 ? (
                <EmptyState message="Sem vendas." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Lucro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillPeriodoVendas.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="text-xs">{v.data ? format(parseISO(v.data), "dd/MM") : "—"}</TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">#{v.id.slice(0, 8)}</TableCell>
                        <TableCell className="text-right">{money(v.receita)}</TableCell>
                        <TableCell className="text-right text-rose-600">{money(v.custo)}</TableCell>
                        <TableCell className={cn("text-right font-semibold", v.lucro >= 0 ? "text-emerald-600" : "text-rose-600")}>
                          {money(v.lucro)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>

            <section>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-rose-700">
                Despesas ({drillDespesasQ.data?.length ?? 0})
              </h4>
              {drillDespesasQ.isLoading ? (
                <Skeleton className="h-24 w-full rounded-xl" />
              ) : !drillDespesasQ.data || drillDespesasQ.data.length === 0 ? (
                <EmptyState message="Sem despesas no período." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillDespesasQ.data.map((d, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{d.data ? format(parseISO(d.data), "dd/MM") : "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{d.fonte}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-xs">{d.descricao}</TableCell>
                        <TableCell className="text-right font-semibold text-rose-600">{money(d.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>

  );
}

/* ---------------- Componentes visuais ---------------- */

function BentoKpi({
  label, value, tone, icon, loading,
}: {
  label: string; value: string; tone: "neutral" | "positive" | "negative" | "dark";
  icon: React.ReactNode; loading: boolean;
}) {
  const wrapCls =
    tone === "dark"
      ? "bg-slate-900 text-white border-slate-800"
      : tone === "positive"
      ? "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/40"
      : "bg-muted/30 border-border";
  const labelCls =
    tone === "dark"
      ? "text-slate-400"
      : tone === "positive"
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-muted-foreground";
  const valueCls =
    tone === "dark"
      ? "text-white"
      : tone === "positive"
      ? "text-emerald-900 dark:text-emerald-100"
      : tone === "negative"
      ? "text-rose-600 dark:text-rose-400"
      : "text-foreground";
  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm transition hover:shadow-md", wrapCls)}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-[10px] font-bold uppercase tracking-wide", labelCls)}>{label}</p>
        <span className={cn("opacity-60", labelCls)}>{icon}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-6 w-24" />
      ) : (
        <p className={cn("mt-1 text-lg font-bold sm:text-xl", valueCls)}>{value}</p>
      )}
    </div>
  );
}

function FonteToggle({
  checked, onChange, label, valor,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; valor: number }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        checked
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
          : "border-border bg-muted/40 text-muted-foreground"
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", checked ? "bg-emerald-600" : "bg-muted-foreground/40")} />
      <span>{label}</span>
      <span className="font-bold">{money(valor)}</span>
    </button>
  );
}

function MargemPill({ margem }: { margem: number }) {
  const tone =
    margem >= 20
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : margem >= 5
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
  return (
    <span className={cn("inline-block rounded-lg px-2 py-1 text-[11px] font-bold", tone)}>
      {pct(margem)}
    </span>
  );
}

function ProdutoCard({ r, onClick }: {
  r: { produto: string; qtd: number; qtdComCusto: number; custoMedio: number; precoMedio: number; receita: number; custoTotal: number; lucroBruto: number; margem: number };
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-emerald-200 hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{r.produto}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {r.qtd.toLocaleString("pt-BR")} un · custo {money(r.custoMedio)} · venda {money(r.precoMedio)}
          </p>
          {r.qtdComCusto < r.qtd && (
            <Badge variant="outline" className="mt-1 text-[10px]">custo parcial</Badge>
          )}
        </div>
        <MargemPill margem={r.margem} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
        <div>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Receita</p>
          <p className="text-xs font-bold text-foreground">{money(r.receita)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Custo</p>
          <p className="text-xs font-bold text-rose-600">{money(r.custoTotal)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Lucro</p>
          <p className={cn("text-xs font-bold", r.lucroBruto >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {money(r.lucroBruto)}
          </p>
        </div>
      </div>
    </button>
  );
}

function PeriodoCard({ r, label, onClick }: {
  r: { chave: string; receita: number; custo: number; despesas: number; lucroBruto: number; lucroLiquido: number; margem: number };
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-emerald-200 hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-foreground">{label}</p>
        <MargemPill margem={r.margem} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-xs">
        <Kv label="Receita" value={money(r.receita)} />
        <Kv label="Custo" value={money(r.custo)} tone="negative" />
        <Kv label="Despesas" value={money(r.despesas)} tone="negative" />
        <Kv label="Lucro bruto" value={money(r.lucroBruto)} tone={r.lucroBruto >= 0 ? "positive" : "negative"} />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
        <span className="text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
          Lucro líquido
        </span>
        <span className={cn("text-sm font-bold", r.lucroLiquido >= 0 ? "text-emerald-700 dark:text-emerald-200" : "text-rose-600")}>
          {money(r.lucroLiquido)}
        </span>
      </div>
    </button>
  );
}

function Kv({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "positive" | "negative" }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className={cn(
        "text-xs font-bold",
        tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : "text-foreground",
      )}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}


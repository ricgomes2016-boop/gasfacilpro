import { useMemo, useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { VendaSectionHeader } from "@/components/vendas/VendaSectionHeader";
import {
  PackageSearch, Download, Filter, TrendingUp, DollarSign, Percent,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

interface ItemPedido {
  quantidade: number;
  preco_unitario: number;
  produto_id: string | null;
  produtos: { nome: string } | null;
}

interface Pedido {
  id: string;
  created_at: string;
  data_entrega: string | null;
  status: string | null;
  clientes: { nome: string } | null;
  entregadores: { nome: string } | null;
  pedido_itens: ItemPedido[];
}

interface Props {
  pedidos: Pedido[];
  unidadeId?: string;
  unidadeIds?: string[];
  consolidado?: boolean;
  dataInicio: string;
  dataFim: string;
  onPeriodoChange?: (inicio: string, fim: string) => void;
}

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatQtd = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const formatPct = (v: number) =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

export function ProdutosVendidosTab({ pedidos, unidadeId, unidadeIds, consolidado, dataInicio, dataFim, onPeriodoChange }: Props) {
  const [clienteFiltro, setClienteFiltro] = useState("todos");
  const [entregadorFiltro, setEntregadorFiltro] = useState("todos");
  const [produtoFiltro, setProdutoFiltro] = useState("todos");
  const [agrupamento, setAgrupamento] = useState<"mes" | "dia" | "nenhum">("mes");
  const [deduzirCancelados, setDeduzirCancelados] = useState(true);
  const [totalizarProdutos, setTotalizarProdutos] = useState(true);

  // Custos por produto
  const scopeKey = consolidado ? `all:${(unidadeIds || []).join(",")}` : (unidadeId || "none");
  const { data: produtosCusto = [] } = useQuery({
    queryKey: ["produtos-custo", scopeKey],
    queryFn: async () => {
      let q = supabase.from("produtos").select("id, nome, preco_custo");
      if (consolidado && unidadeIds && unidadeIds.length > 0) q = q.in("unidade_id", unidadeIds);
      else if (unidadeId) q = q.eq("unidade_id", unidadeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as { id: string; nome: string; preco_custo: number | null }[];
    },
  });

  const custoPorId = useMemo(() => {
    const m = new Map<string, number>();
    produtosCusto.forEach(p => m.set(p.id, Number(p.preco_custo) || 0));
    return m;
  }, [produtosCusto]);
  const custoPorNome = useMemo(() => {
    const m = new Map<string, number>();
    produtosCusto.forEach(p => m.set((p.nome || "").trim().toLowerCase(), Number(p.preco_custo) || 0));
    return m;
  }, [produtosCusto]);

  // Listas para filtros (extraídas dos pedidos do período)
  const clientesOptions = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach(p => { if (p.clientes?.nome) set.add(p.clientes.nome); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [pedidos]);
  const entregadoresOptions = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach(p => { if (p.entregadores?.nome) set.add(p.entregadores.nome); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [pedidos]);
  const produtosOptions = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach(p => p.pedido_itens?.forEach(i => { if (i.produtos?.nome) set.add(i.produtos.nome); }));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [pedidos]);

  // Filtragem + agrupamento
  const { grupos, totaisGerais } = useMemo(() => {
    type LinhaProduto = {
      nome: string;
      qtd: number;
      custoTotal: number;
      vendaTotal: number;
    };
    type Grupo = {
      label: string;
      ordem: string;
      produtos: Map<string, LinhaProduto>;
      qtd: number;
      custoTotal: number;
      vendaTotal: number;
    };

    const mapaGrupos = new Map<string, Grupo>();
    const totais = { qtd: 0, custoTotal: 0, vendaTotal: 0 };

    pedidos.forEach(p => {
      if (deduzirCancelados && p.status === "cancelado") return;
      if (clienteFiltro !== "todos" && p.clientes?.nome !== clienteFiltro) return;
      if (entregadorFiltro !== "todos" && p.entregadores?.nome !== entregadorFiltro) return;
      const dataStr = p.data_entrega || p.created_at;
      if (!dataStr) return;
      const d = new Date(dataStr.length <= 10 ? `${dataStr}T12:00:00` : dataStr);

      let groupKey: string;
      let groupLabel: string;
      let groupOrdem: string;
      if (agrupamento === "mes") {
        groupKey = format(d, "yyyy-MM");
        groupLabel = format(d, "MM/yyyy", { locale: ptBR });
        groupOrdem = groupKey;
      } else if (agrupamento === "dia") {
        groupKey = format(d, "yyyy-MM-dd");
        groupLabel = format(d, "dd/MM/yyyy", { locale: ptBR });
        groupOrdem = groupKey;
      } else {
        groupKey = "_all";
        groupLabel = "Total do Período";
        groupOrdem = "0";
      }

      if (!mapaGrupos.has(groupKey)) {
        mapaGrupos.set(groupKey, {
          label: groupLabel,
          ordem: groupOrdem,
          produtos: new Map(),
          qtd: 0,
          custoTotal: 0,
          vendaTotal: 0,
        });
      }
      const grupo = mapaGrupos.get(groupKey)!;

      (p.pedido_itens || []).forEach(it => {
        const nome = it.produtos?.nome || "Sem nome";
        if (produtoFiltro !== "todos" && nome !== produtoFiltro) return;
        const qtd = Number(it.quantidade) || 0;
        const venda = qtd * (Number(it.preco_unitario) || 0);
        const custoUnit = (it.produto_id && custoPorId.get(it.produto_id))
          || custoPorNome.get(nome.trim().toLowerCase())
          || 0;
        const custo = qtd * custoUnit;

        const key = totalizarProdutos ? nome.trim().toLowerCase() : `${nome}-${it.produto_id || ""}`;
        if (!grupo.produtos.has(key)) {
          grupo.produtos.set(key, { nome, qtd: 0, custoTotal: 0, vendaTotal: 0 });
        }
        const linha = grupo.produtos.get(key)!;
        linha.qtd += qtd;
        linha.custoTotal += custo;
        linha.vendaTotal += venda;

        grupo.qtd += qtd;
        grupo.custoTotal += custo;
        grupo.vendaTotal += venda;
        totais.qtd += qtd;
        totais.custoTotal += custo;
        totais.vendaTotal += venda;
      });
    });

    const isVazio = (n: string) => /vazio|vasilhame/i.test(n);
    const pesoFixo = (n: string) => {
      const x = n.toLowerCase();
      if (/[áa]gua.*20|20\s*l/i.test(x)) return 0;
      if (/p\s*13/i.test(x)) return 1;
      if (/p\s*20/i.test(x)) return 2;
      if (/p\s*45/i.test(x)) return 3;
      return 50;
    };

    const grupos = Array.from(mapaGrupos.values())
      .sort((a, b) => a.ordem.localeCompare(b.ordem))
      .map(g => {
        const produtos = Array.from(g.produtos.values()).sort((a, b) => {
          const va = isVazio(a.nome) ? 1 : 0;
          const vb = isVazio(b.nome) ? 1 : 0;
          if (va !== vb) return va - vb;
          if (produtosOptions.length + 0 <= 6 || g.produtos.size <= 6) {
            const pa = pesoFixo(a.nome);
            const pb = pesoFixo(b.nome);
            if (pa !== pb) return pa - pb;
          }
          return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
        });
        return { ...g, produtosArr: produtos };
      });

    return { grupos, totaisGerais: totais };
  }, [pedidos, deduzirCancelados, clienteFiltro, entregadorFiltro, produtoFiltro, agrupamento, totalizarProdutos, custoPorId, custoPorNome, produtosOptions.length]);

  const lucroGeral = totaisGerais.vendaTotal - totaisGerais.custoTotal;
  const pctGeral = totaisGerais.vendaTotal > 0 ? (lucroGeral / totaisGerais.vendaTotal) * 100 : 0;

  const exportarXLSX = () => {
    const rows: (string | number)[][] = [];
    rows.push([`Produtos Vendidos — ${dataInicio} a ${dataFim}`]);
    rows.push([]);
    rows.push(["Produto", "Qtde", "P. Custo", "T. Custo", "V. Unit.", "T. Venda", "% Lucr.", "T. Lucro"]);
    grupos.forEach(g => {
      rows.push([g.label]);
      g.produtosArr.forEach(p => {
        const pCusto = p.qtd > 0 ? p.custoTotal / p.qtd : 0;
        const vUnit = p.qtd > 0 ? p.vendaTotal / p.qtd : 0;
        const lucro = p.vendaTotal - p.custoTotal;
        const pct = p.vendaTotal > 0 ? (lucro / p.vendaTotal) * 100 : 0;
        rows.push([p.nome, p.qtd, pCusto, p.custoTotal, vUnit, p.vendaTotal, pct, lucro]);
      });
      const lucroG = g.vendaTotal - g.custoTotal;
      const pctG = g.vendaTotal > 0 ? (lucroG / g.vendaTotal) * 100 : 0;
      rows.push([`Total ${g.label}`, g.qtd, "", g.custoTotal, "", g.vendaTotal, pctG, lucroG]);
      rows.push([]);
    });
    rows.push(["TOTAL GERAL", totaisGerais.qtd, "", totaisGerais.custoTotal, "", totaisGerais.vendaTotal, pctGeral, lucroGeral]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos Vendidos");
    XLSX.writeFile(wb, `produtos-vendidos-${dataInicio}-a-${dataFim}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="venda-card">
        <VendaSectionHeader tone="muted" icon={<Filter className="h-5 w-5" />} title="Filtros" />
        <CardContent className="pt-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os clientes</SelectItem>
                  {clientesOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Entregador</Label>
              <Select value={entregadorFiltro} onValueChange={setEntregadorFiltro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os entregadores</SelectItem>
                  {entregadoresOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Produto</Label>
              <Select value={produtoFiltro} onValueChange={setProdutoFiltro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os produtos</SelectItem>
                  {produtosOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Agrupar por</Label>
              <Select value={agrupamento} onValueChange={(v) => setAgrupamento(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes">Mês/Ano</SelectItem>
                  <SelectItem value="dia">Dia</SelectItem>
                  <SelectItem value="nenhum">Sem agrupamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>


          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={totalizarProdutos} onCheckedChange={(v) => setTotalizarProdutos(!!v)} />
              Totalizar produtos
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={deduzirCancelados} onCheckedChange={(v) => setDeduzirCancelados(!!v)} />
              Deduzir cancelados/devoluções
            </label>
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={exportarXLSX} className="gap-2">
                <Download className="h-4 w-4" />
                Exportar XLSX
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="status-card-icon status-card-icon-info"><PackageSearch /></div>
          <div className="min-w-0"><p className="text-xs text-muted-foreground">Qtde Total</p>
          <p className="text-lg font-bold tabular-nums">{formatQtd(totaisGerais.qtd)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="status-card-icon status-card-icon-warning"><DollarSign /></div>
          <div className="min-w-0"><p className="text-xs text-muted-foreground">Total Custo</p>
          <p className="text-lg font-bold tabular-nums truncate">{formatCurrency(totaisGerais.custoTotal)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="status-card-icon status-card-icon-primary"><TrendingUp /></div>
          <div className="min-w-0"><p className="text-xs text-muted-foreground">Total Venda</p>
          <p className="text-lg font-bold tabular-nums truncate">{formatCurrency(totaisGerais.vendaTotal)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="status-card-icon status-card-icon-success"><Percent /></div>
          <div className="min-w-0"><p className="text-xs text-muted-foreground">Lucro / %</p>
          <p className="text-lg font-bold tabular-nums truncate">{formatCurrency(lucroGeral)}</p>
          <p className="text-xs text-success font-medium">{formatPct(pctGeral)}</p></div>
        </CardContent></Card>
      </div>

      {/* Tabela */}
      <Card className="venda-card">
        <VendaSectionHeader
          tone="info"
          icon={<PackageSearch className="h-5 w-5" />}
          title="Produtos Vendidos"
          action={
            <Badge variant="outline" className="text-xs">
              {format(parseISO(`${dataInicio}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })}
              {" — "}
              {format(parseISO(`${dataFim}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })}
            </Badge>
          }
        />
        <CardContent className="p-0 sm:p-4">
          {grupos.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Sem dados no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="border-collapse min-w-[760px]">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="min-w-[200px]">Produto</TableHead>
                    <TableHead className="text-center bg-primary/10">Qtde</TableHead>
                    <TableHead className="text-center">P. Custo</TableHead>
                    <TableHead className="text-center bg-primary/10">T. Custo</TableHead>
                    <TableHead className="text-center">V. Unit.</TableHead>
                    <TableHead className="text-center bg-primary/10">T. Venda</TableHead>
                    <TableHead className="text-center">% Lucr.</TableHead>
                    <TableHead className="text-center bg-accent/30 border-l border-border/60">T. Lucro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grupos.map((g, gi) => (
                    <Fragment key={gi}>
                      {agrupamento !== "nenhum" && (
                        <TableRow className="bg-primary/15 hover:bg-primary/15">
                          <TableCell colSpan={8} className="font-semibold text-primary py-2">
                            {g.label}
                          </TableCell>
                        </TableRow>
                      )}
                      {g.produtosArr.map((p, pi) => {
                        const pCusto = p.qtd > 0 ? p.custoTotal / p.qtd : 0;
                        const vUnit = p.qtd > 0 ? p.vendaTotal / p.qtd : 0;
                        const lucro = p.vendaTotal - p.custoTotal;
                        const pct = p.vendaTotal > 0 ? (lucro / p.vendaTotal) * 100 : 0;
                        return (
                          <TableRow key={pi}>
                            <TableCell className="font-medium">{p.nome}</TableCell>
                            <TableCell className="text-center tabular-nums bg-primary/5">{formatQtd(p.qtd)}</TableCell>
                            <TableCell className="text-center tabular-nums">{formatCurrency(pCusto)}</TableCell>
                            <TableCell className="text-center tabular-nums bg-primary/5">{formatCurrency(p.custoTotal)}</TableCell>
                            <TableCell className="text-center tabular-nums">{formatCurrency(vUnit)}</TableCell>
                            <TableCell className="text-center tabular-nums bg-primary/5">{formatCurrency(p.vendaTotal)}</TableCell>
                            <TableCell className={cn("text-center tabular-nums font-medium", lucro >= 0 ? "text-success" : "text-destructive")}>{formatPct(pct)}</TableCell>
                            <TableCell className={cn("text-center tabular-nums font-semibold bg-accent/20 border-l border-border/60", lucro >= 0 ? "text-success" : "text-destructive")}>{formatCurrency(lucro)}</TableCell>
                          </TableRow>
                        );
                      })}
                      {agrupamento !== "nenhum" && (
                        <TableRow className="bg-muted/60 font-semibold">
                          <TableCell className="text-right">Total {g.label}</TableCell>
                          <TableCell className="text-center tabular-nums bg-primary/15">{formatQtd(g.qtd)}</TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-center tabular-nums bg-primary/15">{formatCurrency(g.custoTotal)}</TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-center tabular-nums bg-primary/15">{formatCurrency(g.vendaTotal)}</TableCell>
                          <TableCell className="text-center tabular-nums">{formatPct(g.vendaTotal > 0 ? ((g.vendaTotal - g.custoTotal) / g.vendaTotal) * 100 : 0)}</TableCell>
                          <TableCell className="text-center tabular-nums bg-accent/40 border-l border-border/60">{formatCurrency(g.vendaTotal - g.custoTotal)}</TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                  <TableRow className="bg-primary/20 font-bold">
                    <TableCell className="text-right text-primary">TOTAL GERAL</TableCell>
                    <TableCell className="text-center tabular-nums">{formatQtd(totaisGerais.qtd)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-center tabular-nums">{formatCurrency(totaisGerais.custoTotal)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-center tabular-nums">{formatCurrency(totaisGerais.vendaTotal)}</TableCell>
                    <TableCell className="text-center tabular-nums">{formatPct(pctGeral)}</TableCell>
                    <TableCell className="text-center tabular-nums bg-accent/60 border-l border-border/60">{formatCurrency(lucroGeral)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageSectionLoader } from "@/components/ui/page-loader";
import { AlertTriangle, Settings2, FileDown, Printer } from "lucide-react";
import { exportROtoPdf, handlePrint } from "@/services/reportPdfService";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface CustoItem {
  id: string;
  nome: string;
  valor: number;
  valorReal: number;
  grupo: string;
  tipo: string;
}

interface CanalVenda {
  canal: string;
  qtde: number;
  precoVenda: number;
  totalRS: number;
  precoCompra: number;
  margemRS: number;
  tonelagem: number;
  tipo?: "canal" | "produto";
}

const mesesOptions = Array.from({ length: 12 }, (_, i) => ({
  value: String(i),
  label: format(new Date(2025, i, 1), "MMMM", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()),
}));

const grupoLabels: Record<string, string> = {
  custos_fixos: "Custos Fixos",
  pessoal: "Pessoal",
  operacional: "Operacional",
  comercial: "Comercial",
  administrativo: "Administrativo",
  financeiro: "Financeiro",
  impostos: "Impostos",
  diversos: "Diversos",
};

export default function ResultadoOperacional({ embedded = false }: { embedded?: boolean }) {
  const { unidadeAtual } = useUnidade();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const custosTableRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [custosWidthInsufficient, setCustosWidthInsufficient] = useState(false);
  const now = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(String(now.getMonth()));
  const [anoSelecionado, setAnoSelecionado] = useState(String(now.getFullYear()));
  const [custos, setCustos] = useState<CustoItem[]>([]);
  const [canais, setCanais] = useState<CanalVenda[]>([]);
  const [precoCompraP13, setPrecoCompraP13] = useState(0);
  const [precoVendaP13, setPrecoVendaP13] = useState(0);

  useEffect(() => { fetchData(); }, [unidadeAtual, mesSelecionado, anoSelecionado]);

  useEffect(() => {
    if (!isMobile) {
      setCustosWidthInsufficient(false);
      return;
    }

    const root = custosTableRef.current;
    if (!root) return;

    const checkOverflow = () => {
      const fields = Array.from(root.querySelectorAll<HTMLElement>("[data-cost-overflow-check='true']"));
      const hasOverflow = fields.some((field) => field.scrollWidth > field.clientWidth + 1);
      setCustosWidthInsufficient(hasOverflow);
    };

    const frame = requestAnimationFrame(checkOverflow);
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(root);
    window.addEventListener("resize", checkOverflow);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", checkOverflow);
    };
  }, [isMobile, custos]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const mes = Number(mesSelecionado);
      const ano = Number(anoSelecionado);
      const inicio = startOfMonth(new Date(ano, mes, 1)).toISOString();
      const fim = endOfMonth(new Date(ano, mes, 1)).toISOString();
      const inicioDate = format(new Date(ano, mes, 1), "yyyy-MM-dd");
      const fimDate = format(endOfMonth(new Date(ano, mes, 1)), "yyyy-MM-dd");

      const [
        { data: categorias },
        pedidosRes,
        contasPagarRes,
        { data: produtos },
      ] = await Promise.all([
        supabase.from("categorias_despesa").select("*").eq("ativo", true).order("ordem"),
        (() => {
          let q = supabase.from("pedidos")
            .select("id, valor_total, canal_venda, created_at, status, pedido_itens(quantidade, preco_unitario, produto_id)")
            .gte("created_at", inicio).lte("created_at", fim).neq("status", "cancelado");
          if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
          return q;
        })(),
        (() => {
          let q = supabase.from("contas_pagar")
            .select("valor, categoria, descricao, status")
            .eq("status", "pago")
            .gte("vencimento", inicioDate).lte("vencimento", fimDate);
          if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
          return q;
        })(),
        supabase.from("produtos").select("id, nome, preco, preco_custo"),
      ]);

      const pedidos = pedidosRes.data || [];
      const contasPagar = contasPagarRes.data || [];

      const cpPorCategoria: Record<string, number> = {};
      contasPagar.forEach(cp => {
        const cat = (cp.categoria || cp.descricao || "Diversos").toString().toLowerCase().trim();
        cpPorCategoria[cat] = (cpPorCategoria[cat] || 0) + (Number(cp.valor) || 0);
      });

      const custosCalculados: CustoItem[] = ((categorias || []) as any[]).map(cat => {
        let valorReal = 0;
        const nomeLC = cat.nome.toLowerCase().trim();
        for (const [cpCat, val] of Object.entries(cpPorCategoria)) {
          if (cpCat === nomeLC || cpCat.includes(nomeLC) || nomeLC.includes(cpCat) ||
            (nomeLC.length >= 5 && cpCat.includes(nomeLC.substring(0, 5))) ||
            (cpCat.length >= 5 && nomeLC.includes(cpCat.substring(0, 5)))) {
            valorReal += val;
          }
        }
        return { id: cat.id, nome: cat.nome, valor: valorReal || cat.valor_padrao || 0, valorReal, grupo: cat.grupo, tipo: cat.tipo };
      });

      setCustos(custosCalculados);

      const produtoMap = new Map((produtos || []).map(p => [p.id, { nome: p.nome, preco: Number(p.preco) || 0, precoCusto: Number((p as any).preco_custo) || 0 }]));
      const p13 = (produtos || []).find(p => p.nome?.toLowerCase().includes("p13") || p.nome?.toLowerCase().includes("13kg"));
      if (p13) {
        const custoProduto = Number((p13 as any).preco_custo) || 0;
        setPrecoCompraP13(custoProduto > 0 ? custoProduto : Number(p13.preco) * 0.7);
        setPrecoVendaP13(Number(p13.preco) || 0);
      }

      const getCustoUnitario = (prod?: { preco: number; precoCusto: number }) =>
        prod?.precoCusto && prod.precoCusto > 0 ? prod.precoCusto : (prod?.preco || 0) * 0.7;

      const classificarProduto = (nome: string) => {
        const n = nome.toLowerCase();
        if (n.includes("p13") || n.includes("13kg")) return "p13";
        if (n.includes("p20") || n.includes("20kg")) return "P20";
        if (n.includes("p45") || n.includes("45kg")) return "P45";
        if (n.includes("água") || n.includes("agua")) return "Água";
        if (n.includes("regulador")) return "Regulador";
        if ((n.includes("galão") || n.includes("galao")) && n.includes("vazio")) return "Galão vazio";
        return null;
      };

      const canalMap: Record<string, { qtde: number; totalRS: number; custoTotal: number; tonelagem: number }> = {};
      const produtosTotais: Record<string, { qtde: number; totalRS: number; custoTotal: number; tonelagem: number }> = {
        P20: { qtde: 0, totalRS: 0, custoTotal: 0, tonelagem: 0 },
        P45: { qtde: 0, totalRS: 0, custoTotal: 0, tonelagem: 0 },
        Água: { qtde: 0, totalRS: 0, custoTotal: 0, tonelagem: 0 },
        Regulador: { qtde: 0, totalRS: 0, custoTotal: 0, tonelagem: 0 },
        "Galão vazio": { qtde: 0, totalRS: 0, custoTotal: 0, tonelagem: 0 },
      };
      pedidos.forEach(pedido => {
        const canal = pedido.canal_venda || "Venda Direta";
        (pedido.pedido_itens || []).forEach((item: any) => {
          const prod = produtoMap.get(item.produto_id);
          const qty = item.quantidade || 0;
          const nomeProd = prod?.nome?.toLowerCase() || "";
          const produtoTipo = classificarProduto(nomeProd);
          const precoVendaUnit = Number(item.preco_unitario) || prod?.preco || 0;
          const totalItem = qty * precoVendaUnit;
          const custoUnit = getCustoUnitario(prod);
          const tonelagem = nomeProd.includes("p45") || nomeProd.includes("45kg") ? qty * 45 / 1000
            : nomeProd.includes("p20") || nomeProd.includes("20kg") ? qty * 20 / 1000
            : nomeProd.includes("p13") || nomeProd.includes("13kg") ? qty * 13 / 1000
            : 0;

          if (produtoTipo === "p13") {
            if (!canalMap[canal]) canalMap[canal] = { qtde: 0, totalRS: 0, custoTotal: 0, tonelagem: 0 };
            canalMap[canal].qtde += qty;
            canalMap[canal].totalRS += totalItem;
            canalMap[canal].custoTotal += qty * custoUnit;
            canalMap[canal].tonelagem += tonelagem;
          } else if (produtoTipo && produtosTotais[produtoTipo]) {
            produtosTotais[produtoTipo].qtde += qty;
            produtosTotais[produtoTipo].totalRS += totalItem;
            produtosTotais[produtoTipo].custoTotal += qty * custoUnit;
            produtosTotais[produtoTipo].tonelagem += tonelagem;
          }
        });
      });

      const totalQtdeP13 = Object.values(canalMap).reduce((s, d) => s + d.qtde, 0);
      const totalCustoP13 = Object.values(canalMap).reduce((s, d) => s + d.custoTotal, 0);
      const precoMedioCompraP13Global = totalQtdeP13 > 0 ? totalCustoP13 / totalQtdeP13 : 0;

      const canaisP13 = Object.entries(canalMap).map(([canal, d]) => ({
        canal, qtde: d.qtde,
        precoVenda: d.qtde > 0 ? d.totalRS / d.qtde : 0,
        totalRS: d.totalRS,
        precoCompra: precoMedioCompraP13Global,
        margemRS: d.totalRS - (d.qtde * precoMedioCompraP13Global),
        tonelagem: Number(d.tonelagem.toFixed(2)),
        tipo: "canal" as const,
      }));
      const linhasProdutos = Object.entries(produtosTotais)
        .map(([canal, d]) => ({
          canal,
          qtde: d.qtde,
          precoVenda: d.qtde > 0 ? d.totalRS / d.qtde : 0,
          totalRS: d.totalRS,
          precoCompra: d.qtde > 0 ? d.custoTotal / d.qtde : 0,
          margemRS: d.totalRS - d.custoTotal,
          tonelagem: Number(d.tonelagem.toFixed(2)),
          tipo: "produto" as const,
        }));
      const comercioIndex = canaisP13.findIndex(c => c.canal.toLowerCase().includes("comércio") || c.canal.toLowerCase().includes("comercio"));
      setCanais(comercioIndex >= 0
        ? [...canaisP13.slice(0, comercioIndex + 1), ...linhasProdutos, ...canaisP13.slice(comercioIndex + 1)]
        : [...canaisP13, ...linhasProdutos]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const totalCustos = custos.reduce((s, c) => s + c.valor, 0);
  const totalQtde = canais.reduce((s, c) => s + c.qtde, 0);
  const receitaBruta = canais.reduce((s, c) => s + c.totalRS, 0);
  const custoMatPrima = canais.reduce((s, c) => s + (c.precoCompra * c.qtde), 0);
  const lucroBruto = receitaBruta - custoMatPrima;
  const lucroLiquido = lucroBruto - totalCustos;
  const totalTonelagem = canais.reduce((s, c) => s + c.tonelagem, 0);
  const margemContribuicaoUnit = totalQtde > 0 ? (receitaBruta - custoMatPrima) / totalQtde : 0;
  const pontoEquilibrio = margemContribuicaoUnit > 0 ? Math.ceil(totalCustos / margemContribuicaoUnit) : 0;
  const mesLabel = format(new Date(Number(anoSelecionado), Number(mesSelecionado), 1), "MMMM yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase());

  const custosAgrupados = Object.entries(grupoLabels).reduce((acc, [key, label]) => {
    const items = custos.filter(c => c.grupo === key);
    if (items.length > 0) acc.push({ key, label, items, total: items.reduce((s, c) => s + c.valor, 0) });
    return acc;
  }, [] as { key: string; label: string; items: CustoItem[]; total: number }[]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    const loader = <PageSectionLoader label="Carregando resultado operacional..." />;
    if (embedded) return loader;
    return (
      <MainLayout>
        <Header title="Resultado Operacional" subtitle={mesLabel} />
        {loader}
      </MainLayout>
    );
  }

  const canaisP13 = canais.filter(c => c.tipo !== "produto");
  const produtosReferencia = canais.filter(c => c.tipo === "produto" && c.qtde > 0);
  const qtdP13 = canaisP13.reduce((s, c) => s + c.qtde, 0);
  const totalVendaP13 = canaisP13.reduce((s, c) => s + c.totalRS, 0);
  const totalCompraP13 = canaisP13.reduce((s, c) => s + (c.precoCompra * c.qtde), 0);
  const precoMedioVendaP13 = qtdP13 > 0 ? totalVendaP13 / qtdP13 : precoVendaP13;
  const precoMedioCompraP13 = qtdP13 > 0 ? totalCompraP13 / qtdP13 : precoCompraP13;
  const referenciasP13 = [
    { label: "Preço Médio Compra", value: fmt(precoMedioCompraP13) },
    { label: "Preço Médio Venda", value: fmt(precoMedioVendaP13) },
    { label: "Margem Bruta", value: fmt(precoMedioVendaP13 - precoMedioCompraP13), highlight: true },
  ];
  const referenciasProdutos = produtosReferencia.flatMap(p => [
    { label: `Preço Médio Compra ${p.canal}`, value: fmt(p.precoCompra) },
    { label: `Preço Médio Venda ${p.canal}`, value: fmt(p.precoVenda) },
    { label: `Margem Bruta ${p.canal}`, value: fmt(p.precoVenda - p.precoCompra), highlight: p.precoVenda >= p.precoCompra },
  ]);
  const referenciasGerais = [
    { label: "Tonelagem Total", value: `${totalTonelagem.toFixed(2)} ton` },
    { label: "Ticket Médio", value: totalQtde > 0 ? fmt(receitaBruta / totalQtde) : "0,00" },
    { label: "Margem Líquida", value: receitaBruta > 0 ? `${((lucroLiquido / receitaBruta) * 100).toFixed(1)}%` : "0,0%", highlight: lucroLiquido >= 0 },
  ];

  const content = (
    <div className="space-y-4 w-full min-w-0 max-w-full overflow-hidden">
      {/* Header / Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center w-full min-w-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <h2 className="text-base sm:text-lg font-bold tracking-tight uppercase leading-tight">Resultado Operacional</h2>
          <Badge variant="secondary" className="font-semibold text-xs sm:text-sm max-w-full truncate">{mesLabel}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:ml-auto sm:items-center w-full sm:w-auto min-w-0">
          <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
            <SelectTrigger className="w-full sm:w-36 h-10 sm:h-8 text-xs min-w-0"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              {mesesOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
            <SelectTrigger className="w-full sm:w-24 h-10 sm:h-8 text-xs min-w-0"><SelectValue placeholder="Ano" /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="h-10 sm:h-8 text-xs min-w-0" onClick={() => navigate("/config/categorias-despesa")}>
            <Settings2 className="h-3.5 w-3.5 mr-1" /> Categorias
          </Button>
          <Button variant="outline" size="sm" className="h-10 sm:h-8 text-xs min-w-0" onClick={() => exportROtoPdf(receitaBruta, custoMatPrima, lucroBruto, lucroLiquido, totalCustos, custosAgrupados, canais, mesLabel)}>
            <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="h-10 sm:h-8 text-xs min-w-0 col-span-2 sm:col-span-1" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Layout principal: 2 colunas - Custos à esquerda, Canais à direita */}
      <div className="grid grid-cols-2 gap-2 md:hidden">
        <Card className="border-border/60">
          <CardContent className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Receita</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">R$ {fmt(receitaBruta)}</p>
          </CardContent>
        </Card>
        <Card className={lucroLiquido >= 0 ? "border-success/25" : "border-destructive/25"}>
          <CardContent className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Resultado</p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${lucroLiquido >= 0 ? "text-success" : "text-destructive"}`}>
              R$ {lucroLiquido < 0 ? `(${fmt(Math.abs(lucroLiquido))})` : fmt(lucroLiquido)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Unidades</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{totalQtde.toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">PE</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{pontoEquilibrio.toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2 md:hidden">
        <Card className="overflow-hidden border-border/60 bg-card shadow-[var(--elev-1)]">
          <CardHeader className="border-b border-border/60 bg-muted/25 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold">Custos e despesas</CardTitle>
              <span className="text-sm font-bold tabular-nums text-destructive">R$ {fmt(totalCustos)}</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {custosAgrupados.map((grupo) => (
              <div key={grupo.key} className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-2.5 last:border-0">
                <span className="text-sm text-muted-foreground">{grupo.label}</span>
                <span className="font-semibold tabular-nums">R$ {fmt(grupo.total)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 bg-destructive/8 px-4 py-3">
              <span className="text-sm font-semibold">Total</span>
              <span className="font-bold tabular-nums text-destructive">R$ {fmt(totalCustos)}</span>
            </div>
          </CardContent>
        </Card>

        <details open className="overflow-hidden rounded-[var(--radius)] border border-border/60 bg-card shadow-[var(--elev-1)]">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Vendas por canal</summary>
          <div className="border-t border-border/60">
            {canais.slice(0, 6).map((canal) => (
              <div key={canal.canal} className="grid grid-cols-[1fr_auto] gap-3 border-b border-border/50 px-4 py-2.5 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{canal.canal}</p>
                  <p className="text-xs text-muted-foreground">{canal.qtde} un. | MC R$ {fmt(canal.margemRS)}</p>
                </div>
                <span className="font-semibold tabular-nums">R$ {fmt(canal.totalRS)}</span>
              </div>
            ))}
          </div>
        </details>
      </div>

      <div className="hidden gap-4 grid-cols-1 lg:grid-cols-2 w-full min-w-0 md:grid">
        {/* COLUNA ESQUERDA: Custos / Despesas */}
        <Card className="min-w-0 overflow-hidden border-border/60 bg-card/95 shadow-[var(--elev-2)]">
          <CardHeader className="border-b border-border/60 bg-muted/25 px-4 py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-widest">Custos / Despesas</CardTitle>
              <span className="text-xs font-bold">Valores</span>
            </div>
            {custosWidthInsufficient && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                <span>Largura insuficiente no celular: alguns nomes ou valores podem precisar de mais espaço.</span>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0 min-w-0 max-w-full overflow-hidden">
            <div ref={custosTableRef} className="w-full min-w-0 max-w-full overflow-visible">
              <Table className="w-full table-auto">
                <TableBody>
                  {custosAgrupados.map((grupo, gi) => (
                    <> 
                      {grupo.items.map((c, ci) => (
                        <TableRow key={c.id} className="border-border/50 hover:bg-muted/30">
                          <TableCell className="py-2 pl-3 pr-2 sm:px-4 text-xs border-r border-border/50 align-top">
                            <div className="flex items-start gap-1.5 min-w-0">
                              <span className="shrink-0 text-muted-foreground w-4 text-right text-[10px]">{gi * 10 + ci + 1}</span>
                              <span data-cost-overflow-check="true" className="min-w-0 break-words leading-snug">{c.nome}</span>
                              {c.valorReal > 0 && (
                                <span className="text-[9px] text-success bg-success/10 px-1 rounded">auto</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell data-cost-overflow-check="true" className={`w-[118px] sm:w-[132px] py-2 pl-2 pr-3 sm:px-4 text-right text-xs tabular-nums font-semibold whitespace-nowrap ${c.valor > 0 ? "" : "text-muted-foreground"}`}>
                            {c.valor > 0 ? `R$ ${fmt(c.valor)}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Subtotal do grupo */}
                      <TableRow className="bg-muted/45 border-t border-border/60">
                        <TableCell className="py-2 pl-3 pr-2 sm:px-4 text-xs font-bold border-r border-border/50 text-muted-foreground uppercase tracking-wider leading-snug">
                          {grupo.label}
                        </TableCell>
                        <TableCell className="py-2 pl-2 pr-3 sm:px-4 text-right text-xs tabular-nums font-bold whitespace-nowrap">
                          R$ {fmt(grupo.total)}
                        </TableCell>
                      </TableRow>
                    </>
                  ))}
                  {/* TOTAL GERAL */}
                  <TableRow className="bg-destructive/8 border-t-2 border-destructive/20">
                    <TableCell className="py-3 pl-3 pr-2 sm:px-4 font-bold text-sm border-r border-border/50">Total</TableCell>
                    <TableCell className="py-3 pl-2 pr-3 sm:px-4 text-right font-bold text-sm tabular-nums text-destructive whitespace-nowrap">
                      R$ {fmt(totalCustos)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* COLUNA DIREITA: Canais de Venda */}
        <Card className="min-w-0 overflow-hidden border-border/60 bg-card/95 shadow-[var(--elev-2)]">
          <CardHeader className="border-b border-border/60 bg-muted/25 px-4 py-3">
            <CardTitle className="text-xs font-bold uppercase tracking-widest">Vendas por Canal</CardTitle>
          </CardHeader>
          <CardContent className="p-0 min-w-0 max-w-full overflow-hidden">
            <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
            <Table className="min-w-[680px]">
              <TableHeader>
                <TableRow className="bg-muted/45">
                  <TableHead className="py-2 px-3 text-[10px] font-bold uppercase">Canal</TableHead>
                  <TableHead className="py-2 px-3 text-[10px] font-bold uppercase text-right">Qtde</TableHead>
                  <TableHead className="py-2 px-3 text-[10px] font-bold uppercase text-right">P. Venda</TableHead>
                  <TableHead className="py-2 px-3 text-[10px] font-bold uppercase text-right">Total R$</TableHead>
                  <TableHead className="py-2 px-3 text-[10px] font-bold uppercase text-right">P. Compra</TableHead>
                  <TableHead className="py-2 px-3 text-[10px] font-bold uppercase text-right">MC R$</TableHead>
                  <TableHead className="py-2 px-3 text-[10px] font-bold uppercase text-right">Ton.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {canais.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-xs">Nenhuma venda no período</TableCell></TableRow>
                ) : canais.map(c => (
                  <TableRow key={c.canal} className="border-border/50 hover:bg-muted/30">
                    <TableCell className="py-2 px-3 text-xs font-medium">{c.canal}</TableCell>
                    <TableCell className="py-2 px-3 text-xs text-right tabular-nums">{c.qtde}</TableCell>
                    <TableCell className="py-2 px-3 text-xs text-right tabular-nums">{fmt(c.precoVenda)}</TableCell>
                    <TableCell className="py-2 px-3 text-xs text-right tabular-nums font-semibold">{fmt(c.totalRS)}</TableCell>
                    <TableCell className="py-2 px-3 text-xs text-right tabular-nums">{fmt(c.precoCompra)}</TableCell>
                    <TableCell className="py-2 px-3 text-xs text-right tabular-nums font-semibold text-success">{fmt(c.margemRS)}</TableCell>
                    <TableCell className="py-2 px-3 text-xs text-right tabular-nums">{c.tonelagem.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {canais.length > 0 && (
                  <TableRow className="bg-muted/40 font-bold border-t-2">
                    <TableCell className="py-1.5 px-2 text-xs">Total</TableCell>
                    <TableCell className="py-1.5 px-2 text-xs text-right tabular-nums">{totalQtde}</TableCell>
                    <TableCell className="py-1.5 px-2 text-xs text-right"></TableCell>
                    <TableCell className="py-1.5 px-2 text-xs text-right tabular-nums">{fmt(receitaBruta)}</TableCell>
                    <TableCell className="py-1.5 px-2 text-xs text-right"></TableCell>
                    <TableCell className="py-1.5 px-2 text-xs text-right tabular-nums text-success">{fmt(receitaBruta - custoMatPrima)}</TableCell>
                    <TableCell className="py-1.5 px-2 text-xs text-right tabular-nums">{totalTonelagem.toFixed(2)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>

            {/* Resumo abaixo dos canais */}
            <div className="border-t mt-2 w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
              <Table className="min-w-[360px]">
                <TableBody>
                  <TableRow>
                    <TableCell className="py-1 px-3 text-xs font-semibold">Receita Bruta</TableCell>
                    <TableCell className="py-1 px-3 text-right text-xs font-bold tabular-nums">R$ {fmt(receitaBruta)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="py-1 px-3 text-xs font-semibold text-destructive">(-) Custo Mat. Prima</TableCell>
                    <TableCell className="py-1 px-3 text-right text-xs tabular-nums text-destructive">R$ {fmt(custoMatPrima)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/30">
                    <TableCell className="py-1 px-3 text-xs font-bold">Lucro Bruto</TableCell>
                    <TableCell className="py-1 px-3 text-right text-xs font-bold tabular-nums">R$ {fmt(lucroBruto)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="py-1 px-3 text-xs font-semibold text-destructive">(-) Custo / Despesa</TableCell>
                    <TableCell className="py-1 px-3 text-right text-xs tabular-nums text-destructive">R$ {fmt(totalCustos)}</TableCell>
                  </TableRow>
                  <TableRow className={lucroLiquido >= 0 ? "bg-success/10" : "bg-destructive/10"}>
                    <TableCell className="py-1.5 px-3 text-sm font-bold">Lucro Líquido</TableCell>
                    <TableCell className={`py-1.5 px-3 text-right text-sm font-bold tabular-nums ${lucroLiquido >= 0 ? "text-success" : "text-destructive"}`}>
                      R$ {lucroLiquido < 0 ? `(${fmt(Math.abs(lucroLiquido))})` : fmt(lucroLiquido)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="py-1 px-3 text-xs">Nota Crédito</TableCell>
                    <TableCell className="py-1 px-3 text-right text-xs tabular-nums text-muted-foreground">—</TableCell>
                  </TableRow>
                  <TableRow className={lucroLiquido >= 0 ? "bg-success/5 border-t-2" : "bg-destructive/5 border-t-2"}>
                    <TableCell className="py-2 px-3 text-sm font-bold">Resultado</TableCell>
                    <TableCell className={`py-2 px-3 text-right text-sm font-bold tabular-nums ${lucroLiquido >= 0 ? "text-success" : "text-destructive"}`}>
                      R$ {lucroLiquido < 0 ? `(${fmt(Math.abs(lucroLiquido))})` : fmt(lucroLiquido)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rodapé: Indicadores e Ponto de Equilíbrio */}
      <div className="hidden gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full min-w-0 md:grid">
        {/* Dados do Representante / Referência */}
        <Card className="min-w-0 overflow-hidden sm:col-span-2 lg:col-span-1">
          <CardHeader className="py-2 px-3 bg-muted/60 border-b">
            <CardTitle className="text-xs font-bold uppercase tracking-widest">Dados de Referência</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                <TableRow className="bg-muted/40">
                  <TableCell colSpan={2} className="py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    P13 por canal de venda
                  </TableCell>
                </TableRow>
                {referenciasP13.map((row, i) => (
                  <TableRow key={`p13-${i}`}>
                    <TableCell className="py-1.5 px-3 text-xs leading-snug">{row.label}</TableCell>
                    <TableCell className={`py-1.5 px-3 text-right text-xs tabular-nums font-medium whitespace-nowrap ${row.highlight ? "text-success" : ""}`}>
                      {row.value}
                    </TableCell>
                  </TableRow>
                ))}
                {referenciasProdutos.length > 0 && (
                  <TableRow className="bg-muted/40">
                    <TableCell colSpan={2} className="py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Demais produtos: P20, P45, água, regulador e galão vazio
                    </TableCell>
                  </TableRow>
                )}
                {referenciasProdutos.map((row, i) => (
                  <TableRow key={`produto-${i}`}>
                    <TableCell className="py-1.5 px-3 text-xs leading-snug">{row.label}</TableCell>
                    <TableCell className={`py-1.5 px-3 text-right text-xs tabular-nums font-medium whitespace-nowrap ${row.highlight ? "text-success" : ""}`}>
                      {row.value}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40">
                  <TableCell colSpan={2} className="py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Indicadores gerais
                  </TableCell>
                </TableRow>
                {referenciasGerais.map((row, i) => (
                  <TableRow key={`geral-${i}`}>
                    <TableCell className="py-1.5 px-3 text-xs leading-snug">{row.label}</TableCell>
                    <TableCell className={`py-1.5 px-3 text-right text-xs tabular-nums font-medium whitespace-nowrap ${row.highlight ? "text-success" : ""}`}>
                      {row.value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Ponto de Equilíbrio */}
        <Card className="flex min-w-0 flex-col items-center justify-center py-6 px-3 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Ponto de Equilíbrio</p>
          <p className="text-3xl font-black tabular-nums text-primary">{pontoEquilibrio.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground">unidades / mês</p>
        </Card>

        {/* Qtde Disk / Direta */}
        <Card className="flex min-w-0 flex-col items-center justify-center py-6 px-3 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Qtde Vendida Total</p>
          <p className="text-3xl font-black tabular-nums">{totalQtde.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground">unidades no período</p>
        </Card>
      </div>
    </div>
  );

  if (embedded) return content;
  return (
    <MainLayout>
      <Header title="Resultado Operacional" subtitle={mesLabel} />
      <div className="p-3 md:p-6 w-full min-w-0 max-w-full overflow-x-hidden">{content}</div>
    </MainLayout>
  );
}

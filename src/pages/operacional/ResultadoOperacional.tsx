import React, { useEffect, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageSectionLoader } from "@/components/ui/page-loader";
import { AlertTriangle, Settings2, FileDown, Printer } from "lucide-react";
import { FluxoLateralPanel } from "@/components/ro/FluxoLateralPanel";
import { RoExcelButton } from "@/components/ro/RoExcelButton";
import { CustosDetalhamentoDialog } from "@/components/ro/CustosDetalhamentoDialog";
import { exportROtoPdf, handlePrint } from "@/services/reportPdfService";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useROComplemento } from "@/hooks/useROComplemento";
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

const isTransferenciaInterna = (categoria?: string | null, descricao?: string | null) => {
  const text = `${categoria || ""} ${descricao || ""}`.toLowerCase();
  return text.includes("depósito banc") || text.includes("deposito banc") || text.includes("transferência caixa") || text.includes("transferencia caixa");
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
  const [detalheOpen, setDetalheOpen] = useState(false);
  const { fluxo, ajustes, salvarAjuste, loading: loadingRO } = useROComplemento(
    unidadeAtual?.id,
    Number(anoSelecionado),
    Number(mesSelecionado),
  );

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
        despesasCaixaRes,
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
        supabase.from("produtos").select("id, nome, preco, preco_custo"),
      ]);

      const pedidos = pedidosRes.data || [];
      const contasPagar = contasPagarRes.data || [];
      const despesasCaixa = (despesasCaixaRes.data || []).filter((d: any) => !isTransferenciaInterna(d.categoria, d.descricao));

      const cpPorCategoria: Record<string, number> = {};
      contasPagar.forEach(cp => {
        const cat = (cp.categoria || cp.descricao || "Diversos").toString().toLowerCase().trim();
        cpPorCategoria[cat] = (cpPorCategoria[cat] || 0) + (Number(cp.valor) || 0);
      });
      despesasCaixa.forEach((despesa: any) => {
        const cat = (despesa.categoria || despesa.descricao || "Despesas do Caixa").toString().toLowerCase().trim();
        cpPorCategoria[cat] = (cpPorCategoria[cat] || 0) + (Number(despesa.valor) || 0);
      });

      const categoriasCorrespondidas = new Set<string>();
      const custosCalculados: CustoItem[] = ((categorias || []) as any[]).map(cat => {
        let valorReal = 0;
        const nomeLC = cat.nome.toLowerCase().trim();
        for (const [cpCat, val] of Object.entries(cpPorCategoria)) {
          if (cpCat === nomeLC || cpCat.includes(nomeLC) || nomeLC.includes(cpCat) ||
            (nomeLC.length >= 5 && cpCat.includes(nomeLC.substring(0, 5))) ||
            (cpCat.length >= 5 && nomeLC.includes(cpCat.substring(0, 5)))) {
            valorReal += val;
            categoriasCorrespondidas.add(cpCat);
          }
        }
        return { id: cat.id, nome: cat.nome, valor: valorReal || cat.valor_padrao || 0, valorReal, grupo: cat.grupo, tipo: cat.tipo };
      });

      Object.entries(cpPorCategoria).forEach(([categoria, valor]) => {
        if (categoriasCorrespondidas.has(categoria) || valor <= 0) return;
        custosCalculados.push({
          id: `caixa-${categoria}`,
          nome: `Despesa caixa: ${categoria.replace(/^\w/, c => c.toUpperCase())}`,
          valor,
          valorReal: valor,
          grupo: "diversos",
          tipo: "variavel",
        });
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
  const custosSemGrupo = custos.filter(c => !Object.prototype.hasOwnProperty.call(grupoLabels, c.grupo));
  if (custosSemGrupo.length > 0) {
    custosAgrupados.push({
      key: "outros_custos",
      label: "Outros custos",
      items: custosSemGrupo,
      total: custosSemGrupo.reduce((s, c) => s + c.valor, 0),
    });
  }

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

  const resultadoFinal = lucroLiquido + (ajustes.nota_credito?.valor || 0);
  const margemLiquidaPct = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;
  const margemBrutaPct = receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0;
  const totalMcCanais = canaisP13.reduce((s, c) => s + c.margemRS, 0);
  const canaisRanked = canaisP13
    .filter((c) => c.qtde > 0)
    .sort((a, b) => b.margemRS - a.margemRS);
  const isPositivo = resultadoFinal >= 0;

  const handleCardKey = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
  };

  const content = (
    <div className="font-['Manrope'] space-y-5 w-full min-w-0 max-w-full overflow-hidden">
      {/* ============ FILTROS ============ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center w-full min-w-0">
        <div className="hidden sm:flex flex-wrap items-center gap-2 min-w-0">
          <h2 className="font-['Sora'] text-lg sm:text-xl font-bold tracking-tight text-foreground leading-tight">
            Resultado Operacional
          </h2>
          <Badge variant="secondary" className="font-semibold text-xs sm:text-sm max-w-full truncate bg-[#064e3b]/10 text-[#064e3b] border-[#064e3b]/20">
            {mesLabel}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:ml-auto sm:items-center w-full sm:w-auto min-w-0">
          <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
            <SelectTrigger aria-label="Selecionar mês" className="w-full sm:w-36 min-h-11 sm:min-h-9 text-sm min-w-0"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              {mesesOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
            <SelectTrigger aria-label="Selecionar ano" className="w-full sm:w-24 min-h-11 sm:min-h-9 text-sm min-w-0"><SelectValue placeholder="Ano" /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" aria-label="Configurar categorias de despesa" className="min-h-11 sm:min-h-9 text-xs min-w-0" onClick={() => navigate("/config/categorias-despesa")}>
            <Settings2 className="h-4 w-4 mr-1" aria-hidden="true" /> Categorias
          </Button>
          <Button variant="outline" size="sm" aria-label="Exportar em PDF" className="min-h-11 sm:min-h-9 text-xs min-w-0" onClick={() => exportROtoPdf(receitaBruta, custoMatPrima, lucroBruto, lucroLiquido, totalCustos, custosAgrupados, canais, mesLabel)}>
            <FileDown className="h-4 w-4 mr-1" aria-hidden="true" /> PDF
          </Button>
          <RoExcelButton unidadeId={unidadeAtual?.id} unidadeNome={unidadeAtual?.nome} ano={Number(anoSelecionado)} mes={Number(mesSelecionado)} />
          <Button variant="outline" size="sm" aria-label="Imprimir relatório" className="min-h-11 sm:min-h-9 text-xs min-w-0 col-span-2 sm:col-span-1" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" aria-hidden="true" /> Imprimir
          </Button>
        </div>
      </div>

      {/* ============ HERO MAGAZINE — RESULTADO LÍQUIDO ============ */}
      <section
        aria-labelledby="ro-hero-title"
        className="relative overflow-hidden rounded-2xl border border-[#064e3b]/30 shadow-lg"
        style={{
          background:
            "radial-gradient(120% 120% at 100% 0%, rgba(201,168,76,0.18) 0%, rgba(13,122,95,0) 45%), linear-gradient(135deg, #064e3b 0%, #0d7a5f 60%, #064e3b 100%)",
        }}
      >
        {/* Gold hairline top */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent opacity-70" aria-hidden="true" />

        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* LADO A — Resultado Líquido gigante */}
          <div className="min-w-0">
            <p className="font-['Sora'] text-[10px] font-bold uppercase tracking-[0.25em] text-[#c9a84c]">
              Resultado do Período
            </p>
            <h3 id="ro-hero-title" className="mt-1 text-sm font-medium text-[#f5f0e0]/70">
              {mesLabel} · {unidadeAtual?.nome || "Empresa"}
            </h3>
            <p
              className={`mt-3 font-['Sora'] font-black tabular-nums leading-none tracking-tight ${
                isPositivo ? "text-[#f5f0e0]" : "text-[#fca5a5]"
              }`}
              style={{ fontSize: "clamp(2.25rem, 6vw, 4.25rem)" }}
              aria-live="polite"
            >
              {isPositivo ? "" : "-"} R$ {fmt(Math.abs(resultadoFinal))}
            </p>
            <p className={`mt-2 text-sm font-semibold ${isPositivo ? "text-[#c9a84c]" : "text-[#fca5a5]"}`}>
              {isPositivo ? "▲" : "▼"} Margem líquida {margemLiquidaPct.toFixed(1)}%
              <span className="ml-2 font-normal text-[#f5f0e0]/60">
                · {totalQtde.toLocaleString("pt-BR")} unidades vendidas
              </span>
            </p>

            {/* Mini KPIs em linha */}
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Receita Bruta", value: `R$ ${fmt(receitaBruta)}` },
                { label: "Lucro Bruto", value: `R$ ${fmt(lucroBruto)}`, sub: `${margemBrutaPct.toFixed(1)}%` },
                { label: "Despesas", value: `R$ ${fmt(totalCustos)}` },
                { label: "Ponto Equilíbrio", value: `${pontoEquilibrio.toLocaleString("pt-BR")} un` },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border border-[#f5f0e0]/15 bg-[#f5f0e0]/5 backdrop-blur px-3 py-2.5">
                  <dt className="font-['Sora'] text-[10px] font-semibold uppercase tracking-wider text-[#f5f0e0]/60">
                    {k.label}
                  </dt>
                  <dd className="mt-0.5 font-['Sora'] text-base font-bold tabular-nums text-[#f5f0e0]">
                    {k.value}
                  </dd>
                  {k.sub && <dd className="text-[10px] font-medium text-[#c9a84c]">{k.sub}</dd>}
                </div>
              ))}
            </dl>
          </div>

          {/* LADO B — Cascata vertical Receita → Resultado */}
          <div className="min-w-0 rounded-xl border border-[#f5f0e0]/15 bg-[#0a3d2f]/40 backdrop-blur p-4 sm:p-5">
            <p className="font-['Sora'] text-[10px] font-bold uppercase tracking-[0.2em] text-[#c9a84c] mb-3">
              Cascata do Resultado
            </p>
            <ol className="space-y-2.5">
              {[
                { label: "Receita Bruta", value: receitaBruta, tone: "pos" as const, weight: 1 },
                { label: "(−) Custo Mat. Prima", value: -custoMatPrima, tone: "neg" as const, weight: receitaBruta ? custoMatPrima / receitaBruta : 0 },
                { label: "= Lucro Bruto", value: lucroBruto, tone: "acc" as const, weight: receitaBruta ? Math.max(0, lucroBruto) / receitaBruta : 0, strong: true },
                { label: "(−) Despesas Operacionais", value: -totalCustos, tone: "neg" as const, weight: receitaBruta ? totalCustos / receitaBruta : 0 },
                { label: "= Lucro Líquido", value: lucroLiquido, tone: lucroLiquido >= 0 ? "acc" : "neg" as const, weight: receitaBruta ? Math.max(0, Math.abs(lucroLiquido)) / receitaBruta : 0, strong: true },
              ].map((row) => (
                <li key={row.label} className="min-w-0">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className={`truncate ${row.strong ? "font-['Sora'] font-bold text-[#f5f0e0]" : "text-[#f5f0e0]/85"}`}>
                      {row.label}
                    </span>
                    <span
                      className={`font-['Sora'] font-bold tabular-nums whitespace-nowrap ${
                        row.tone === "pos" ? "text-[#f5f0e0]" :
                        row.tone === "neg" ? "text-[#fca5a5]" : "text-[#c9a84c]"
                      }`}
                    >
                      {row.value < 0 ? `-R$ ${fmt(Math.abs(row.value))}` : `R$ ${fmt(row.value)}`}
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-[#f5f0e0]/8 overflow-hidden" aria-hidden="true">
                    <div
                      className={`h-full rounded-full ${
                        row.tone === "pos" ? "bg-[#f5f0e0]/70" :
                        row.tone === "neg" ? "bg-[#fca5a5]/70" : "bg-[#c9a84c]"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(2, row.weight * 100))}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ============ MOBILE: Custos + Vendas resumidos ============ */}
      <div className="space-y-3 md:hidden">
        <Card
          role="button"
          tabIndex={0}
          aria-label={`Abrir detalhamento de custos e despesas, total R$ ${fmt(totalCustos)}`}
          onClick={() => setDetalheOpen(true)}
          onKeyDown={handleCardKey(() => setDetalheOpen(true))}
          className="overflow-hidden border-[#064e3b]/20 bg-card focus-visible:ring-2 focus-visible:ring-[#c9a84c] focus-visible:outline-none cursor-pointer"
        >
          <CardHeader className="border-b border-[#064e3b]/15 bg-[#064e3b]/5 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="font-['Sora'] text-sm font-semibold text-[#064e3b]">
                Custos e Despesas
                <span className="ml-2 text-[10px] font-normal text-muted-foreground">(toque p/ detalhar)</span>
              </CardTitle>
              <span className="font-['Sora'] text-base font-bold tabular-nums text-destructive">R$ {fmt(totalCustos)}</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {custosAgrupados.map((grupo) => (
              <div key={grupo.key} className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-2.5 last:border-0">
                <span className="text-sm text-muted-foreground">{grupo.label}</span>
                <span className="font-semibold tabular-nums text-foreground">R$ {fmt(grupo.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ============ DESKTOP: 2 colunas Custos | Vendas ============ */}
      <div className="hidden md:grid gap-5 grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] w-full min-w-0">
        {/* CUSTOS */}
        <Card
          role="button"
          tabIndex={0}
          aria-label={`Abrir detalhamento de custos, total R$ ${fmt(totalCustos)}`}
          onClick={() => setDetalheOpen(true)}
          onKeyDown={handleCardKey(() => setDetalheOpen(true))}
          className="min-w-0 overflow-hidden border-[#064e3b]/20 bg-card shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#c9a84c] focus-visible:outline-none transition cursor-pointer"
        >
          <CardHeader className="border-b border-[#064e3b]/15 bg-gradient-to-r from-[#064e3b]/8 to-transparent px-4 py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-['Sora'] text-xs font-bold uppercase tracking-[0.15em] text-[#064e3b]">
                Custos / Despesas
                <span className="ml-2 text-[10px] font-normal normal-case tracking-normal text-muted-foreground">(clique para detalhar)</span>
              </CardTitle>
              <span className="font-['Sora'] text-xs font-bold tracking-widest uppercase text-[#c9a84c]">Valores</span>
            </div>
            {custosWidthInsufficient && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" aria-hidden="true" />
                <span>Largura insuficiente: alguns nomes ou valores podem precisar de mais espaço.</span>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div ref={custosTableRef} className="w-full min-w-0 max-w-full">
              <Table className="w-full table-auto">
                <TableBody>
                  {custosAgrupados.map((grupo, gi) => (
                    <React.Fragment key={grupo.key}>
                      {grupo.items.map((c, ci) => (
                        <TableRow key={c.id} className="border-border/40 hover:bg-[#064e3b]/5">
                          <TableCell className="py-2 pl-4 pr-2 text-xs align-top">
                            <div className="flex items-start gap-2 min-w-0">
                              <span className="shrink-0 text-muted-foreground w-5 text-right text-[10px] tabular-nums">{gi * 10 + ci + 1}</span>
                              <span data-cost-overflow-check="true" className="min-w-0 break-words leading-snug">{c.nome}</span>
                              {c.valorReal > 0 && (
                                <span className="text-[9px] font-semibold text-[#064e3b] bg-[#c9a84c]/25 px-1.5 py-0.5 rounded" aria-label="Valor automático">auto</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell data-cost-overflow-check="true" className={`w-[130px] py-2 pl-2 pr-4 text-right text-xs tabular-nums font-semibold whitespace-nowrap ${c.valor > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                            {c.valor > 0 ? `R$ ${fmt(c.valor)}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-[#064e3b]/6 border-t border-[#064e3b]/15">
                        <TableCell className="py-2 pl-4 pr-2 text-[11px] font-bold uppercase tracking-wider text-[#064e3b]">
                          {grupo.label}
                        </TableCell>
                        <TableCell className="py-2 pl-2 pr-4 text-right text-xs tabular-nums font-bold whitespace-nowrap text-[#064e3b]">
                          R$ {fmt(grupo.total)}
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                  <TableRow className="bg-destructive/8 border-t-2 border-destructive/25">
                    <TableCell className="py-3 pl-4 pr-2 font-['Sora'] font-bold text-sm">Total</TableCell>
                    <TableCell className="py-3 pl-2 pr-4 text-right font-['Sora'] font-bold text-sm tabular-nums text-destructive whitespace-nowrap">
                      R$ {fmt(totalCustos)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* VENDAS POR CANAL */}
        <Card className="min-w-0 overflow-hidden border-[#064e3b]/20 bg-card shadow-sm">
          <CardHeader className="border-b border-[#064e3b]/15 bg-gradient-to-r from-[#064e3b]/8 to-transparent px-4 py-3">
            <CardTitle className="font-['Sora'] text-xs font-bold uppercase tracking-[0.15em] text-[#064e3b]">
              Vendas por Canal
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 min-w-0 max-w-full overflow-hidden">
            <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
              <Table className="min-w-[680px]">
                <TableHeader>
                  <TableRow className="bg-[#064e3b]/6 border-b border-[#064e3b]/15 hover:bg-[#064e3b]/6">
                    <TableHead className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[#064e3b]">Canal</TableHead>
                    <TableHead className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[#064e3b] text-right">Qtde</TableHead>
                    <TableHead className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[#064e3b] text-right">P. Venda</TableHead>
                    <TableHead className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[#064e3b] text-right">Total R$</TableHead>
                    <TableHead className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[#064e3b] text-right">P. Compra</TableHead>
                    <TableHead className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[#064e3b] text-right">MC R$</TableHead>
                    <TableHead className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[#064e3b] text-right">Ton.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {canais.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10 text-xs">Nenhuma venda no período</TableCell></TableRow>
                  ) : canais.map(c => (
                    <TableRow key={c.canal} className="border-border/40 hover:bg-[#064e3b]/5">
                      <TableCell className="py-2 px-3 text-xs font-medium">{c.canal}</TableCell>
                      <TableCell className="py-2 px-3 text-xs text-right tabular-nums">{c.qtde}</TableCell>
                      <TableCell className="py-2 px-3 text-xs text-right tabular-nums">{fmt(c.precoVenda)}</TableCell>
                      <TableCell className="py-2 px-3 text-xs text-right tabular-nums font-semibold">{fmt(c.totalRS)}</TableCell>
                      <TableCell className="py-2 px-3 text-xs text-right tabular-nums text-muted-foreground">{fmt(c.precoCompra)}</TableCell>
                      <TableCell className={`py-2 px-3 text-xs text-right tabular-nums font-semibold ${c.margemRS >= 0 ? "text-[#0d7a5f]" : "text-destructive"}`}>{fmt(c.margemRS)}</TableCell>
                      <TableCell className="py-2 px-3 text-xs text-right tabular-nums">{c.tonelagem.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {canais.length > 0 && (
                    <TableRow className="bg-[#064e3b]/8 font-bold border-t-2 border-[#064e3b]/25">
                      <TableCell className="py-2 px-3 text-xs font-['Sora'] text-[#064e3b]">Total</TableCell>
                      <TableCell className="py-2 px-3 text-xs text-right tabular-nums text-[#064e3b]">{totalQtde}</TableCell>
                      <TableCell className="py-2 px-3"></TableCell>
                      <TableCell className="py-2 px-3 text-xs text-right tabular-nums text-[#064e3b]">{fmt(receitaBruta)}</TableCell>
                      <TableCell className="py-2 px-3"></TableCell>
                      <TableCell className="py-2 px-3 text-xs text-right tabular-nums text-[#0d7a5f]">{fmt(receitaBruta - custoMatPrima)}</TableCell>
                      <TableCell className="py-2 px-3 text-xs text-right tabular-nums text-[#064e3b]">{totalTonelagem.toFixed(2)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============ PARTICIPAÇÃO POR CANAL (SHARE) ============ */}
      {canaisRanked.length > 0 && (
        <Card className="border-[#064e3b]/20 bg-card shadow-sm">
          <CardHeader className="border-b border-[#064e3b]/15 bg-gradient-to-r from-[#064e3b]/8 to-transparent px-4 py-3">
            <CardTitle className="font-['Sora'] text-xs font-bold uppercase tracking-[0.15em] text-[#064e3b]">
              Participação por Canal (Share da Margem)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ul className="space-y-2.5">
              {canaisRanked.map((c, idx) => {
                const pct = totalMcCanais > 0 ? (c.margemRS / totalMcCanais) * 100 : 0;
                return (
                  <li key={c.canal} className="min-w-0">
                    <div className="flex items-center justify-between gap-3 text-sm mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-['Sora'] w-6 shrink-0 text-[11px] font-bold text-[#c9a84c] tabular-nums">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className="truncate font-medium text-foreground">{c.canal}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-muted-foreground tabular-nums">{c.qtde} un</span>
                        <span className="font-['Sora'] text-sm font-bold tabular-nums text-[#064e3b]">{pct.toFixed(1)}%</span>
                        <span className="hidden sm:inline text-xs tabular-nums text-muted-foreground w-24 text-right">R$ {fmt(c.margemRS)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#0d7a5f] to-[#c9a84c]"
                        style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ============ FLUXO LATERAL (Entradas/Saídas/Estoque valorizado) ============ */}
      {unidadeAtual?.id && (
        <FluxoLateralPanel
          fluxo={fluxo}
          ajustes={ajustes}
          onSave={salvarAjuste}
          loading={loadingRO}
        />
      )}

      {/* ============ DADOS DE REFERÊNCIA + INDICADORES ============ */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 w-full min-w-0">
        <Card className="min-w-0 overflow-hidden md:col-span-2 lg:col-span-1 border-[#064e3b]/20 shadow-sm">
          <CardHeader className="border-b border-[#064e3b]/15 bg-gradient-to-r from-[#064e3b]/8 to-transparent px-4 py-3">
            <CardTitle className="font-['Sora'] text-xs font-bold uppercase tracking-[0.15em] text-[#064e3b]">
              Dados de Referência
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                <TableRow className="bg-[#064e3b]/6">
                  <TableCell colSpan={2} className="py-1.5 px-4 text-[10px] font-bold uppercase tracking-wider text-[#064e3b]">
                    P13 por canal de venda
                  </TableCell>
                </TableRow>
                {referenciasP13.map((row, i) => (
                  <TableRow key={`p13-${i}`}>
                    <TableCell className="py-1.5 px-4 text-xs leading-snug">{row.label}</TableCell>
                    <TableCell className={`py-1.5 px-4 text-right text-xs tabular-nums font-semibold whitespace-nowrap ${row.highlight ? "text-[#0d7a5f]" : ""}`}>
                      {row.value}
                    </TableCell>
                  </TableRow>
                ))}
                {referenciasProdutos.length > 0 && (
                  <TableRow className="bg-[#064e3b]/6">
                    <TableCell colSpan={2} className="py-1.5 px-4 text-[10px] font-bold uppercase tracking-wider text-[#064e3b]">
                      Demais produtos: P20, P45, água, regulador e galão vazio
                    </TableCell>
                  </TableRow>
                )}
                {referenciasProdutos.map((row, i) => (
                  <TableRow key={`produto-${i}`}>
                    <TableCell className="py-1.5 px-4 text-xs leading-snug">{row.label}</TableCell>
                    <TableCell className={`py-1.5 px-4 text-right text-xs tabular-nums font-semibold whitespace-nowrap ${row.highlight ? "text-[#0d7a5f]" : ""}`}>
                      {row.value}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-[#064e3b]/6">
                  <TableCell colSpan={2} className="py-1.5 px-4 text-[10px] font-bold uppercase tracking-wider text-[#064e3b]">
                    Indicadores gerais
                  </TableCell>
                </TableRow>
                {referenciasGerais.map((row, i) => (
                  <TableRow key={`geral-${i}`}>
                    <TableCell className="py-1.5 px-4 text-xs leading-snug">{row.label}</TableCell>
                    <TableCell className={`py-1.5 px-4 text-right text-xs tabular-nums font-semibold whitespace-nowrap ${row.highlight ? "text-[#0d7a5f]" : ""}`}>
                      {row.value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="flex min-w-0 flex-col items-center justify-center py-8 px-4 text-center border-[#064e3b]/20 shadow-sm bg-gradient-to-br from-white to-[#c9a84c]/5">
          <p className="font-['Sora'] text-[10px] text-[#064e3b] uppercase tracking-[0.2em] font-bold mb-2">Ponto de Equilíbrio</p>
          <p className="font-['Sora'] text-4xl font-black tabular-nums text-[#064e3b]">{pontoEquilibrio.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-1">unidades / mês</p>
        </Card>

        <Card className="flex min-w-0 flex-col items-center justify-center py-8 px-4 text-center border-[#064e3b]/20 shadow-sm bg-gradient-to-br from-white to-[#0d7a5f]/5">
          <p className="font-['Sora'] text-[10px] text-[#064e3b] uppercase tracking-[0.2em] font-bold mb-2">Qtde Vendida Total</p>
          <p className="font-['Sora'] text-4xl font-black tabular-nums text-[#0d7a5f]">{totalQtde.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-1">unidades no período</p>
        </Card>
      </div>

      <CustosDetalhamentoDialog
        open={detalheOpen}
        onClose={() => setDetalheOpen(false)}
        unidadeId={unidadeAtual?.id}
        mes={Number(mesSelecionado)}
        ano={Number(anoSelecionado)}
        mesLabel={mesLabel}
      />
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


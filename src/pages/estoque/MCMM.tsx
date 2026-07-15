import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Package, TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { subDays, startOfDay, differenceInDays } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { EstoqueKpiCard } from "@/components/estoque/EstoqueKpiCard";
import { EstoquePageHeader } from "@/components/estoque/EstoquePageHeader";

const TEMPO_REPOSICAO_PADRAO = 3; // dias
const MARGEM_SEGURANCA = 1.5;

interface ProdutoMCMM {
  id: string;
  nome: string;
  categoria: string | null;
  tipo_botijao: string | null;
  estoque: number;
  mediaConsumo: number;
  estoqueMinimo: number;
  estoqueMaximo: number;
  pontoReposicao: number;
  coberturaDias: number;
  status: "ok" | "alerta" | "critico" | "excesso";
}

export default function MCMM() {
  const { unidadeAtual } = useUnidade();

  const { data: produtos = [] } = useQuery({
    queryKey: ["mcmm-produtos", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("produtos").select("id, nome, categoria, tipo_botijao, estoque").eq("ativo", true);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: vendasRaw = [] } = useQuery({
    queryKey: ["mcmm-vendas", unidadeAtual?.id],
    queryFn: async () => {
      const desde = subDays(new Date(), 90);
      let q = supabase
        .from("pedido_itens")
        .select("produto_id, quantidade, pedidos!inner(created_at, status, unidade_id)")
        .gte("pedidos.created_at", startOfDay(desde).toISOString())
        .neq("pedidos.status", "cancelado");
      if (unidadeAtual?.id) q = q.eq("pedidos.unidade_id", unidadeAtual.id);
      const { data } = await q;
      return (data || []) as any[];
    },
  });

  const analise: ProdutoMCMM[] = useMemo(() => {
    // Agrupar vendas por produto nos últimos 90 dias
    const vendasPorProduto: Record<string, number> = {};
    vendasRaw.forEach((v: any) => {
      vendasPorProduto[v.produto_id] = (vendasPorProduto[v.produto_id] || 0) + v.quantidade;
    });

    const diasPeriodo = 90;

    return produtos
      .filter((p: any) => p.tipo_botijao !== "vazio") // Não analisar vazios
      .map((p: any) => {
        const totalVendas = vendasPorProduto[p.id] || 0;
        const mediaConsumo = +(totalVendas / diasPeriodo).toFixed(2);
        const estoqueMinimo = Math.ceil(mediaConsumo * TEMPO_REPOSICAO_PADRAO);
        const pontoReposicao = Math.ceil(estoqueMinimo * MARGEM_SEGURANCA);
        const estoqueMaximo = Math.ceil(pontoReposicao + mediaConsumo * 7); // 7 dias extra
        const coberturaDias = mediaConsumo > 0 ? Math.round((p.estoque || 0) / mediaConsumo) : 999;

        let status: ProdutoMCMM["status"] = "ok";
        if ((p.estoque || 0) <= estoqueMinimo) status = "critico";
        else if ((p.estoque || 0) <= pontoReposicao) status = "alerta";
        else if ((p.estoque || 0) > estoqueMaximo * 1.2) status = "excesso";

        return {
          id: p.id,
          nome: p.nome,
          categoria: p.categoria,
          tipo_botijao: p.tipo_botijao,
          estoque: p.estoque || 0,
          mediaConsumo,
          estoqueMinimo,
          estoqueMaximo,
          pontoReposicao,
          coberturaDias,
          status,
        };
      })
      .sort((a, b) => a.coberturaDias - b.coberturaDias);
  }, [produtos, vendasRaw]);

  const kpis = useMemo(() => {
    const estoqueTotal = analise.reduce((s, p) => s + p.estoque, 0);
    const mediaConsumoTotal = analise.reduce((s, p) => s + p.mediaConsumo, 0);
    const cobertura = mediaConsumoTotal > 0 ? +(estoqueTotal / mediaConsumoTotal).toFixed(1) : 0;
    const criticos = analise.filter((p) => p.status === "critico").length;
    const alertas = analise.filter((p) => p.status === "alerta").length;
    return { estoqueTotal, mediaConsumoTotal: +mediaConsumoTotal.toFixed(1), cobertura, criticos, alertas };
  }, [analise]);

  const chartData = analise.slice(0, 15).map((p) => ({
    nome: p.nome.length > 18 ? p.nome.slice(0, 18) + "…" : p.nome,
    estoque: p.estoque,
    minimo: p.estoqueMinimo,
    pontoRepo: p.pontoReposicao,
  }));

  const statusBadge = (status: ProdutoMCMM["status"]) => {
    const map = {
      ok: { label: "OK", className: "bg-success/15 text-success border-success/30" },
      alerta: { label: "Alerta", className: "bg-warning/15 text-warning border-warning/30" },
      critico: { label: "Crítico", className: "bg-destructive/15 text-destructive border-destructive/30" },
      excesso: { label: "Excesso", className: "bg-info/15 text-info border-info/30" },
    };
    const m = map[status];
    return <Badge variant="outline" className={m.className}>{m.label}</Badge>;
  };

  return (
    <MainLayout>
      <Header title="MCMM Inteligente" subtitle="Mínimo, Cobertura, Máximo e Ponto de Reposição — calculados automaticamente" />
      <div className="p-3 sm:p-6 space-y-6">
        <EstoquePageHeader
          title="Análise de reposição"
          description="Baseada nas vendas dos últimos 90 dias"
        />

        {/* KPIs */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-5">
          <EstoqueKpiCard icon={Package} label="Estoque Total" value={kpis.estoqueTotal} tone="primary" />
          <EstoqueKpiCard icon={TrendingUp} label="Consumo/Dia" value={kpis.mediaConsumoTotal} tone="info" />
          <EstoqueKpiCard icon={Clock} label="Cobertura" value={`${kpis.cobertura}d`} tone="secondary" />
          <EstoqueKpiCard icon={AlertTriangle} label="Críticos" value={kpis.criticos} tone={kpis.criticos > 0 ? "destructive" : "secondary"} />
          <EstoqueKpiCard icon={ShieldCheck} label="Alertas" value={kpis.alertas} tone={kpis.alertas > 0 ? "warning" : "secondary"} />
        </div>


        {/* Chart */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Estoque vs Limites</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs fill-muted-foreground" />
                <YAxis type="category" dataKey="nome" width={140} className="text-xs fill-muted-foreground" />
                <Tooltip />
                <Bar dataKey="estoque" fill="hsl(var(--primary))" name="Estoque Atual" radius={[0, 4, 4, 0]} />
                <Bar dataKey="minimo" fill="hsl(var(--destructive))" name="Est. Mínimo" radius={[0, 4, 4, 0]} opacity={0.5} />
                <Bar dataKey="pontoRepo" fill="hsl(var(--chart-4))" name="Ponto Reposição" radius={[0, 4, 4, 0]} opacity={0.5} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tabela MCMM */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Análise Completa MCMM</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Estoque</TableHead>
                    <TableHead className="text-center">Consumo/Dia</TableHead>
                    <TableHead className="text-center">Est. Mínimo</TableHead>
                    <TableHead className="text-center">Ponto Repo.</TableHead>
                    <TableHead className="text-center">Est. Máximo</TableHead>
                    <TableHead className="text-center">Cobertura</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analise.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum produto para análise</TableCell></TableRow>
                  ) : analise.map((p) => (
                    <TableRow key={p.id} className={p.status === "critico" ? "bg-destructive/5" : p.status === "alerta" ? "bg-yellow-50 dark:bg-yellow-950/10" : ""}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell className="text-center font-bold">{p.estoque}</TableCell>
                      <TableCell className="text-center">{p.mediaConsumo}</TableCell>
                      <TableCell className="text-center">{p.estoqueMinimo}</TableCell>
                      <TableCell className="text-center">{p.pontoReposicao}</TableCell>
                      <TableCell className="text-center">{p.estoqueMaximo}</TableCell>
                      <TableCell className="text-center font-bold">{p.coberturaDias === 999 ? "∞" : `${p.coberturaDias}d`}</TableCell>
                      <TableCell className="text-center">{statusBadge(p.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Fórmulas */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Fórmulas Utilizadas</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="p-3 rounded-lg bg-muted">
                <p className="font-medium text-sm">Est. Mínimo</p>
                <p className="text-xs text-muted-foreground">= Consumo/Dia × Tempo Reposição ({TEMPO_REPOSICAO_PADRAO}d)</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="font-medium text-sm">Ponto Reposição</p>
                <p className="text-xs text-muted-foreground">= Est. Mínimo × Margem Segurança ({MARGEM_SEGURANCA}x)</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="font-medium text-sm">Est. Máximo</p>
                <p className="text-xs text-muted-foreground">= Ponto Repo. + Consumo/Dia × 7 dias</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="font-medium text-sm">Cobertura</p>
                <p className="text-xs text-muted-foreground">= Estoque Atual ÷ Consumo Médio/Dia</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">* Baseado nas vendas dos últimos 90 dias</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

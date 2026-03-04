import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sun, TrendingUp, AlertTriangle, Package, DollarSign, Users, Truck, CheckCircle, Clock } from "lucide-react";
import { RemindersWidget } from "@/components/dashboard/RemindersWidget";
import { AiInsightsWidget } from "@/components/dashboard/AiInsightsWidget";
import { ProdutividadeWidget } from "@/components/operacional/ProdutividadeWidget";
import { PrevisaoDemandaWidget } from "@/components/operacional/PrevisaoDemandaWidget";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { getBrasiliaDate } from "@/lib/utils";

export default function CockpitGestor() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState({
    vendasHoje: 0, faturamentoHoje: 0, ticketMedio: 0,
    pedidosPendentes: 0, entregadoresAtivos: 0, entregadoresEmRota: 0,
    estoqueBaixo: 0, contasVencer: 0, alertasJornada: 0,
    faturamentoMes: 0, metaMensal: 150000,
    pedidosOntem: 0, faturamentoOntem: 0,
  });

  useEffect(() => { fetchData(); }, [unidadeAtual]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const now = getBrasiliaDate();
      const hojeInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const ontemInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
      const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Vendas hoje
      let pHoje = supabase.from("pedidos").select("valor_total").gte("created_at", hojeInicio).neq("status", "cancelado");
      if (unidadeAtual?.id) pHoje = pHoje.eq("unidade_id", unidadeAtual.id);
      const { data: pedidosHoje } = await pHoje;
      const fatHoje = pedidosHoje?.reduce((s, p) => s + (p.valor_total || 0), 0) || 0;

      // Vendas ontem
      let pOntem = supabase.from("pedidos").select("valor_total").gte("created_at", ontemInicio).lt("created_at", hojeInicio).neq("status", "cancelado");
      if (unidadeAtual?.id) pOntem = pOntem.eq("unidade_id", unidadeAtual.id);
      const { data: pedidosOntem } = await pOntem;
      const fatOntem = pedidosOntem?.reduce((s, p) => s + (p.valor_total || 0), 0) || 0;

      // Faturamento mês
      let pMes = supabase.from("pedidos").select("valor_total").gte("created_at", mesInicio).neq("status", "cancelado");
      if (unidadeAtual?.id) pMes = pMes.eq("unidade_id", unidadeAtual.id);
      const { data: pedidosMes } = await pMes;
      const fatMes = pedidosMes?.reduce((s, p) => s + (p.valor_total || 0), 0) || 0;

      // Pedidos pendentes
      let pPend = supabase.from("pedidos").select("id", { count: "exact" }).eq("status", "pendente");
      if (unidadeAtual?.id) pPend = pPend.eq("unidade_id", unidadeAtual.id);
      const { count: pendentes } = await pPend;

      // Entregadores
      const { data: entregs } = await supabase.from("entregadores").select("status").eq("ativo", true);
      const emRota = entregs?.filter(e => e.status === "em_rota").length || 0;

      // Estoque baixo
      let eBaixo = supabase.from("produtos").select("id", { count: "exact" }).eq("ativo", true).lt("estoque", 10);
      if (unidadeAtual?.id) eBaixo = eBaixo.eq("unidade_id", unidadeAtual.id);
      const { count: estoqueBaixo } = await eBaixo;

      // Contas a vencer (próximos 3 dias)
      const tresDias = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      let cv = supabase.from("contas_pagar").select("id", { count: "exact" }).eq("status", "pendente").lte("vencimento", tresDias);
      if (unidadeAtual?.id) cv = cv.eq("unidade_id", unidadeAtual.id);
      const { count: contasVencer } = await cv;

      // Alertas jornada
      let aj = supabase.from("alertas_jornada").select("id", { count: "exact" }).eq("resolvido", false);
      if (unidadeAtual?.id) aj = aj.eq("unidade_id", unidadeAtual.id);
      const { count: alertas } = await aj;

      setDados({
        vendasHoje: pedidosHoje?.length || 0, faturamentoHoje: fatHoje,
        ticketMedio: pedidosHoje?.length ? fatHoje / pedidosHoje.length : 0,
        pedidosPendentes: pendentes || 0, entregadoresAtivos: entregs?.length || 0,
        entregadoresEmRota: emRota, estoqueBaixo: estoqueBaixo || 0,
        contasVencer: contasVencer || 0, alertasJornada: alertas || 0,
        faturamentoMes: fatMes, metaMensal: 150000,
        pedidosOntem: pedidosOntem?.length || 0, faturamentoOntem: fatOntem,
      });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const progressoMeta = Math.min((dados.faturamentoMes / dados.metaMensal) * 100, 100);
  const variacaoVendas = dados.faturamentoOntem > 0 ? ((dados.faturamentoHoje - dados.faturamentoOntem) / dados.faturamentoOntem * 100) : 0;

  if (loading) return (
    <MainLayout>
      <Header title="Cockpit do Gestor" subtitle="Resumo matinal" />
      <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
    </MainLayout>
  );

  const alertasTotal = dados.pedidosPendentes + dados.estoqueBaixo + dados.contasVencer + dados.alertasJornada;

  return (
    <MainLayout>
      <Header title="Cockpit do Gestor" subtitle="Resumo do dia" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Saudação */}
        <div className="flex items-center gap-3">
          <Sun className="h-8 w-8 text-chart-4" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{saudacao}, Gestor!</h1>
            <p className="text-muted-foreground">{getBrasiliaDate().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
        </div>

        {/* Alertas urgentes */}
        {alertasTotal > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <span className="font-semibold text-destructive">Atenção Necessária ({alertasTotal})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {dados.pedidosPendentes > 0 && <Badge variant="outline">{dados.pedidosPendentes} pedidos pendentes</Badge>}
                {dados.estoqueBaixo > 0 && <Badge variant="outline">{dados.estoqueBaixo} produtos com estoque baixo</Badge>}
                {dados.contasVencer > 0 && <Badge variant="outline">{dados.contasVencer} contas vencem em 3 dias</Badge>}
                {dados.alertasJornada > 0 && <Badge variant="outline">{dados.alertasJornada} alertas de jornada</Badge>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs do dia */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Faturamento Hoje</p>
                  <p className="text-2xl font-bold">R$ {dados.faturamentoHoje.toLocaleString("pt-BR")}</p>
                  {variacaoVendas !== 0 && (
                    <p className={`text-xs flex items-center gap-1 mt-1 ${variacaoVendas > 0 ? "text-chart-3" : "text-destructive"}`}>
                      <TrendingUp className="h-3 w-3" />{variacaoVendas > 0 ? "+" : ""}{variacaoVendas.toFixed(0)}% vs ontem
                    </p>
                  )}
                </div>
                <DollarSign className="h-8 w-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Vendas Hoje</p>
                  <p className="text-2xl font-bold">{dados.vendasHoje}</p>
                  <p className="text-xs text-muted-foreground mt-1">Ticket: R$ {dados.ticketMedio.toFixed(2)}</p>
                </div>
                <Package className="h-8 w-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Entregadores</p>
                  <p className="text-2xl font-bold">{dados.entregadoresEmRota}/{dados.entregadoresAtivos}</p>
                  <p className="text-xs text-muted-foreground mt-1">em rota / total</p>
                </div>
                <Truck className="h-8 w-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold">{dados.pedidosPendentes}</p>
                  <p className="text-xs text-muted-foreground mt-1">aguardando ação</p>
                </div>
                <Clock className="h-8 w-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Meta mensal */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Meta Mensal</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>R$ {dados.faturamentoMes.toLocaleString("pt-BR")}</span>
                <span className="font-medium">R$ {dados.metaMensal.toLocaleString("pt-BR")}</span>
              </div>
              <Progress value={progressoMeta} className="h-4" />
              <p className="text-sm text-muted-foreground text-center">{progressoMeta.toFixed(1)}% da meta atingida</p>
            </div>
          </CardContent>
        </Card>

        {/* Produtividade + Previsão IA */}
        <div className="grid gap-6 lg:grid-cols-2">
          <ProdutividadeWidget />
          <PrevisaoDemandaWidget />
        </div>

        {/* Lembretes + IA Insights */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RemindersWidget />
          <AiInsightsWidget />
        </div>
      </div>
    </MainLayout>
  );
}

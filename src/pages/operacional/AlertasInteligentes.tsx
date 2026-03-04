import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Package, DollarSign, Users, Truck, Clock, CheckCircle, Loader2, Bell, TrendingDown, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { getBrasiliaDate, getBrasiliaDateString } from "@/lib/utils";

interface Alerta {
  id: string;
  tipo: "critico" | "atencao" | "info";
  categoria: string;
  titulo: string;
  descricao: string;
  icone: React.ElementType;
  acao?: string;
}

export default function AlertasInteligentes() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [alertas, setAlertas] = useState<Alerta[]>([]);

  useEffect(() => { analisar(); }, [unidadeAtual]);

  const analisar = async () => {
    setLoading(true);
    const novosAlertas: Alerta[] = [];
    try {
      const now = getBrasiliaDate();
      const hojeInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const tresDias = getBrasiliaDateString(new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000));

      // Estoque crítico
      let eq = supabase.from("produtos").select("nome, estoque").eq("ativo", true).lt("estoque", 5);
      if (unidadeAtual?.id) eq = eq.eq("unidade_id", unidadeAtual.id);
      const { data: estoqueBaixo } = await eq;
      estoqueBaixo?.forEach(p => {
        novosAlertas.push({ id: `est-${p.nome}`, tipo: p.estoque! <= 0 ? "critico" : "atencao", categoria: "Estoque", titulo: `${p.nome} - Estoque ${p.estoque! <= 0 ? "ZERADO" : "crítico"}`, descricao: `Apenas ${p.estoque} unidades restantes. Faça uma reposição urgente.`, icone: Package, acao: "/estoque/compras" });
      });

      // Pedidos pendentes há muito tempo (>30 min)
      const trintaMinAtras = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      let ppq = supabase.from("pedidos").select("id, created_at, clientes(nome)").eq("status", "pendente").lt("created_at", trintaMinAtras);
      if (unidadeAtual?.id) ppq = ppq.eq("unidade_id", unidadeAtual.id);
      const { data: pedidosAtrasados } = await ppq;
      if (pedidosAtrasados && pedidosAtrasados.length > 0) {
        novosAlertas.push({ id: "ped-atrasados", tipo: "critico", categoria: "Vendas", titulo: `${pedidosAtrasados.length} pedidos pendentes há mais de 30 min`, descricao: "Clientes podem estar aguardando. Atribua entregadores imediatamente.", icone: Clock, acao: "/vendas/pedidos" });
      }

      // Contas a vencer
      let cv = supabase.from("contas_pagar").select("fornecedor, valor, vencimento").eq("status", "pendente").lte("vencimento", tresDias);
      if (unidadeAtual?.id) cv = cv.eq("unidade_id", unidadeAtual.id);
      const { data: contasVencer } = await cv;
      if (contasVencer && contasVencer.length > 0) {
        const total = contasVencer.reduce((s, c) => s + Number(c.valor), 0);
        novosAlertas.push({ id: "contas-vencer", tipo: "atencao", categoria: "Financeiro", titulo: `${contasVencer.length} contas vencem em 3 dias`, descricao: `Total: R$ ${total.toLocaleString("pt-BR")}. Providencie os pagamentos.`, icone: DollarSign, acao: "/financeiro/pagar" });
      }

      // Alertas de jornada
      let aj = supabase.from("alertas_jornada").select("id", { count: "exact" }).eq("resolvido", false);
      if (unidadeAtual?.id) aj = aj.eq("unidade_id", unidadeAtual.id);
      const { count: alertasJornada } = await aj;
      if (alertasJornada && alertasJornada > 0) {
        novosAlertas.push({ id: "jornada", tipo: alertasJornada > 3 ? "critico" : "atencao", categoria: "RH", titulo: `${alertasJornada} alertas de jornada não resolvidos`, descricao: "Verifique horas extras e irregularidades trabalhistas.", icone: ShieldAlert, acao: "/rh/jornada" });
      }

      // Entregadores sem rota
      const { data: entregs } = await supabase.from("entregadores").select("nome, status").eq("ativo", true);
      const disponiveisOciosos = entregs?.filter(e => e.status === "disponivel") || [];
      let pedPend = supabase.from("pedidos").select("id", { count: "exact" }).eq("status", "pendente");
      if (unidadeAtual?.id) pedPend = pedPend.eq("unidade_id", unidadeAtual.id);
      const { count: pendentes } = await pedPend;
      if (disponiveisOciosos.length > 0 && (pendentes || 0) > 0) {
        novosAlertas.push({ id: "ocioso", tipo: "info", categoria: "Operacional", titulo: `${disponiveisOciosos.length} entregadores livres com ${pendentes} pedidos pendentes`, descricao: "Distribua os pedidos para otimizar as entregas.", icone: Truck });
      }

      // Vendas abaixo da média
      const ontemInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
      let vHoje = supabase.from("pedidos").select("id", { count: "exact" }).gte("created_at", hojeInicio).neq("status", "cancelado");
      if (unidadeAtual?.id) vHoje = vHoje.eq("unidade_id", unidadeAtual.id);
      const { count: vendasHoje } = await vHoje;

      let vOntem = supabase.from("pedidos").select("id", { count: "exact" }).gte("created_at", ontemInicio).lt("created_at", hojeInicio).neq("status", "cancelado");
      if (unidadeAtual?.id) vOntem = vOntem.eq("unidade_id", unidadeAtual.id);
      const { count: vendasOntem } = await vOntem;

      if (vendasOntem && vendasOntem > 0 && vendasHoje !== null && vendasHoje < vendasOntem * 0.7 && now.getHours() > 12) {
        novosAlertas.push({ id: "vendas-baixas", tipo: "atencao", categoria: "Vendas", titulo: "Vendas abaixo do esperado hoje", descricao: `${vendasHoje} vendas hoje vs ${vendasOntem} ontem até este horário. Considere ações de marketing.`, icone: TrendingDown });
      }

      // Se tudo ok
      if (novosAlertas.length === 0) {
        novosAlertas.push({ id: "ok", tipo: "info", categoria: "Sistema", titulo: "Tudo funcionando normalmente!", descricao: "Nenhum alerta detectado. Continue o bom trabalho!", icone: CheckCircle });
      }

      setAlertas(novosAlertas);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const criticos = alertas.filter(a => a.tipo === "critico");
  const atencao = alertas.filter(a => a.tipo === "atencao");
  const info = alertas.filter(a => a.tipo === "info");

  if (loading) return (
    <MainLayout>
      <Header title="Alertas Inteligentes" subtitle="Monitoramento proativo" />
      <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
    </MainLayout>
  );

  const renderAlerta = (alerta: Alerta) => (
    <div key={alerta.id} className={`flex items-start gap-4 p-4 rounded-lg border ${alerta.tipo === "critico" ? "border-destructive/50 bg-destructive/5" : alerta.tipo === "atencao" ? "border-chart-4/50 bg-chart-4/5" : "border-border"}`}>
      <div className={`p-2 rounded-lg ${alerta.tipo === "critico" ? "bg-destructive/10" : alerta.tipo === "atencao" ? "bg-chart-4/10" : "bg-primary/10"}`}>
        <alerta.icone className={`h-5 w-5 ${alerta.tipo === "critico" ? "text-destructive" : alerta.tipo === "atencao" ? "text-chart-4" : "text-primary"}`} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-[10px]">{alerta.categoria}</Badge>
          <Badge variant={alerta.tipo === "critico" ? "destructive" : alerta.tipo === "atencao" ? "default" : "secondary"} className="text-[10px]">{alerta.tipo === "critico" ? "Crítico" : alerta.tipo === "atencao" ? "Atenção" : "Info"}</Badge>
        </div>
        <p className="font-medium">{alerta.titulo}</p>
        <p className="text-sm text-muted-foreground mt-1">{alerta.descricao}</p>
      </div>
      {alerta.acao && <Button variant="outline" size="sm" onClick={() => window.location.href = alerta.acao!}>Ver</Button>}
    </div>
  );

  return (
    <MainLayout>
      <Header title="Alertas Inteligentes" subtitle="Monitoramento proativo" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Button onClick={analisar}><AlertTriangle className="h-4 w-4 mr-2" />Reanalisar</Button>
        </div>

        <div className="grid gap-3 grid-cols-3">
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-destructive">{criticos.length}</p><p className="text-xs text-muted-foreground">Críticos</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-chart-4">{atencao.length}</p><p className="text-xs text-muted-foreground">Atenção</p></CardContent></Card>
          <Card><CardContent className="py-3 text-center"><p className="text-2xl font-bold text-primary">{info.length}</p><p className="text-xs text-muted-foreground">Informativos</p></CardContent></Card>
        </div>

        {criticos.length > 0 && <div className="space-y-3">{criticos.map(renderAlerta)}</div>}
        {atencao.length > 0 && <div className="space-y-3">{atencao.map(renderAlerta)}</div>}
        {info.length > 0 && <div className="space-y-3">{info.map(renderAlerta)}</div>}
      </div>
    </MainLayout>
  );
}

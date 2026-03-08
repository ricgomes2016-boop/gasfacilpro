import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Star,
  Package,
  TrendingUp,
  Calendar,
  Clock,
  Target,
  Flame,
  Medal,
  BellRing,
  DollarSign,
  Wallet,
  CreditCard,
  QrCode,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useDeliveryNotifications } from "@/contexts/DeliveryNotificationContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDate, getBrasiliaDateString } from "@/lib/utils";

export default function EntregadorDashboard() {
  const { pendingDeliveries } = useDeliveryNotifications();
  const { permission, requestPermission } = useNotifications();
  const { user, profile } = useAuth();
  
  const [stats, setStats] = useState({
    entregasHoje: 0,
    entregasMes: 0,
    metaMensal: 200,
    ganhosHoje: 0,
    ganhosMes: 0,
  });
  const [entregasPendentes, setEntregasPendentes] = useState<any[]>([]);
  const [terminalNome, setTerminalNome] = useState<string | null>(null);
  const [entregadorStatus, setEntregadorStatus] = useState<string>("offline");

  const nomeEntregador = profile?.full_name || user?.user_metadata?.full_name || "Entregador";

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      
      const { data: entregador } = await supabase
        .from("entregadores")
        .select("id, terminal_id, terminal_ativo_id, status")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (!entregador) return;
      
      setEntregadorStatus(entregador.status || "offline");

      // Fetch terminal name
      const activeTerminalId = entregador.terminal_ativo_id || entregador.terminal_id;
      if (activeTerminalId) {
        const { data: t } = await (supabase.from("terminais_cartao" as any).select("nome").eq("id", activeTerminalId).maybeSingle() as any);
        if (t) setTerminalNome(t.nome);
      }

      const hoje = getBrasiliaDateString();
      const bd = getBrasiliaDate();
      const inicioMes = new Date(bd.getFullYear(), bd.getMonth(), 1).toISOString();

      const [hojRes, mesRes, pendRes, ganhosHojeRes, ganhosMesRes] = await Promise.all([
        supabase.from("pedidos").select("id", { count: "exact", head: true })
          .eq("entregador_id", entregador.id).eq("status", "entregue")
          .gte("created_at", hoje),
        supabase.from("pedidos").select("id", { count: "exact", head: true })
          .eq("entregador_id", entregador.id).eq("status", "entregue")
          .gte("created_at", inicioMes),
        supabase.from("pedidos").select("id, created_at, endereco_entrega, clientes(nome)")
          .eq("entregador_id", entregador.id)
          .in("status", ["pendente", "em_rota"])
          .order("created_at", { ascending: true })
          .limit(5),
        supabase.from("pedidos").select("valor_total")
          .eq("entregador_id", entregador.id).eq("status", "entregue")
          .gte("created_at", hoje),
        supabase.from("pedidos").select("valor_total")
          .eq("entregador_id", entregador.id).eq("status", "entregue")
          .gte("created_at", inicioMes),
      ]);

      const sumValues = (data: any[] | null) => (data || []).reduce((s: number, r: any) => s + (r.valor_total || 0), 0);

      setStats({
        entregasHoje: hojRes.count || 0,
        entregasMes: mesRes.count || 0,
        metaMensal: 200,
        ganhosHoje: sumValues(ganhosHojeRes.data),
        ganhosMes: sumValues(ganhosMesRes.data),
      });

      setEntregasPendentes(
        (pendRes.data || []).map((p: any) => ({
          id: p.id,
          cliente: p.clientes?.nome || "Cliente",
          endereco: p.endereco_entrega || "Sem endereço",
          horario: new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        }))
      );
    };

    fetchStats();
  }, [user]);

  const progressoMeta = (stats.entregasMes / stats.metaMensal) * 100;

  const todasEntregasPendentes = [
    ...entregasPendentes,
    ...pendingDeliveries.map((d) => ({
      id: d.id,
      cliente: d.cliente,
      endereco: d.endereco,
      horario: d.horarioPrevisto,
    })),
  ];

  const horaAtual = new Date().getHours();
  const saudacao = horaAtual < 12 ? "Bom dia" : horaAtual < 18 ? "Boa tarde" : "Boa noite";

  return (
    <EntregadorLayout title="Início">
      <div className="p-4 space-y-5">
        {/* Banner de ativar notificações */}
        {permission !== "granted" && (
          <Card className="border-none shadow-md bg-primary/5 border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <BellRing className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Ative as notificações</p>
                  <p className="text-xs text-muted-foreground">
                    Receba alertas de novas entregas em tempo real
                  </p>
                </div>
                <Button size="sm" onClick={requestPermission}>
                  Ativar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Botão de Jornada Gigante (Action-Oriented) */}
        <div>
           {entregadorStatus === "offline" ? (
             <Link to="/entregador/jornada" className="block w-full">
               <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-3xl p-5 text-white shadow-lg shadow-orange-500/30 flex items-center justify-between active:scale-[0.98] transition-transform">
                 <div>
                   <h2 className="text-xl font-bold flex items-center gap-2">
                     <Flame className="h-6 w-6" />
                     Iniciar Jornada
                   </h2>
                   <p className="text-white/80 text-sm mt-1">Fique online para receber pedidos</p>
                 </div>
                 <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-inner">
                   <Target className="h-7 w-7 text-white animate-pulse" />
                 </div>
               </div>
             </Link>
           ) : (
             <Link to="/entregador/jornada" className="block w-full">
               <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl p-5 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-between active:scale-[0.98] transition-transform">
                 <div>
                   <h2 className="text-xl font-bold flex items-center gap-2">
                     <div className="h-3 w-3 rounded-full bg-white animate-pulse" />
                     Online e Rastreando
                   </h2>
                   <p className="text-white/80 text-sm mt-1">Sua localização está sendo atualizada</p>
                 </div>
                 <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-inner">
                   <Package className="h-7 w-7 text-white" />
                 </div>
               </div>
             </Link>
           )}
        </div>

        {/* Header com saudação Glassmorphism */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-5 text-white shadow-xl">
          <div className="absolute -right-10 -top-10 h-40 w-40 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute -left-10 -bottom-10 h-32 w-32 bg-teal-400/20 rounded-full blur-xl"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-teal-100/90 text-sm font-medium">{saudacao},</p>
              <h1 className="text-2xl font-bold tracking-tight mt-0.5 max-w-[180px] truncate">{nomeEntregador}</h1>
              <div className="flex items-center gap-2 mt-3">
                <Badge className="bg-white/20 text-white border-none backdrop-blur-md hover:bg-white/30 transition-colors py-1 px-2.5">
                  <Package className="h-3.5 w-3.5 mr-1.5" />
                  {stats.entregasHoje} entregas hoje
                </Badge>
              </div>
            </div>
            <div className="text-center flex flex-col items-center">
              <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl font-bold shadow-inner">
                {stats.entregasMes}
              </div>
              <p className="text-xs text-teal-100 mt-2 font-medium">no mês</p>
            </div>
          </div>
        </div>

        {/* Resumo financeiro do dia - Premium Dark Card */}
        <Card className="border-none shadow-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden rounded-3xl">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Wallet className="h-32 w-32 text-white transform translate-x-4 -translate-y-4" />
          </div>
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <DollarSign className="h-5 w-5" />
                <span className="font-semibold text-sm tracking-wider uppercase">Ganhos do Dia</span>
              </div>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                R$ {stats.ganhosMes.toFixed(2)} no mês
              </Badge>
            </div>
            
            <div className="flex items-end gap-2 mt-2">
              <span className="text-white/60 text-2xl mb-1 font-medium">R$</span>
              <span className="text-white text-4xl font-bold tracking-tight">
                {stats.ganhosHoje.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Cards de estatísticas rápidas */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-none shadow-md rounded-2xl bg-white/80 dark:bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.entregasHoje}</p>
                  <p className="text-xs text-muted-foreground font-medium">Entregas hoje</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-md rounded-2xl bg-white/80 dark:bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.entregasMes}</p>
                  <p className="text-xs text-muted-foreground font-medium">Este mês</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Meta mensal com Sparkline text */}
        <Card className="border-none shadow-md rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-foreground/90">
              <Target className="h-5 w-5 text-primary" />
              Meta Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-primary">{stats.entregasMes} entregas</span>
                <span className="text-muted-foreground">Meta: {stats.metaMensal}</span>
              </div>
              <Progress value={progressoMeta} className="h-2.5 bg-primary/10" />
              <p className="text-xs text-muted-foreground text-center font-medium">
                Faltam {Math.max(0, stats.metaMensal - stats.entregasMes)} entregas para atingir a meta
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Maquininha vinculada */}
        <Card className="border-none shadow-md rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                {terminalNome ? (
                  <div>
                    <p className="text-sm font-bold">{terminalNome}</p>
                    <p className="text-xs text-muted-foreground font-medium">Maquininha ativa</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">Nenhuma vinculada</p>
                    <p className="text-xs text-muted-foreground">Vincule na jornada</p>
                  </div>
                )}
              </div>
              <Link to="/entregador/jornada">
                <Button size="sm" variant={terminalNome ? "outline" : "default"} className="rounded-xl px-4 font-medium">
                  {terminalNome ? "Trocar" : "Vincular"}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Entregas pendentes com animação */}
        {todasEntregasPendentes.length > 0 && (
          <Card className={`border-none shadow-lg rounded-2xl overflow-hidden transition-all ${pendingDeliveries.length > 0 ? 'ring-2 ring-orange-500/50 shadow-orange-500/20' : ''}`}>
            <CardHeader className={`pb-3 border-b ${pendingDeliveries.length > 0 ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200/50' : 'border-muted/50 bg-slate-50 dark:bg-slate-900/50'}`}>
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className={`h-5 w-5 ${pendingDeliveries.length > 0 ? 'text-orange-500 animate-pulse' : 'text-primary'}`} />
                Entregas Pendentes
                {pendingDeliveries.length > 0 && (
                  <Badge className="bg-orange-500 hover:bg-orange-600 text-white ml-auto animate-pulse">
                    +{pendingDeliveries.length} novas
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {todasEntregasPendentes.slice(0, 4).map((entrega) => (
                  <Link
                    key={entrega.id}
                    to={`/entregador/entregas`}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-bold text-sm">{entrega.cliente}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 font-medium">{entrega.endereco}</p>
                    </div>
                    <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 pointer-events-none">
                      <Clock className="h-3 w-3 mr-1" />
                      {entrega.horario}
                    </Badge>
                  </Link>
                ))}
              </div>
              <div className="p-3 bg-muted/20 text-center border-t border-border/50">
                <Link
                  to="/entregador/entregas"
                  className="text-sm text-primary font-bold hover:underline"
                >
                  Ver todas as {todasEntregasPendentes.length} entregas →
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </EntregadorLayout>
  );
}

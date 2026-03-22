import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import {
  BarChart3, Calendar, FileText, Share2, MessageSquare, Sparkles,
  TrendingUp, Eye, Heart, MousePointerClick, ArrowRight, Megaphone,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DashboardMarketing() {
  const navigate = useNavigate();
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const empresaId = empresa?.id;

  const { data: conteudos = [] } = useQuery({
    queryKey: ["mkt-conteudos-count", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_conteudos")
        .select("id, tipo, created_at")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: agendamentos = [] } = useQuery({
    queryKey: ["mkt-agendamentos-dash", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_agendamentos")
        .select("id, plataforma, data_agendamento, status, texto")
        .eq("empresa_id", empresaId!)
        .order("data_agendamento", { ascending: true })
        .limit(50);
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: socialAccounts = [] } = useQuery({
    queryKey: ["social-accounts-dash", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("social_accounts")
        .select("id, plataforma, nome_conta, ativo")
        .eq("empresa_id", empresaId!);
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: conversas = [] } = useQuery({
    queryKey: ["mkt-conversas-dash", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_conversas")
        .select("id, status")
        .eq("empresa_id", empresaId!);
      return data || [];
    },
    enabled: !!empresaId,
  });

  const proximosAgendamentos = agendamentos
    .filter((a) => a.status === "agendado")
    .slice(0, 5);

  const kpis = [
    {
      label: "Conteúdos Criados",
      value: conteudos.length,
      icon: FileText,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Posts Agendados",
      value: agendamentos.filter((a) => a.status === "agendado").length,
      icon: Calendar,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Redes Conectadas",
      value: socialAccounts.filter((a) => a.ativo).length,
      icon: Share2,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      label: "Conversas Ativas",
      value: conversas.filter((c) => c.status === "ativo").length,
      icon: MessageSquare,
      color: "text-pink-500",
      bg: "bg-pink-500/10",
    },
  ];

  const quickActions = [
    { label: "Criar Conteúdo IA", path: "/clientes/marketing", icon: Sparkles, color: "text-violet-500" },
    { label: "Agendar Post", path: "/marketing/agendamentos", icon: Calendar, color: "text-emerald-500" },
    { label: "Redes Sociais", path: "/marketing/redes-sociais", icon: Share2, color: "text-blue-500" },
    { label: "Biblioteca", path: "/marketing/conteudos", icon: FileText, color: "text-orange-500" },
    { label: "Atendimento IA", path: "/marketing/atendimento", icon: MessageSquare, color: "text-pink-500" },
  ];

  const plataformaIcon: Record<string, string> = {
    instagram: "📸",
    facebook: "📘",
    tiktok: "🎵",
    youtube: "▶️",
    whatsapp: "💬",
  };

  return (
    <MainLayout>
      <Header title="Marketing Inteligente" subtitle="Painel completo de marketing e engajamento" />
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${kpi.bg}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick actions */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {quickActions.map((action) => (
                <Button
                  key={action.path}
                  variant="outline"
                  className="h-auto flex-col gap-2 py-4 hover:bg-accent/50"
                  onClick={() => navigate(action.path)}
                >
                  <action.icon className={`h-5 w-5 ${action.color}`} />
                  <span className="text-xs font-medium">{action.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Upcoming posts */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-emerald-500" />
                  Próximos Agendamentos
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/marketing/agendamentos")}>
                  Ver todos <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {proximosAgendamentos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum post agendado</p>
                  <Button variant="link" size="sm" onClick={() => navigate("/marketing/agendamentos")}>
                    Agendar agora
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {proximosAgendamentos.map((ag) => (
                    <div key={ag.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                      <span className="text-lg">{plataformaIcon[ag.plataforma] || "📝"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ag.texto?.slice(0, 60) || "Post agendado"}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(ag.data_agendamento), "dd MMM · HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Suggestions placeholder */}
          <Card className="border-border/50 border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-500" />
                Sugestões da IA
              </CardTitle>
              <CardDescription>Ideias proativas baseadas no seu negócio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { text: "🔥 Inverno chegando! Crie posts sobre entrega rápida de gás", action: "Gerar post" },
                  { text: "📅 Dia do Cliente (15/09) — prepare uma campanha especial", action: "Criar campanha" },
                  { text: "📊 Seus posts de promoção geram 3x mais engajamento", action: "Ver análise" },
                ].map((sug, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-violet-500/5 border border-violet-500/10">
                    <p className="text-sm flex-1">{sug.text}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-violet-600 hover:text-violet-700 shrink-0"
                      onClick={() => navigate("/clientes/marketing")}
                    >
                      {sug.action}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

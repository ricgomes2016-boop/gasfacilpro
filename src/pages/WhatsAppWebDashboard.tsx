/**
 * Dashboard WhatsApp Web
 * 
 * Painel completo com:
 * - Inbox de conversas em tempo real
 * - Estatísticas da BIA
 * - Insights de conversas
 * - Controles de automação
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  MessageCircle,
  Bot,
  TrendingUp,
  ShoppingCart,
  Mic,
  Clock,
  Star,
  Wifi,
  WifiOff,
  Settings,
  Inbox,
  BarChart3,
  Zap,
  Users,
  ArrowRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { biaProcessor, BIAStats, ConversationInsight } from "@/services/whatsappBIAProcessor";

export default function WhatsAppWebDashboard() {
  const navigate = useNavigate();
  const [autoReply, setAutoReply] = useState(true);
  const [autoOrder, setAutoOrder] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState<BIAStats | null>(null);
  const [insights, setInsights] = useState<ConversationInsight[]>([]);
  const [statsPeriod, setStatsPeriod] = useState<"today" | "week" | "month">("today");

  // Verificar conexão
  const { data: integracao } = useQuery({
    queryKey: ["integracao-status"],
    queryFn: async () => {
      const { data } = await supabase
        .from("integracoes_whatsapp")
        .select("id, status_conexao, provedor, numero_telefone, unidade_id")
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 30000, // Verificar a cada 30s
  });

  useEffect(() => {
    if (integracao) {
      setIsConnected(integracao.status_conexao === "conectado");
    }
  }, [integracao]);

  // Carregar estatísticas
  useEffect(() => {
    const loadStats = async () => {
      if (!integracao?.unidade_id) return;

      try {
        // Buscar empresa_id da unidade
        const { data: unidade } = await supabase
          .from("unidades")
          .select("empresa_id")
          .eq("id", integracao.unidade_id)
          .maybeSingle();

        if (unidade?.empresa_id) {
          await biaProcessor.initialize(unidade.empresa_id, integracao.unidade_id);
          const statsData = await biaProcessor.getStats(unidade.empresa_id, statsPeriod);
          setStats(statsData);

          const insightsData = await biaProcessor.getConversationInsights(5);
          setInsights(insightsData);
        }
      } catch (err) {
        console.error("Erro ao carregar stats:", err);
      }
    };

    loadStats();
  }, [integracao, statsPeriod]);

  // Toggle auto-reply
  const handleToggleAutoReply = (enabled: boolean) => {
    setAutoReply(enabled);
    biaProcessor.toggleAutoReply(enabled);
    toast.success(enabled ? "Respostas automáticas ativadas" : "Respostas automáticas desativadas");
  };

  // Toggle auto-order
  const handleToggleAutoOrder = (enabled: boolean) => {
    setAutoOrder(enabled);
    biaProcessor.toggleAutoOrder(enabled);
    toast.success(
      enabled ? "Processamento de pedidos ativado" : "Processamento de pedidos desativado"
    );
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">WhatsApp Dashboard</h1>
            <p className="text-muted-foreground">
              Gerencie conversas e automação da BIA
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={isConnected ? "default" : "secondary"} className="px-3 py-1">
              {isConnected ? (
                <>
                  <Wifi className="h-3 w-3 mr-1.5" />
                  Conectado
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 mr-1.5" />
                  Desconectado
                </>
              )}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => navigate("/integracoes?open=whatsapp")}>
              <Settings className="h-4 w-4 mr-1" />
              Config
            </Button>
          </div>
        </div>

        {/* Não conectado */}
        {!isConnected && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <WifiOff className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800">WhatsApp não conectado</p>
                    <p className="text-sm text-yellow-600">
                      Conecte para receber mensagens e ativar a BIA
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate("/whatsapp/web/login")}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Conectar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">
              <BarChart3 className="h-4 w-4 mr-1.5" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="inbox">
              <Inbox className="h-4 w-4 mr-1.5" />
              Inbox
            </TabsTrigger>
            <TabsTrigger value="automation">
              <Zap className="h-4 w-4 mr-1.5" />
              Automação
            </TabsTrigger>
          </TabsList>

          {/* Tab: Visão Geral */}
          <TabsContent value="overview" className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatsCard
                icon={MessageCircle}
                label="Mensagens"
                value={stats?.totalMessages || 0}
                color="blue"
              />
              <StatsCard
                icon={Bot}
                label="Respostas IA"
                value={stats?.autoReplies || 0}
                color="purple"
              />
              <StatsCard
                icon={ShoppingCart}
                label="Pedidos"
                value={stats?.ordersCreated || 0}
                color="green"
              />
              <StatsCard
                icon={Mic}
                label="Áudios"
                value={stats?.audioTranscriptions || 0}
                color="orange"
              />
            </div>

            {/* Period Selector */}
            <div className="flex gap-2">
              {(["today", "week", "month"] as const).map((p) => (
                <Button
                  key={p}
                  variant={statsPeriod === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatsPeriod(p)}
                >
                  {p === "today" ? "Hoje" : p === "week" ? "Semana" : "Mês"}
                </Button>
              ))}
            </div>

            {/* Performance Metrics */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    Tempo Médio de Resposta
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {stats ? `${(stats.avgResponseTime / 1000).toFixed(1)}s` : "--"}
                  </p>
                  <p className="text-xs text-muted-foreground">Meta: &lt; 5 segundos</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    Satisfação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {stats ? `${(stats.satisfactionRate * 100).toFixed(0)}%` : "--"}
                  </p>
                  <p className="text-xs text-muted-foreground">Baseado em avaliações</p>
                </CardContent>
              </Card>
            </div>

            {/* Conversation Insights */}
            {insights.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Conversas Recentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {insights.map((insight) => (
                        <div
                          key={insight.conversaId}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => navigate("/chat")}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                insight.sentiment === "positive"
                                  ? "bg-green-500"
                                  : insight.sentiment === "negative"
                                  ? "bg-red-500"
                                  : "bg-gray-400"
                              }`}
                            />
                            <span className="text-sm font-medium">{insight.clienteNome}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {insight.intent === "pedido"
                                ? "🛒 Pedido"
                                : insight.intent === "reclamacao"
                                ? "⚠️ Reclamação"
                                : insight.intent === "saudacao"
                                ? "👋 Saudação"
                                : "❓ Dúvida"}
                            </Badge>
                            {insight.orderPotential && (
                              <TrendingUp className="h-3 w-3 text-green-500" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: Inbox */}
          <TabsContent value="inbox">
            <Card>
              <CardContent className="py-8 text-center">
                <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">Inbox WhatsApp</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Acesse a caixa de entrada completa para gerenciar conversas
                </p>
                <Button onClick={() => navigate("/chat")} className="bg-green-600 hover:bg-green-700">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Abrir Inbox
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Automação */}
          <TabsContent value="automation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-purple-500" />
                  Automação BIA
                </CardTitle>
                <CardDescription>
                  Configure o comportamento da assistente virtual
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Auto Reply */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Respostas Automáticas</label>
                    <p className="text-xs text-muted-foreground">
                      BIA responde mensagens automaticamente
                    </p>
                  </div>
                  <Switch checked={autoReply} onCheckedChange={handleToggleAutoReply} />
                </div>

                {/* Auto Order */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Processamento de Pedidos</label>
                    <p className="text-xs text-muted-foreground">
                      BIA cria pedidos automaticamente quando confirmados
                    </p>
                  </div>
                  <Switch checked={autoOrder} onCheckedChange={handleToggleAutoOrder} />
                </div>

                {/* Audio Transcription */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Transcrição de Áudios</label>
                    <p className="text-xs text-muted-foreground">
                      Transcreve áudios recebidos automaticamente
                    </p>
                  </div>
                  <Switch checked={true} disabled />
                </div>

                {/* Follow-up */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Follow-up Automático</label>
                    <p className="text-xs text-muted-foreground">
                      Envia mensagem de acompanhamento após entrega
                    </p>
                  </div>
                  <Switch checked={false} disabled />
                </div>
              </CardContent>
            </Card>

            {/* BIA Capabilities */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Capacidades da BIA</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: "🛒", label: "Processar Pedidos" },
                    { icon: "💰", label: "Negociar Preços" },
                    { icon: "🎤", label: "Transcrever Áudios" },
                    { icon: "📍", label: "Enviar Localização" },
                    { icon: "❌", label: "Cancelar Pedidos" },
                    { icon: "⭐", label: "Coletar Avaliações" },
                    { icon: "🕐", label: "Horário Comercial" },
                    { icon: "👥", label: "Identificar Contatos" },
                  ].map((cap) => (
                    <div
                      key={cap.label}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                    >
                      <span className="text-lg">{cap.icon}</span>
                      <span className="text-xs font-medium">{cap.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Link to full config */}
            <div className="text-center">
              <Button variant="link" onClick={() => navigate("/integracoes?open=whatsapp")}>
                Configurações avançadas →
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

// ========== Sub-components ==========

function StatsCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: "blue" | "purple" | "green" | "orange";
}) {
  const colors = {
    blue: "bg-blue-100 text-blue-600",
    purple: "bg-purple-100 text-purple-600",
    green: "bg-green-100 text-green-600",
    orange: "bg-orange-100 text-orange-600",
  };

  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-1.5 rounded-md ${colors[color]}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl font-bold">{value.toLocaleString("pt-BR")}</p>
      </CardContent>
    </Card>
  );
}

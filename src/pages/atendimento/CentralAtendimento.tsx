import { useState, useEffect, useMemo, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useUnidade } from "@/contexts/UnidadeContext";
import {
  Phone, MessageSquare, PhoneIncoming, PhoneMissed, ShoppingCart, User, Search,
  Clock, PhoneCall, RotateCcw, Send, Zap, Timer, TrendingUp, Truck, XCircle,
  AlertTriangle, CheckCircle2, Copy, BarChart3,
} from "lucide-react";
import { format, formatDistanceToNow, differenceInMinutes, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { WhatsAppInbox } from "@/components/atendimento/WhatsAppInbox";


// === Types ===

interface Chamada {
  id: string;
  telefone: string | null;
  did: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  tipo: string;
  status: string;
  duracao_segundos: number | null;
  observacoes: string | null;
  unidade_id: string | null;
  empresa_id: string | null;
  created_at: string;
}

function formatDid(p: string | null): string {
  if (!p) return "—";
  const d = p.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,8)}-${d.slice(8)}`;
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return p;
}

function formatDuracao(s: number | null): string {
  if (!s || s <= 0) return "";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

function getInicioPeriodo(p: string): string {
  const d = new Date();
  if (p === "7d") { d.setDate(d.getDate() - 7); return d.toISOString(); }
  if (p === "30d") { d.setDate(d.getDate() - 30); return d.toISOString(); }
  d.setHours(0,0,0,0);
  return d.toISOString();
}

interface PedidoFila {
  id: string;
  cliente_id: string | null;
  clientes: { nome: string } | null;
  status: string;
  valor_total: number;
  created_at: string;
  endereco_entrega: string | null;
  canal_venda: string | null;
  entregador_id: string | null;
  entregadores: { nome: string } | null;
}

// === Templates WhatsApp ===

const whatsappTemplates = [
  {
    id: "confirmacao",
    label: "✅ Confirmar Pedido",
    template: "Olá {nome}! Seu pedido #{pedido_id} foi confirmado. Previsão de entrega: {previsao}. Obrigado pela preferência! 🔥",
  },
  {
    id: "saiu_entrega",
    label: "🚚 Saiu para Entrega",
    template: "Olá {nome}! Seu pedido #{pedido_id} já saiu para entrega com o entregador {entregador}. Previsão: {previsao}. 📦",
  },
  {
    id: "atraso",
    label: "⏰ Aviso de Atraso",
    template: "Olá {nome}, pedimos desculpas pelo atraso no pedido #{pedido_id}. Estamos trabalhando para entregar o mais rápido possível. Obrigado pela compreensão! 🙏",
  },
  {
    id: "entregue",
    label: "🎉 Pedido Entregue",
    template: "Olá {nome}! Seu pedido #{pedido_id} foi entregue com sucesso! Agradecemos sua preferência. Avalie nosso atendimento! ⭐",
  },
  {
    id: "retorno",
    label: "📞 Retorno de Chamada",
    template: "Olá {nome}! Tentamos ligar para você. Gostaria de fazer um pedido? Estamos à disposição! 😊",
  },
  {
    id: "promocao",
    label: "🔥 Promoção",
    template: "Olá {nome}! Temos uma promoção especial para você hoje. Entre em contato para saber mais! 🎁",
  },
];

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  recebida: { label: "Recebida", variant: "default" },
  atendida: { label: "Atendida", variant: "secondary" },
  perdida: { label: "Perdida", variant: "destructive" },
  retornar: { label: "Retornar", variant: "outline" },
};

const pedidoStatusConfig: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-warning" },
  em_preparo: { label: "Em Preparo", color: "bg-info" },
  saiu_entrega: { label: "Saiu Entrega", color: "bg-primary" },
  em_rota: { label: "Em Rota", color: "bg-info" },
  entregue: { label: "Entregue", color: "bg-success" },
  cancelado: { label: "Cancelado", color: "bg-destructive" },
};

// === Component ===

export default function CentralAtendimento() {
  const [chamadas, setChamadas] = useState<Chamada[]>([]);
  const [pedidosFila, setPedidosFila] = useState<PedidoFila[]>([]);
  const [entregadoresAtivos, setEntregadoresAtivos] = useState<{ id: string; nome: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [periodo, setPeriodo] = useState<string>("hoje");
  const [busca, setBusca] = useState("");
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [whatsappMsg, setWhatsappMsg] = useState("");
  const [whatsappDestinatario, setWhatsappDestinatario] = useState("");
  const navigate = useNavigate();
  const { unidadeAtual } = useUnidade();
  const inboxRef = useRef<HTMLDivElement>(null);

  const hoje = useMemo(() => new Date(), []);
  const inicioHoje = startOfDay(hoje).toISOString();
  const fimHoje = endOfDay(hoje).toISOString();

  // Fetch chamadas
  const fetchChamadas = async () => {
    const inicio = getInicioPeriodo(periodo);
    let query = supabase
      .from("chamadas_recebidas")
      .select("*")
      .gte("created_at", inicio)
      .order("created_at", { ascending: false })
      .limit(periodo === "hoje" ? 200 : 500);

    if (filtroStatus !== "todos") {
      query = query.eq("status", filtroStatus);
    }
    if (unidadeAtual?.id) {
      query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
    }

    const { data, error } = await query;
    if (error) toast.error("Erro ao carregar chamadas");
    else setChamadas((data as any) || []);
    setLoading(false);
  };

  // Fetch pedidos na fila (não entregues/cancelados)
  const fetchPedidosFila = async () => {
    let q = supabase
      .from("pedidos")
      .select("id, cliente_id, clientes(nome), status, valor_total, created_at, endereco_entrega, canal_venda, entregador_id, entregadores(nome)")
      .in("status", ["pendente", "em_preparo", "saiu_entrega", "em_rota"])
      .gte("created_at", inicioHoje)
      .order("created_at", { ascending: true });

    if (unidadeAtual?.id) {
      q = q.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
    }

    const { data } = await q;
    setPedidosFila((data as any) || []);
  };

  // Fetch entregadores
  const fetchEntregadores = async () => {
    let q = supabase
      .from("entregadores")
      .select("id, nome, status")
      .eq("ativo", true);

    if (unidadeAtual?.id) {
      q = q.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
    }

    const { data } = await q;
    setEntregadoresAtivos(data || []);
  };

  useEffect(() => {
    fetchChamadas();
    fetchPedidosFila();
    fetchEntregadores();

    if (!unidadeAtual?.id) return;

    const channel = supabase
      .channel(`central-atendimento-${unidadeAtual.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "chamadas_recebidas",
        filter: `unidade_id=eq.${unidadeAtual.id}`,
      }, () => fetchChamadas())
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "pedidos",
        filter: `unidade_id=eq.${unidadeAtual.id}`,
      }, () => fetchPedidosFila())
      .subscribe();

    const refreshInterval = setInterval(() => {
      fetchPedidosFila();
      fetchEntregadores();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(refreshInterval);
    };
  }, [filtroStatus, periodo, unidadeAtual?.id]);

  // === Computed Stats ===

  const chamadasFiltradas = chamadas.filter((c) => {
    if (!busca) return true;
    const term = busca.toLowerCase();
    return (
      (c.telefone || "").toLowerCase().includes(term) ||
      (c.did || "").toLowerCase().includes(term) ||
      (c.cliente_nome || "").toLowerCase().includes(term)
    );
  });

  const stats = {
    totalChamadas: chamadas.length,
    perdidas: chamadas.filter((c) => c.status === "perdida").length,
    retornar: chamadas.filter((c) => c.status === "retornar").length,
    pedidosNaFila: pedidosFila.length,
    pedidosPendentes: pedidosFila.filter((p) => p.status === "pendente").length,
    pedidosAtrasados: pedidosFila.filter((p) => {
      const mins = differenceInMinutes(new Date(), new Date(p.created_at));
      return p.status === "pendente" && mins > 30;
    }).length,
    entregadoresOnline: entregadoresAtivos.filter((e) => e.status === "disponivel").length,
    entregadoresTotal: entregadoresAtivos.length,
    tempoMedio: (() => {
      const atendidas = chamadas.filter((c) => c.status === "atendida" && c.duracao_segundos);
      if (atendidas.length === 0) return 0;
      return Math.round(atendidas.reduce((s, c) => s + (c.duracao_segundos || 0), 0) / atendidas.length);
    })(),
  };

  // === Handlers ===

  const handleMarcarRetornar = async (id: string) => {
    await supabase.from("chamadas_recebidas").update({ status: "retornar" }).eq("id", id);
    toast.success("Marcada para retorno");
    fetchChamadas();
  };

  const handleNovaVenda = (chamada: Chamada) => {
    if (chamada.cliente_id) {
      navigate(`/vendas/nova?cliente=${chamada.cliente_id}`);
    } else {
      navigate(`/vendas/nova?telefone=${encodeURIComponent(chamada.telefone)}`);
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const tmpl = whatsappTemplates.find((t) => t.id === templateId);
    if (tmpl) setWhatsappMsg(tmpl.template);
  };

  const handleCopyWhatsapp = () => {
    navigator.clipboard.writeText(whatsappMsg);
    toast.success("Mensagem copiada!");
  };

  const handleSendWhatsapp = () => {
    const phone = whatsappDestinatario.replace(/\D/g, "");
    if (!phone) {
      toast.error("Informe o número de telefone");
      return;
    }
    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(whatsappMsg)}`;
    window.open(url, "_blank");
    setWhatsappOpen(false);
  };

  const openWhatsappFor = (telefone: string, nome?: string | null) => {
    setWhatsappDestinatario(telefone);
    const tmpl = whatsappTemplates[0];
    setSelectedTemplate(tmpl.id);
    setWhatsappMsg(tmpl.template.replace("{nome}", nome || "Cliente"));
    setWhatsappOpen(true);
  };

  return (
    <MainLayout>
      <Header title="Central de Atendimento" subtitle="Dashboard operacional em tempo real" />
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">

        {/* Banner de permissão de notificações desktop */}
        {"Notification" in window && Notification.permission === "default" && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-full">
                <AlertTriangle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Ative as notificações desktop</p>
                <p className="text-xs text-muted-foreground">Receba alertas de novos pedidos mesmo quando a aba não estiver visível.</p>
              </div>
            </div>
            <Button size="sm" onClick={() => Notification.requestPermission()}>
              Ativar
            </Button>
          </div>
        )}

        {/* === DASHBOARD KPIs === */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Na Fila</p>
                <p className="text-xl font-bold">{stats.pedidosNaFila}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="rounded-lg bg-warning/10 p-2">
                <Timer className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-xl font-bold">{stats.pedidosPendentes}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-3">
              <div className={`rounded-lg p-2 ${stats.pedidosAtrasados > 0 ? "bg-destructive/10" : "bg-muted"}`}>
                <AlertTriangle className={`h-5 w-5 ${stats.pedidosAtrasados > 0 ? "text-destructive" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Atrasados</p>
                <p className={`text-xl font-bold ${stats.pedidosAtrasados > 0 ? "text-destructive" : ""}`}>
                  {stats.pedidosAtrasados}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="rounded-lg bg-success/10 p-2">
                <Truck className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Entregadores</p>
                <p className="text-xl font-bold">{stats.entregadoresOnline}/{stats.entregadoresTotal}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="rounded-lg bg-destructive/10 p-2">
                <PhoneMissed className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Perdidas</p>
                <p className="text-xl font-bold">{stats.perdidas}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="rounded-lg bg-accent p-2">
                <BarChart3 className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tempo Médio</p>
                <p className="text-xl font-bold">{stats.tempoMedio}s</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* === TABS === */}
        <Tabs defaultValue="fila">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="fila" className="gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5" />
              Fila de Pedidos
              {stats.pedidosNaFila > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{stats.pedidosNaFila}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="chamadas" className="gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              Chamadas
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Chat WhatsApp
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Respostas Rápidas
            </TabsTrigger>
          </TabsList>

          {/* === FILA DE PEDIDOS === */}
          <TabsContent value="fila" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pedidos Ativos</CardTitle>
              </CardHeader>
              <CardContent>
                {pedidosFila.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum pedido na fila! 🎉</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pedidosFila.map((pedido) => {
                      const mins = differenceInMinutes(new Date(), new Date(pedido.created_at));
                      const atrasado = pedido.status === "pendente" && mins > 30;
                      const statusInfo = pedidoStatusConfig[pedido.status] || pedidoStatusConfig.pendente;
                      return (
                        <div
                          key={pedido.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            atrasado ? "border-destructive/50 bg-destructive/5" : "border-border"
                          }`}
                        >
                          <div className={`h-2.5 w-2.5 rounded-full ${statusInfo.color} flex-shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">
                                {(pedido.clientes as any)?.nome || "Cliente"}
                              </span>
                              <Badge variant="outline" className="text-xs">{statusInfo.label}</Badge>
                              {atrasado && (
                                <Badge variant="destructive" className="text-xs gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  {mins}min
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span>{format(new Date(pedido.created_at), "HH:mm")}</span>
                              <span>R$ {Number(pedido.valor_total).toFixed(2)}</span>
                              {pedido.canal_venda && <span>{pedido.canal_venda}</span>}
                              {(pedido.entregadores as any)?.nome && (
                                <span className="flex items-center gap-1">
                                  <Truck className="h-3 w-3" />
                                  {(pedido.entregadores as any).nome}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7"
                              onClick={() => navigate(`/vendas/pedidos?pedido=${pedido.id}`)}
                            >
                              Ver
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === CHAMADAS === */}
          <TabsContent value="chamadas" className="mt-4 space-y-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por telefone ou nome..."
                      className="pl-9"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                    />
                  </div>
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="recebida">Recebidas</SelectItem>
                      <SelectItem value="atendida">Atendidas</SelectItem>
                      <SelectItem value="perdida">Perdidas</SelectItem>
                      <SelectItem value="retornar">Retornar</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={periodo} onValueChange={setPeriodo}>
                    <SelectTrigger className="w-full sm:w-[140px]">
                      <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hoje">Hoje</SelectItem>
                      <SelectItem value="7d">Últimos 7 dias</SelectItem>
                      <SelectItem value="30d">Últimos 30 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
                ) : chamadasFiltradas.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma chamada no período</p>
                ) : (
                  <div className="space-y-1">
                    {chamadasFiltradas.map((chamada, idx) => {
                      const status = statusConfig[chamada.status] || statusConfig.recebida;
                      const dur = formatDuracao(chamada.duracao_segundos);
                      return (
                        <div key={chamada.id}>
                          {idx > 0 && <Separator className="my-3" />}
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-full bg-muted">
                              {chamada.tipo === "whatsapp" ? (
                                <MessageSquare className="h-4 w-4 text-success" />
                              ) : (
                                <Phone className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium truncate">
                                  {chamada.cliente_nome || formatDid(chamada.telefone) || "Desconhecido"}
                                </span>
                                <Badge variant={status.variant} className="text-xs">
                                  {status.label}
                                </Badge>
                                {dur && (
                                  <Badge variant="outline" className="text-xs gap-1">
                                    <Timer className="h-3 w-3" /> {dur}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-0.5">
                                {chamada.cliente_nome && chamada.telefone && (
                                  <span className="font-mono">{formatDid(chamada.telefone)}</span>
                                )}
                                {chamada.did && (
                                  <span className="flex items-center gap-1">
                                    <PhoneIncoming className="h-3 w-3" />
                                    <span className="font-mono">{formatDid(chamada.did)}</span>
                                  </span>
                                )}
                                <Clock className="h-3 w-3" />
                                <span>
                                  {formatDistanceToNow(new Date(chamada.created_at), { addSuffix: true, locale: ptBR })}
                                </span>
                              </div>
                              {chamada.observacoes && (
                                <p className="text-xs text-muted-foreground italic truncate mt-0.5">
                                  {chamada.observacoes}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1 text-xs h-7"
                                onClick={() => openWhatsappFor(chamada.telefone || "", chamada.cliente_nome)}
                              >
                                <Zap className="h-3.5 w-3.5 text-success" />
                              </Button>
                              {chamada.status !== "retornar" && chamada.status !== "atendida" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="gap-1 text-xs h-7"
                                  onClick={() => handleMarcarRetornar(chamada.id)}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-xs h-7"
                                onClick={() => handleNovaVenda(chamada)}
                              >
                                <ShoppingCart className="h-3.5 w-3.5" />
                                Venda
                              </Button>
                              {chamada.cliente_id && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="gap-1 text-xs h-7"
                                  onClick={() => navigate(`/clientes/cadastro/${chamada.cliente_id}`)}
                                >
                                  <User className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === RESPOSTAS RÁPIDAS WHATSAPP === */}
          <TabsContent value="chat" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-success" />
                  Chat WhatsApp · (43) 3524-1094
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WhatsAppInbox className="h-[600px]" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-5 w-5 text-success" />
                    Templates de Mensagem
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {whatsappTemplates.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(tmpl.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors text-sm ${
                        selectedTemplate === tmpl.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <span className="font-medium">{tmpl.label}</span>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tmpl.template}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Enviar Mensagem</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Telefone do Destinatário</label>
                    <Input
                      placeholder="(XX) XXXXX-XXXX"
                      value={whatsappDestinatario}
                      onChange={(e) => setWhatsappDestinatario(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Mensagem</label>
                    <Textarea
                      rows={5}
                      value={whatsappMsg}
                      onChange={(e) => setWhatsappMsg(e.target.value)}
                      placeholder="Selecione um template ou escreva sua mensagem..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Variáveis: {"{nome}"}, {"{pedido_id}"}, {"{previsao}"}, {"{entregador}"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 gap-2" onClick={handleSendWhatsapp}>
                      <Send className="h-4 w-4" />
                      Enviar via WhatsApp
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleCopyWhatsapp}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* WhatsApp Dialog (triggered from chamadas) */}
        <Dialog open={whatsappOpen} onOpenChange={setWhatsappOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-success" />
                Enviar WhatsApp
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Destinatário</label>
                <Input value={whatsappDestinatario} onChange={(e) => setWhatsappDestinatario(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Template</label>
                <Select value={selectedTemplate} onValueChange={handleSelectTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template" />
                  </SelectTrigger>
                  <SelectContent>
                    {whatsappTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea rows={4} value={whatsappMsg} onChange={(e) => setWhatsappMsg(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWhatsappOpen(false)}>Cancelar</Button>
              <Button className="gap-2" onClick={handleSendWhatsapp}>
                <Send className="h-4 w-4" />
                Enviar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

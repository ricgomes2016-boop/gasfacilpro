import { useState, useRef, useEffect, useCallback } from "react";
import { AlertTriangle, Bot, CheckCircle2, Send, Trash2, MessageSquarePlus, History, ChevronLeft, XCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { VoiceInputButton, TtsButton } from "./VoiceButton";

type Msg = { role: "user" | "assistant"; content: string };
type Conversa = { id: string; titulo: string; created_at: string };
type PendingAction = { action: string; params: Record<string, unknown>; preview: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
];

function ChartRenderer({ chartMeta }: { chartMeta: { type: string; data: any[] } }) {
  if (!chartMeta?.data?.length) return null;

  const keys = Object.keys(chartMeta.data[0]);
  const labelKey = keys[0];
  const valueKeys = keys.slice(1).filter(k => typeof chartMeta.data[0][k] === "number");

  if (valueKeys.length === 0) return null;

  const commonProps = {
    data: chartMeta.data,
    margin: { top: 5, right: 10, left: 0, bottom: 5 },
  };

  return (
    <div className="my-3 p-3 bg-background rounded-lg border border-border">
      <ResponsiveContainer width="100%" height={220}>
        {chartMeta.type === "pie" ? (
          <PieChart>
            <Pie
              data={chartMeta.data}
              dataKey={valueKeys[0]}
              nameKey={labelKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, value }) => `${name}: ${value}`}
            >
              {chartMeta.data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        ) : chartMeta.type === "line" ? (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            {valueKeys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        ) : chartMeta.type === "area" ? (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            {valueKeys.map((k, i) => (
              <Area key={k} type="monotone" dataKey={k} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.3} />
            ))}
          </AreaChart>
        ) : (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            {valueKeys.map((k, i) => (
              <Bar key={k} dataKey={k} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function parseChartMeta(content: string): { text: string; chart: { type: string; data: any[] } | null } {
  const match = content.match(/\[CHART_META\](.*?)\[\/CHART_META\]/s);
  if (!match) return { text: content, chart: null };
  try {
    const chart = JSON.parse(match[1]);
    const text = content.replace(/\[CHART_META\].*?\[\/CHART_META\]/s, "").trim();
    return { text, chart };
  } catch {
    return { text: content, chart: null };
  }
}

function parsePendingActions(content: string): { text: string; pendingActions: PendingAction[] } {
  const match = content.match(/\[PENDING_ACTIONS\](.*?)\[\/PENDING_ACTIONS\]/s);
  if (!match) return { text: content, pendingActions: [] };
  try {
    const pendingActions = JSON.parse(match[1]);
    return {
      text: content.replace(/\[PENDING_ACTIONS\].*?\[\/PENDING_ACTIONS\]/s, "").trim(),
      pendingActions: Array.isArray(pendingActions) ? pendingActions : [],
    };
  } catch {
    return { text: content.replace(/\[PENDING_ACTIONS\].*?\[\/PENDING_ACTIONS\]/s, "").trim(), pendingActions: [] };
  }
}

function getDynamicSuggestions(): string[] {
  const hour = new Date().getHours();
  const day = new Date().getDate();

  const base = [
    "Quais os 5 produtos mais vendidos?",
    "Quantos clientes ativos temos?",
  ];

  if (hour < 12) {
    base.unshift("Qual foi o faturamento de ontem?", "Quantos pedidos estão pendentes agora?");
  } else if (hour < 18) {
    base.unshift("Quantos entregadores estão em rota?", "Qual o faturamento de hoje até agora?");
  } else {
    base.unshift("Resumo do dia: vendas, entregas e caixa", "Quais pedidos ainda não foram entregues hoje?");
  }

  if (day >= 25) {
    base.push("Quais contas vencem nos próximos 5 dias?", "Resumo financeiro do mês");
  }

  return base.slice(0, 6);
}

export function AiAssistantChat({
  fullPage = false,
  enableVoice = false,
  fullPageHeightClass,
}: {
  fullPage?: boolean;
  enableVoice?: boolean;
  fullPageHeightClass?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaAtual, setConversaAtual] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { unidadeAtual } = useUnidade();
  const { user } = useAuth();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load conversations list
  useEffect(() => {
    if (!user) return;
    loadConversas();
  }, [user]);

  const loadConversas = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ai_conversas")
      .select("id, titulo, created_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (data) setConversas(data);
  };

  const loadConversa = async (conversaId: string) => {
    const { data } = await supabase
      .from("ai_mensagens")
      .select("role, content")
      .eq("conversa_id", conversaId)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(data as Msg[]);
      setConversaAtual(conversaId);
      setShowHistory(false);
    }
  };

  const saveMessage = async (msg: Msg, conversaId: string) => {
    await supabase.from("ai_mensagens").insert({
      conversa_id: conversaId,
      role: msg.role,
      content: msg.content,
    });
  };

  const createNewConversa = async (firstMessage: string): Promise<string | null> => {
    if (!user) return null;
    const titulo = firstMessage.slice(0, 60) + (firstMessage.length > 60 ? "..." : "");
    const { data, error } = await supabase
      .from("ai_conversas")
      .insert({ user_id: user.id, titulo })
      .select("id")
      .single();
    if (error || !data) return null;
    setConversaAtual(data.id);
    loadConversas();
    return data.id;
  };

  const deleteConversa = async (id: string) => {
    await supabase.from("ai_conversas").delete().eq("id", id);
    if (conversaAtual === id) {
      setConversaAtual(null);
      setMessages([]);
    }
    loadConversas();
  };

  const newChat = () => {
    setConversaAtual(null);
    setMessages([]);
    setShowHistory(false);
  };

  const sendMessage = async (options?: { content?: string; pendingActions?: PendingAction[]; actionConfirmation?: "confirm" | "cancel" }) => {
    const content = options?.content ?? input.trim();
    if (!content.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: content.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    if (!options?.content) setInput("");
    setIsLoading(true);

    // Persist
    let activeConversa = conversaAtual;
    if (!activeConversa) {
      activeConversa = await createNewConversa(userMsg.content);
    }
    if (activeConversa) {
      saveMessage(userMsg, activeConversa);
    }

    let assistantSoFar = "";

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        const errMsg: Msg = { role: "assistant", content: "❌ Sessão expirada. Faça login novamente para usar o Assistente IA." };
        setMessages((prev) => [...prev, errMsg]);
        if (activeConversa) saveMessage(errMsg, activeConversa);
        setIsLoading(false);
        return;
      }

      if (!unidadeAtual?.id) {
        const errMsg: Msg = { role: "assistant", content: "Selecione uma unidade no topo do sistema antes de usar o Assistente IA." };
        setMessages((prev) => [...prev, errMsg]);
        if (activeConversa) saveMessage(errMsg, activeConversa);
        setIsLoading(false);
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: updatedMessages,
          unidade_id: unidadeAtual.id,
          pending_actions: options?.pendingActions,
          action_confirmation: options?.actionConfirmation,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro na comunicação" }));
        const errMsg: Msg = { role: "assistant", content: `❌ ${err.error || "Erro inesperado"}` };
        setMessages((prev) => [...prev, errMsg]);
        if (activeConversa) saveMessage(errMsg, activeConversa);
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              const current = assistantSoFar;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: current } : m));
                }
                return [...prev, { role: "assistant", content: current }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Flush remaining
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              const current = assistantSoFar;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: current } : m));
                }
                return [...prev, { role: "assistant", content: current }];
              });
            }
          } catch { /* ignore */ }
        }
      }

      // Save final assistant message
      if (assistantSoFar && activeConversa) {
        saveMessage({ role: "assistant", content: assistantSoFar }, activeConversa);
        // Update conversa updated_at
        await supabase.from("ai_conversas").update({ updated_at: new Date().toISOString() }).eq("id", activeConversa);
      }
    } catch (e) {
      console.error("Stream error:", e);
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Erro ao comunicar com o assistente." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmPendingActions = (pendingActions: PendingAction[]) => {
    void sendMessage({
      content: "Confirmo. Pode executar.",
      pendingActions,
      actionConfirmation: "confirm",
    });
  };

  const cancelPendingActions = () => {
    setMessages((prev) => [...prev, { role: "user", content: "Cancelar ação." }, { role: "assistant", content: "Ação cancelada. Nada foi alterado no sistema." }]);
  };

  const suggestions = getDynamicSuggestions();

  // History sidebar
  if (showHistory && fullPage) {
    return (
      <div className={cn("flex flex-col", fullPage ? fullPageHeightClass || "h-[calc(100vh-120px)]" : "h-full")}>
        <div className="flex items-center gap-2 p-3 border-b">
          <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-sm">Conversas Anteriores</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={newChat}>
            <MessageSquarePlus className="h-4 w-4 mr-1" /> Nova
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversas.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conversa salva</p>
          )}
          {conversas.map((c) => (
            <div key={c.id} className={cn(
              "flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-accent text-sm group",
              conversaAtual === c.id && "bg-accent"
            )}>
              <button className="flex-1 text-left truncate" onClick={() => loadConversa(c.id)}>
                <span className="font-medium">{c.titulo}</span>
                <span className="block text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); deleteConversa(c.id); }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col overflow-hidden bg-card", fullPage ? fullPageHeightClass || "h-[calc(100vh-260px)] sm:h-[calc(100vh-220px)]" : "h-full min-h-0")}>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 min-h-0 bg-gradient-to-b from-muted/20 to-background">
        {messages.length === 0 && (
          <div className="space-y-5 py-4">
            <div className="text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3 ring-1 ring-primary/20">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground">Olá! Como posso ajudar?</p>
              <p className="text-xs text-muted-foreground mt-1">Escolha uma sugestão ou digite sua pergunta.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); }}
                  className="group text-left text-xs p-3 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary/60 group-hover:text-primary mt-0.5" />
                    <span className="leading-relaxed">{s}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const parsedPending = msg.role === "assistant" ? parsePendingActions(msg.content) : { text: msg.content, pendingActions: [] };
          const { text, chart } = msg.role === "assistant" ? parseChartMeta(parsedPending.text) : { text: msg.content, chart: null };
          return (
            <div key={i} className={cn("flex gap-2 sm:gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                  msg.role === "user"
                    ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md"
                    : "bg-card border border-border/60 text-foreground rounded-bl-md"
                )}
              >
                {msg.role === "assistant" ? (
                  <>
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_table]:w-full [&_th]:px-2 [&_td]:px-2 [&_th]:py-1 [&_td]:py-1 [&_table]:border-collapse [&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border [&_p]:leading-relaxed [&_p:last-child]:mb-0">
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                    {chart && <ChartRenderer chartMeta={chart} />}
                    {parsedPending.pendingActions.length > 0 && (
                      <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground">Confirmação necessária</p>
                            <div className="mt-2 space-y-1">
                              {parsedPending.pendingActions.map((action, idx) => (
                                <p key={`${action.action}-${idx}`} className="break-words text-xs text-muted-foreground">
                                  {action.preview || action.action}
                                </p>
                              ))}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button size="sm" onClick={() => confirmPendingActions(parsedPending.pendingActions)} disabled={isLoading}>
                                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                                Confirmar
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelPendingActions} disabled={isLoading}>
                                <XCircle className="mr-1.5 h-4 w-4" />
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {enableVoice && text.length > 10 && (
                      <div className="flex justify-end mt-1 -mr-1">
                        <TtsButton text={text} />
                      </div>
                    )}
                  </>
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start gap-2 sm:gap-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="bg-card border border-border/60 rounded-2xl rounded-bl-md px-4 py-3 text-sm text-muted-foreground shadow-sm">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/60 bg-card/80 backdrop-blur p-2.5 sm:p-3 flex gap-1.5 sm:gap-2 items-center">
        {fullPage && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-10 w-10 rounded-xl"
            onClick={() => setShowHistory(true)}
            title="Histórico de conversas"
          >
            <History className="h-4 w-4" />
          </Button>
        )}
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-10 w-10 rounded-xl"
            onClick={newChat}
            title="Nova conversa"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        )}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void sendMessage()}
          placeholder="Pergunte algo ou peça uma ação..."
          disabled={isLoading}
          className="flex-1 h-10 rounded-xl border-border/60 focus-visible:ring-primary/40"
        />
        {enableVoice && (
          <VoiceInputButton
            onResult={(text) => { setInput(text); }}
            disabled={isLoading}
          />
        )}
        <Button
          size="icon"
          onClick={() => void sendMessage()}
          disabled={isLoading || !input.trim()}
          className="h-10 w-10 rounded-xl shrink-0 bg-gradient-to-br from-primary to-primary/80 shadow-md shadow-primary/20"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

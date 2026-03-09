import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Trash2, MessageSquarePlus, History, ChevronLeft } from "lucide-react";
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

export function AiAssistantChat({ fullPage = false, enableVoice = false }: { fullPage?: boolean; enableVoice?: boolean }) {
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

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
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
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: updatedMessages,
          unidade_id: unidadeAtual?.id || null,
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

  const suggestions = getDynamicSuggestions();

  // History sidebar
  if (showHistory && fullPage) {
    return (
      <div className={cn("flex flex-col", fullPage ? "h-[calc(100vh-120px)]" : "h-full")}>
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
    <div className={cn("flex flex-col border rounded-xl bg-card overflow-hidden", fullPage ? "h-[calc(100vh-120px)]" : "h-full")}>
      {/* Messages */}
      <div ref={scrollRef} className={cn("flex-1 overflow-y-auto p-4 space-y-4", !fullPage && "max-h-[400px]")}>
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="text-center text-muted-foreground text-sm">
              <Bot className="mx-auto h-10 w-10 mb-2 text-primary" />
              <p className="font-medium text-foreground">Olá! Sou o GásBot, assistente IA do sistema.</p>
              <p>Pergunte sobre dados, peça análises ou execute ações no sistema.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); }}
                  className="text-left text-xs p-2 rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const { text, chart } = msg.role === "assistant" ? parseChartMeta(msg.content) : { text: msg.content, chart: null };
          return (
            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-4 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {msg.role === "assistant" ? (
                  <>
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_table]:w-full [&_th]:px-2 [&_td]:px-2 [&_th]:py-1 [&_td]:py-1 [&_table]:border-collapse [&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border">
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                    {chart && <ChartRenderer chartMeta={chart} />}
                    {enableVoice && text.length > 10 && (
                      <div className="flex justify-end mt-1">
                        <TtsButton text={text} />
                      </div>
                    )}
                  </>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          );
        })}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl px-4 py-2 text-sm text-muted-foreground">
              <span className="animate-pulse">Pensando...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-3 flex gap-2">
        {fullPage && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
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
            className="shrink-0"
            onClick={newChat}
            title="Nova conversa"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        )}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Pergunte algo ou peça uma ação..."
          disabled={isLoading}
          className="flex-1"
        />
        {enableVoice && (
          <VoiceInputButton
            onResult={(text) => { setInput(text); }}
            disabled={isLoading}
          />
        )}
        <Button size="icon" onClick={sendMessage} disabled={isLoading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

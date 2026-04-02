import { useState, useRef, useEffect } from "react";
import { TransportadoraLayout } from "@/components/transportadora/TransportadoraLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Send, Loader2, Bot, User } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function TranspIA() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transp-ia-analista`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: [...messages, userMsg] }),
        }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(errText || "Erro na resposta da IA");
      }

      if (!resp.body) throw new Error("Sem body na resposta");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantSoFar = "";
      let textBuffer = "";

      const upsertAssistant = (nextChunk: string) => {
        assistantSoFar += nextChunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

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
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao consultar IA");
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Erro ao consultar a IA. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TransportadoraLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)]">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />IA Analista
          </h1>
          <p className="text-muted-foreground text-sm">Pergunte sobre custos, rotas e eficiência</p>
        </div>

        <Card className="flex-1 flex flex-col border-border/40 overflow-hidden">
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Bot className="h-12 w-12 mx-auto text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">Pergunte algo como:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {["Qual filial é mais cara?", "Custo real por unidade esse mês?", "Qual rota tem prejuízo?"].map((q) => (
                      <Button key={q} variant="outline" size="sm" className="text-xs" onClick={() => { setInput(q); }}>
                        {q}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground"}`}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : m.content}
                </div>
                {m.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted/60 rounded-xl px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </CardContent>

          <div className="p-3 border-t border-border/40">
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte sobre custos, rotas, eficiência..."
                className="min-h-[44px] max-h-[120px] resize-none"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              />
              <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </TransportadoraLayout>
  );
}

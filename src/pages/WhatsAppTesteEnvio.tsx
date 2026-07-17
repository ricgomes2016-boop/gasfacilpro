import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Send, Loader2, CheckCheck, Check, Clock, AlertTriangle, Webhook, Trash2, Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type StatusHist = { status: string; at: string; timestamp?: string | null; errors?: unknown };
interface Envio {
  id: string;
  unidade_id: string;
  to_number: string;
  message: string;
  wamid: string | null;
  status: string;
  status_history: StatusHist[] | null;
  error: string | null;
  webhook_received_at: string | null;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pendente", color: "bg-muted text-muted-foreground", icon: <Clock className="h-3 w-3" /> },
  sending: { label: "Enviando…", color: "bg-info/10 text-info border-info/30", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  sent: { label: "Enviado", color: "bg-info/10 text-info border-info/30", icon: <Check className="h-3 w-3" /> },
  delivered: { label: "Entregue", color: "bg-success/10 text-success border-success/30", icon: <CheckCheck className="h-3 w-3" /> },
  read: { label: "Lido", color: "bg-success/15 text-success border-success/40", icon: <CheckCheck className="h-3 w-3" /> },
  failed: { label: "Falhou", color: "bg-destructive/10 text-destructive border-destructive/30", icon: <AlertTriangle className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status, color: "bg-muted", icon: null };
  return (
    <Badge variant="outline" className={`gap-1 ${meta.color}`}>
      {meta.icon} {meta.label}
    </Badge>
  );
}

export default function WhatsAppTesteEnvio() {
  const [unidades, setUnidades] = useState<{ id: string; nome: string }[]>([]);
  const [unidadeId, setUnidadeId] = useState<string>("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("Olá! Esta é uma mensagem de teste do GásFácil Pro 🚀");
  const [useTemplate, setUseTemplate] = useState(true);
  const [sending, setSending] = useState(false);
  const [envios, setEnvios] = useState<Envio[]>([]);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";
  const webhookUrl = useMemo(
    () => `https://${projectId}.supabase.co/functions/v1/meta-webhook`,
    [projectId]
  );

  // Carrega unidades da empresa
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!prof?.empresa_id) return;
      const { data: us } = await supabase
        .from("unidades")
        .select("id, nome")
        .eq("empresa_id", prof.empresa_id)
        .eq("ativo", true)
        .order("nome");
      setUnidades(us || []);
      if (us?.length) setUnidadeId(us[0].id);
    })();
  }, []);

  // Carrega envios e assina realtime
  useEffect(() => {
    if (!unidadeId) return;
    let mounted = true;

    (async () => {
      const { data } = await supabase
        .from("whatsapp_test_envios")
        .select("*")
        .eq("unidade_id", unidadeId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (mounted) setEnvios((data as unknown as Envio[]) || []);
    })();

    const channel = supabase
      .channel(`wa-test-${unidadeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_test_envios", filter: `unidade_id=eq.${unidadeId}` },
        (payload) => {
          setEnvios((prev) => {
            if (payload.eventType === "INSERT") {
              return [payload.new as Envio, ...prev].slice(0, 20);
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((e) => (e.id === (payload.new as Envio).id ? (payload.new as Envio) : e));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((e) => e.id !== (payload.old as Envio).id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [unidadeId]);

  async function handleSend() {
    if (!unidadeId) return toast.error("Selecione uma unidade");
    const digits = to.replace(/\D/g, "");
    if (digits.length < 10) return toast.error("Informe um número válido com DDD (ex: 5543999990000)");
    if (!useTemplate && !message.trim()) return toast.error("Mensagem vazia");

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-test-send", {
        body: {
          unidade_id: unidadeId,
          to: digits,
          message: useTemplate ? null : message,
          use_template: useTemplate,
          template_name: "hello_world",
          template_lang: "en_US",
        },
      });
      if (error) throw error;
      if (!data?.ok) {
        toast.error(data?.error || "Falha ao enviar");
      } else {
        toast.success("Mensagem enviada — aguardando confirmação do webhook…");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("whatsapp_test_envios").delete().eq("id", id);
    if (error) toast.error(error.message);
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Teste de Envio WhatsApp</h1>
        <p className="text-muted-foreground text-sm">
          Envie uma mensagem real pela Meta Cloud API e acompanhe o status retornado pelo webhook em tempo real.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova mensagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={unidadeId} onValueChange={setUnidadeId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Número de destino</Label>
              <Input
                placeholder="55 43 99999-0000"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                inputMode="tel"
              />
              <p className="text-xs text-muted-foreground">Formato internacional, somente dígitos serão usados.</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3 bg-muted/30">
            <div className="space-y-0.5">
              <Label className="text-sm">Enviar via template <code className="text-xs">hello_world</code></Label>
              <p className="text-xs text-muted-foreground">
                Obrigatório quando o destinatário não falou com você nas últimas 24h.
              </p>
            </div>
            <Switch checked={useTemplate} onCheckedChange={setUseTemplate} />
          </div>

          {!useTemplate && (
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
              <p className="text-xs text-muted-foreground flex items-start gap-1">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                Texto livre só funciona dentro da janela de 24h após o cliente te enviar uma mensagem. Caso contrário a Meta rejeita com erro 131047.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Webhook className="h-3 w-3" /> Webhook configurado: <code className="text-[10px]">{webhookUrl}</code>
            </div>
            <Button onClick={handleSend} disabled={sending || !unidadeId} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar mensagem
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos envios (atualiza em tempo real)</CardTitle>
        </CardHeader>
        <CardContent>
          {envios.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum envio ainda.</p>
          ) : (
            <ul className="space-y-3">
              {envios.map((e) => (
                <li key={e.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={e.status} />
                        <span className="font-mono text-sm">+{e.to_number}</span>
                        <span className="text-xs text-muted-foreground">
                          · {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm">{e.message}</p>
                      {e.error && (
                        <p className="text-xs text-destructive break-words">⚠ {e.error}</p>
                      )}
                      {e.wamid && (
                        <p className="text-[10px] text-muted-foreground font-mono break-all">wamid: {e.wamid}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {Array.isArray(e.status_history) && e.status_history.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap pt-1 border-t">
                      {e.status_history.map((h, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] gap-1">
                          {STATUS_META[h.status]?.icon}
                          {STATUS_META[h.status]?.label || h.status}
                          <span className="text-muted-foreground">
                            {new Date(h.at).toLocaleTimeString("pt-BR")}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, MinusCircle, Loader2, Stethoscope, Send,
  Key, Building2, Phone, Shield, ArrowLeft, Info,
} from "lucide-react";
import { Link } from "react-router-dom";

interface StepResult {
  step: string;
  status: "ok" | "erro" | "skip";
  message: string;
  data?: unknown;
}

interface DiagResult {
  config_id: string;
  provedor: string;
  phone_id: string;
  waba_id: string;
  numero: string;
  results: StepResult[];
}

const STEP_LABELS: Record<string, { label: string; help: string }> = {
  token_valido: {
    label: "Token Meta válido",
    help: "Verifique se o token de acesso foi gerado corretamente no Meta Business Manager > Configurações do App > Tokens.",
  },
  waba_acessivel: {
    label: "WABA acessível",
    help: "O WABA ID deve pertencer à conta Meta Business vinculada ao token. Verifique em business.facebook.com > WhatsApp Manager.",
  },
  numero_registrado: {
    label: "Número registrado na Cloud API",
    help: "O número precisa estar registrado e com verificação em 2 etapas ATIVA. Se aparecer 'EXPIRED', vá em Meta Business > WhatsApp Manager > Números, clique no número e reenvie o PIN de 6 dígitos.",
  },
  webhook_configurado: {
    label: "Webhook apontando para o GásFácil",
    help: "A Meta precisa enviar as mensagens recebidas para a URL do nosso servidor. Configure em Meta for Developers → seu App → WhatsApp → Configuração → Webhook (cole a URL e marque o campo 'messages').",
  },
  subscribed_apps: {
    label: "App inscrito no WABA",
    help: "Sem app inscrito no WABA, a Meta não dispara webhooks. Em Meta for Developers → App → WhatsApp → Configuração, clique em 'Inscrever' e marque 'messages'.",
  },
  registro_api: {
    label: "Registro automático via API",
    help: "Tentativa de registrar o número automaticamente. Se falhar, registre manualmente no painel Meta Business.",
  },
  envio_teste: {
    label: "Envio de mensagem de teste",
    help: "Envia uma mensagem de texto via Cloud API. Se falhar, verifique se o número de destino é um número de teste cadastrado (modo sandbox) ou se o app está em modo Live.",
  },
};

export default function AdminDiagnosticoWhatsApp() {
  const [selectedUnidade, setSelectedUnidade] = useState<string>("");
  const [numeroTeste, setNumeroTeste] = useState("");
  const [running, setRunning] = useState(false);
  const [diagResult, setDiagResult] = useState<DiagResult | null>(null);

  const { data: unidades } = useQuery({
    queryKey: ["admin-unidades-diag"],
    queryFn: async () => {
      const { data } = await supabase.from("unidades").select("id, nome, tipo").eq("ativo", true).order("nome");
      return data || [];
    },
  });

  const { data: whatsappConfig } = useQuery({
    queryKey: ["admin-whatsapp-diag", selectedUnidade],
    enabled: !!selectedUnidade,
    queryFn: async () => {
      const { data } = await supabase
        .from("integracoes_whatsapp")
        .select("id, provedor, provedor_tipo, numero_telefone, meta_phone_number_id, meta_waba_id, meta_access_token, token, status_conexao, ultima_verificacao")
        .eq("unidade_id", selectedUnidade)
        .maybeSingle();
      return data;
    },
  });

  const maskToken = (t: string | null) => {
    if (!t) return "—";
    if (t.length <= 10) return "****";
    return t.substring(0, 6) + "..." + t.substring(t.length - 4);
  };

  const runDiagnostic = async () => {
    if (!selectedUnidade) {
      toast.error("Selecione uma unidade");
      return;
    }
    setRunning(true);
    setDiagResult(null);

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/meta-diagnostico`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unidade_id: selectedUnidade, numero_teste: numeroTeste || undefined }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setDiagResult(data);
        const allOk = data.results.every((r: StepResult) => r.status === "ok" || r.status === "skip");
        if (allOk) toast.success("Diagnóstico concluído com sucesso!");
        else toast.warning("Diagnóstico concluído com erros.");
      }
    } catch (e: unknown) {
      toast.error("Erro ao executar diagnóstico: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRunning(false);
    }
  };

  const StatusIcon = ({ status }: { status: "ok" | "erro" | "skip" }) => {
    if (status === "ok") return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (status === "erro") return <XCircle className="h-5 w-5 text-red-500" />;
    return <MinusCircle className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/whatsapp-config">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-primary" />
            Diagnóstico WhatsApp Meta
          </h1>
          <p className="text-muted-foreground text-sm">Verificação passo-a-passo da integração Meta Cloud API</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Configuração
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Unidade</Label>
              <Select value={selectedUnidade} onValueChange={setSelectedUnidade}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {unidades?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome} ({u.tipo})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {whatsappConfig && (
              <>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provedor:</span>
                    <Badge variant="outline">{whatsappConfig.provedor_tipo || whatsappConfig.provedor}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Número:</span>
                    <span className="font-mono">{whatsappConfig.numero_telefone || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone ID:</span>
                    <span className="font-mono text-xs">{whatsappConfig.meta_phone_number_id || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">WABA ID:</span>
                    <span className="font-mono text-xs">{whatsappConfig.meta_waba_id || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Token:</span>
                    <span className="font-mono text-xs">{maskToken(whatsappConfig.meta_access_token || whatsappConfig.token)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={whatsappConfig.status_conexao === "conectado" ? "default" : "destructive"}>
                      {whatsappConfig.status_conexao || "—"}
                    </Badge>
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div>
              <Label>Número de teste (opcional)</Label>
              <Input
                placeholder="43999999999"
                value={numeroTeste}
                onChange={(e) => setNumeroTeste(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Número para enviar mensagem de teste na etapa 5
              </p>
            </div>

            <Button onClick={runDiagnostic} disabled={running || !selectedUnidade} className="w-full">
              {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Stethoscope className="h-4 w-4 mr-2" />}
              {running ? "Executando..." : "Executar Diagnóstico"}
            </Button>
          </CardContent>
        </Card>

        {/* Results panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-4 w-4" /> Resultado do Diagnóstico
            </CardTitle>
            <CardDescription>5 verificações para garantir a integração Meta</CardDescription>
          </CardHeader>
          <CardContent>
            {!diagResult && !running && (
              <div className="text-center py-12 text-muted-foreground">
                <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Selecione uma unidade e clique em "Executar Diagnóstico"</p>
              </div>
            )}

            {running && (
              <div className="text-center py-12">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                <p className="text-muted-foreground">Executando verificações...</p>
              </div>
            )}

            {diagResult && !running && (
              <div className="space-y-4">
                {diagResult.results.map((r, i) => {
                  const meta = STEP_LABELS[r.step] || { label: r.step, help: "" };
                  return (
                    <div key={r.step} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-muted-foreground w-6">{i + 1}</span>
                        <StatusIcon status={r.status} />
                        <div className="flex-1">
                          <p className="font-medium">{meta.label}</p>
                          <p className="text-sm text-muted-foreground">{r.message}</p>
                        </div>
                        <Badge
                          variant={r.status === "ok" ? "default" : r.status === "erro" ? "destructive" : "secondary"}
                        >
                          {r.status === "ok" ? "OK" : r.status === "erro" ? "ERRO" : "PULADO"}
                        </Badge>
                      </div>
                      {r.status === "erro" && meta.help && (
                        <Alert className="mt-2">
                          <Info className="h-4 w-4" />
                          <AlertDescription className="text-xs">{meta.help}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

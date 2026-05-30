import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, XCircle, MinusCircle, Loader2, Save, ShieldCheck, KeyRound,
  Phone, Building2, Webhook, Copy, CheckCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type StepStatus = "ok" | "erro" | "skip";
interface StepResult { step: string; status: StepStatus; message: string; data?: unknown }
interface ValidacaoResp {
  ok: boolean;
  error?: string;
  results?: StepResult[];
  token_info?: { app_id?: string; application?: string; type?: string; expires_at?: number };
  phone_info?: { display_phone_number?: string; verified_name?: string; quality_rating?: string };
  waba_info?: { id?: string; name?: string };
}

const STEP_LABEL: Record<string, string> = {
  token: "Token de acesso",
  phone: "Phone Number ID",
  waba: "WhatsApp Business Account (WABA)",
  vinculo: "Vínculo Phone × WABA",
  webhook_assinatura: "Inscrição do app na WABA",
};

function StepBadge({ status }: { status: StepStatus }) {
  if (status === "ok") return <Badge className="bg-green-500/10 text-green-700 border-green-500/30 gap-1"><CheckCircle2 className="h-3 w-3" /> OK</Badge>;
  if (status === "erro") return <Badge className="bg-destructive/10 text-destructive border-destructive/30 gap-1"><XCircle className="h-3 w-3" /> Erro</Badge>;
  return <Badge variant="outline" className="gap-1 text-muted-foreground"><MinusCircle className="h-3 w-3" /> Pulado</Badge>;
}

export default function WhatsAppCredenciais() {
  const [unidades, setUnidades] = useState<{ id: string; nome: string }[]>([]);
  const [unidadeId, setUnidadeId] = useState<string>("");
  const [token, setToken] = useState("");
  const [phoneId, setPhoneId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [verifyToken, setVerifyToken] = useState("gasfacil_meta_verify");
  const [loadingCfg, setLoadingCfg] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resp, setResp] = useState<ValidacaoResp | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";
  const webhookUrl = useMemo(
    () => `https://${projectId}.supabase.co/functions/v1/meta-webhook`,
    [projectId],
  );
  const zapiWebhookUrl = useMemo(
    () => unidadeId
      ? `https://${projectId}.supabase.co/functions/v1/zapi-webhook?unidade_id=${unidadeId}`
      : `https://${projectId}.supabase.co/functions/v1/zapi-webhook?unidade_id=<selecione_unidade>`,
    [projectId, unidadeId],
  );
  const [zapiCopied, setZapiCopied] = useState(false);
  const copyZapiWebhook = async () => {
    if (!unidadeId) { toast.error("Selecione a unidade primeiro"); return; }
    await navigator.clipboard.writeText(zapiWebhookUrl);
    setZapiCopied(true);
    setTimeout(() => setZapiCopied(false), 1500);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("unidades")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      setUnidades(data || []);
    })();
  }, []);

  useEffect(() => {
    if (!unidadeId) {
      setExistingId(null);
      setToken(""); setPhoneId(""); setWabaId("");
      setResp(null);
      return;
    }
    (async () => {
      setLoadingCfg(true);
      const { data } = await supabase
        .from("integracoes_whatsapp")
        .select("id, meta_phone_number_id, meta_waba_id")
        .eq("unidade_id", unidadeId)
        .in("provedor", ["meta", "meta_coex"])
        .maybeSingle();
      let secrets: { meta_access_token?: string | null; meta_verify_token?: string | null } | null = null;
      if (data) {
        const { data: s } = await supabase.rpc("get_whatsapp_integration_secrets", {
          p_unidade_id: unidadeId,
        });
        secrets = Array.isArray(s) ? s[0] : s;
      }
      setLoadingCfg(false);
      if (data) {
        setExistingId(data.id);
        setToken(secrets?.meta_access_token || "");
        setPhoneId(data.meta_phone_number_id || "");
        setWabaId(data.meta_waba_id || "");
        setVerifyToken(secrets?.meta_verify_token || "gasfacil_meta_verify");
      } else {
        setExistingId(null);
        setToken(""); setPhoneId(""); setWabaId("");
        setVerifyToken("gasfacil_meta_verify");
      }
      setResp(null);
    })();
  }, [unidadeId]);

  const handleValidar = async () => {
    if (!token || !phoneId || !wabaId) {
      toast.error("Preencha Token, Phone Number ID e WABA ID");
      return;
    }
    setValidating(true);
    setResp(null);
    try {
      const { data, error } = await supabase.functions.invoke("meta-validar-credenciais", {
        body: { access_token: token.trim(), phone_number_id: phoneId.trim(), waba_id: wabaId.trim() },
      });
      if (error) throw error;
      setResp(data as ValidacaoResp);
      if ((data as ValidacaoResp).ok) toast.success("Credenciais validadas com sucesso!");
      else toast.error("Validação falhou — veja os detalhes abaixo");
    } catch (e: any) {
      toast.error("Erro ao validar: " + (e?.message || "desconhecido"));
    } finally {
      setValidating(false);
    }
  };

  const handleSalvar = async () => {
    if (!unidadeId) { toast.error("Selecione a unidade"); return; }
    if (!resp?.ok) { toast.error("Valide as credenciais antes de salvar"); return; }
    setSaving(true);
    try {
      const payload = {
        unidade_id: unidadeId,
        provedor: "meta",
        meta_access_token: token.trim(),
        token: token.trim(),
        meta_phone_number_id: phoneId.trim(),
        instance_id: phoneId.trim(),
        meta_waba_id: wabaId.trim(),
        meta_verify_token: verifyToken.trim() || "gasfacil_meta_verify",
        numero_telefone: resp.phone_info?.display_phone_number?.replace(/\D/g, "") || null,
        nome_bot: "BIA",
        ativo: true,
        status_conexao: "conectado",
        ultima_verificacao: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (existingId) {
        const { error } = await supabase.from("integracoes_whatsapp").update(payload).eq("id", existingId);
        if (error) throw error;
      } else {
        const { error, data } = await supabase.from("integracoes_whatsapp").insert(payload).select("id").maybeSingle();
        if (error) throw error;
        if (data) setExistingId(data.id);
      }
      toast.success("Configuração salva!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const copyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Credenciais WhatsApp Meta
        </h1>
        <p className="text-sm text-muted-foreground">
          Cadastre, valide e salve o Phone Number ID, WABA ID e Token de uma unidade.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Unidade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={unidadeId} onValueChange={setUnidadeId}>
            <SelectTrigger><SelectValue placeholder="Selecione a unidade..." /></SelectTrigger>
            <SelectContent>
              {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          {loadingCfg && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Carregando configuração existente...</p>}
          {existingId && !loadingCfg && (
            <p className="text-xs text-muted-foreground">Existe configuração salva para esta unidade — os campos foram preenchidos.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Credenciais Meta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold">Access Token (System User permanente) *</Label>
            <Input type="password" className="font-mono text-xs" value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAAxxxxxxx..." />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold">Phone Number ID *</Label>
              <Input className="font-mono text-xs" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} placeholder="ex: 1068574169676609" />
              <p className="text-[10px] text-muted-foreground">WhatsApp Manager → Visão geral → clicar no número.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">WABA ID *</Label>
              <Input className="font-mono text-xs" value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="ex: 1738917314133461" />
              <p className="text-[10px] text-muted-foreground">ID da WhatsApp Business Account.</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold">Verify Token (webhook)</Label>
            <Input className="font-mono text-xs" value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} />
          </div>
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleValidar} disabled={validating || !token || !phoneId || !wabaId} className="gap-2">
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Validar com a Meta
            </Button>
            <Button onClick={handleSalvar} disabled={saving || !resp?.ok || !unidadeId} variant="default" className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar configuração
            </Button>
          </div>
          {!resp?.ok && resp && (
            <p className="text-xs text-destructive">Corrija os erros antes de salvar.</p>
          )}
        </CardContent>
      </Card>

      {resp && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4" /> Resultado da validação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resp.error && <p className="text-sm text-destructive">{resp.error}</p>}
            {(resp.token_info || resp.phone_info || resp.waba_info) && (
              <div className="grid sm:grid-cols-3 gap-3 text-xs">
                {resp.token_info && (
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="font-bold mb-1">Token</p>
                    <p>App: {resp.token_info.application} ({resp.token_info.app_id})</p>
                    <p>Tipo: {resp.token_info.type}</p>
                    <p>Expira: {resp.token_info.expires_at === 0 ? "permanente" : new Date((resp.token_info.expires_at || 0) * 1000).toLocaleString("pt-BR")}</p>
                  </div>
                )}
                {resp.phone_info && (
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="font-bold mb-1">Número</p>
                    <p>{resp.phone_info.display_phone_number}</p>
                    <p>{resp.phone_info.verified_name}</p>
                    <p>Qualidade: {resp.phone_info.quality_rating}</p>
                  </div>
                )}
                {resp.waba_info && (
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="font-bold mb-1">WABA</p>
                    <p>{resp.waba_info.name}</p>
                    <p className="font-mono text-[10px]">{resp.waba_info.id}</p>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              {(resp.results || []).map((r) => (
                <div key={r.step} className="flex items-start gap-3 p-3 rounded-lg border">
                  <StepBadge status={r.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{STEP_LABEL[r.step] || r.step}</p>
                    <p className="text-xs text-muted-foreground break-words">{r.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4" /> Webhook (configure no Meta)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] font-mono bg-muted px-3 py-2 rounded-lg break-all">{webhookUrl}</code>
            <Button variant="outline" size="sm" className="gap-1" onClick={copyWebhook}>
              {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            No painel da WABA: Webhooks → Callback URL = acima · Verify Token = o que você salvou aqui · assinar campo <strong>messages</strong>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4" /> Webhook Z-API (por unidade)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] font-mono bg-muted px-3 py-2 rounded-lg break-all">{zapiWebhookUrl}</code>
            <Button variant="outline" size="sm" className="gap-1" onClick={copyZapiWebhook} disabled={!unidadeId}>
              {zapiCopied ? <CheckCheck className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {zapiCopied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Selecione a unidade acima e cole esta URL no painel Z-API em <strong>Webhooks → Ao receber</strong> (e demais eventos relevantes). O parâmetro <code>?unidade_id=</code> garante que as mensagens caiam isoladas na loja correta — permitindo que Forte (Z-API) e Central Gás (Meta) coexistam no mesmo sistema.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

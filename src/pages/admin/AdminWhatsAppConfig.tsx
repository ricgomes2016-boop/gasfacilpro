import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { INTEGRACOES_WHATSAPP_PUBLIC_COLUMNS } from "@/lib/db/sensitiveColumns";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Wifi, WifiOff, Loader2, QrCode, Settings, RefreshCw, Phone,
  Building2, CheckCircle2, AlertTriangle, Copy,
  Smartphone, Info, Shield,
} from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ProvedorTipo = "meta" | "meta_coex" | "evolution" | "zapi" | "uazapi";
type StatusConexao = "conectado" | "desconectado" | "aguardando";

interface WhatsAppConfig {
  id: string;
  unidade_id: string;
  provedor: string;
  provedor_tipo: ProvedorTipo | null;
  instance_id: string;
  token: string;
  base_url: string | null;
  instancia_nome: string | null;
  instancia_url: string | null;
  instancia_token: string | null;
  numero_telefone: string | null;
  status_conexao: StatusConexao | null;
  ultima_verificacao: string | null;
  qr_code_base64: string | null;
  qr_code_expira_em: string | null;
  meta_phone_number_id: string | null;
  meta_waba_id: string | null;
  meta_access_token: string | null;
  meta_app_id: string | null;
  meta_coexistencia_ativa: boolean | null;
  meta_numero_display: string | null;
  meta_qualidade_numero: string | null;
  meta_webhook_configurado: boolean | null;
  ativo: boolean | null;
  nome_bot: string | null;
}

interface Unidade {
  id: string;
  nome: string;
  tipo: string;
  cnpj: string | null;
  telefone: string | null;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const PROVEDOR_LABELS: Record<ProvedorTipo, string> = {
  meta: "Meta Cloud API (Token Manual)",
  meta_coex: "Meta Cloud API + Coexistência (QR Code)",
  evolution: "Evolution API",
  zapi: "Z-API",
  uazapi: "UazAPI",
};

const PROVEDOR_DESCRICAO: Record<ProvedorTipo, string> = {
  meta: "Conecte via token permanente do Sistema de Usuários da Meta. Requer App Review.",
  meta_coex: "Conecte via QR Code (Coexistência). O número continua ativo no celular e na API simultaneamente.",
  evolution: "Conecte via Evolution API auto-hospedada. Gera QR Code diretamente.",
  zapi: "Conecte via Z-API (serviço gerenciado).",
  uazapi: "Conecte via UazAPI (serviço gerenciado).",
};

const STATUS_CONFIG: Record<StatusConexao, { color: string; label: string; icon: typeof Wifi }> = {
  conectado: { color: "bg-emerald-500", label: "Conectado", icon: Wifi },
  desconectado: { color: "bg-red-500", label: "Desconectado", icon: WifiOff },
  aguardando: { color: "bg-amber-500", label: "Aguardando QR", icon: Loader2 },
};

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "gcrdftnnbgsogoqcmcxo";
const WEBHOOK_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/meta-webhook`;
const VERIFY_TOKEN = "gasfacil_meta_verify";

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function AdminWhatsAppConfig() {
  const queryClient = useQueryClient();
  const [selectedUnidade, setSelectedUnidade] = useState<Unidade | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [embeddedSignupDialogOpen, setEmbeddedSignupDialogOpen] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrCountdown, setQrCountdown] = useState(60);
  const [qrPolling, setQrPolling] = useState(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Form state
  const [formProvedor, setFormProvedor] = useState<ProvedorTipo>("meta_coex");
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // ─── Queries ──────────────────────────────────────────────────────────────

  const { data: unidades, isLoading: loadingUnidades } = useQuery({
    queryKey: ["admin-unidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("id, nome, tipo, cnpj, telefone")
        .eq("ativo", true)
        .order("tipo")
        .order("nome");
      if (error) throw error;
      return data as Unidade[];
    },
  });

  const { data: configs, isLoading: loadingConfigs } = useQuery({
    queryKey: ["admin-whatsapp-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integracoes_whatsapp")
        .select(INTEGRACOES_WHATSAPP_PUBLIC_COLUMNS);
      if (error) throw error;
      const base = (data as any[]) || [];
      // Merge sensitive credential columns via admin-only RPC for each row.
      // Column-level SELECT on tokens is revoked from `authenticated`; secrets
      // are only readable through `get_whatsapp_integration_secrets`.
      const merged = await Promise.all(
        base.map(async (cfg) => {
          const { data: secrets } = await supabase.rpc(
            "get_whatsapp_integration_secrets",
            { p_unidade_id: cfg.unidade_id }
          );
          const s = Array.isArray(secrets) ? secrets[0] : secrets;
          return {
            ...cfg,
            token: s?.token ?? "",
            instancia_token: s?.instancia_token ?? "",
            meta_access_token: s?.meta_access_token ?? "",
            security_token: s?.security_token ?? "",
            meta_verify_token: s?.meta_verify_token ?? "",
          };
        })
      );
      return merged as unknown as WhatsAppConfig[];
    },
    refetchInterval: qrPolling ? 5000 : false,
  });

  const getConfigForUnidade = useCallback(
    (unidadeId: string) => configs?.find((c) => c.unidade_id === unidadeId),
    [configs]
  );

  // ─── Mutations ────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (params: { unidadeId: string; data: Record<string, any> }) => {
      const existing = getConfigForUnidade(params.unidadeId);
      if (existing) {
        const { error } = await supabase
          .from("integracoes_whatsapp")
          .update({ ...params.data, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("integracoes_whatsapp")
          .insert({
            unidade_id: params.unidadeId,
            instance_id: params.data.instance_id || `${params.data.provedor}_${params.unidadeId}`,
            token: params.data.token || params.data.instancia_token || "",
            provedor: params.data.provedor || "meta_coex",
            ...params.data,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-configs"] });
      toast.success("Configuração salva com sucesso!");
      setConfigDialogOpen(false);
    },
    onError: (err: any) => toast.error("Erro ao salvar: " + err.message),
  });

  const verifyMutation = useMutation({
    mutationFn: async (unidadeId: string) => {
      const config = getConfigForUnidade(unidadeId);
      if (!config) throw new Error("Configuração não encontrada");

      if (config.provedor === "meta" || config.provedor === "meta_coex") {
        const phoneId = config.meta_phone_number_id || config.instance_id;
        const token = config.meta_access_token || config.token;
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,quality_rating,platform_type,status&access_token=${token}`
        );
        const result = await res.json();
        if (result.error) throw new Error(result.error.message);

        const newStatus: StatusConexao =
          result.status === "CONNECTED" ? "conectado" : "desconectado";

        await supabase
          .from("integracoes_whatsapp")
          .update({
            status_conexao: newStatus,
            meta_numero_display: result.display_phone_number || null,
            meta_qualidade_numero: result.quality_rating || "GREEN",
            ultima_verificacao: new Date().toISOString(),
          } as any)
          .eq("id", config.id);

        return { status: newStatus, display: result.display_phone_number };
      } else {
        const url = `https://${PROJECT_ID}.supabase.co/functions/v1/evolution-proxy`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "status",
            instance_id: config.instancia_nome || config.instance_id,
            base_url: config.instancia_url || config.base_url,
            api_key: config.instancia_token || config.token,
          }),
        });
        const result = await res.json();
        const newStatus: StatusConexao =
          result?.state === "open" || result?.connected ? "conectado" : "desconectado";

        await supabase
          .from("integracoes_whatsapp")
          .update({
            status_conexao: newStatus,
            ultima_verificacao: new Date().toISOString(),
          })
          .eq("id", config.id);

        return { status: newStatus };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-configs"] });
      toast.success(
        `Status: ${result.status === "conectado" ? "✅ Conectado" : "❌ Desconectado"}${result.display ? ` — ${result.display}` : ""}`
      );
    },
    onError: (err: any) => toast.error("Erro ao verificar: " + err.message),
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const openConfigDialog = (unidade: Unidade) => {
    setSelectedUnidade(unidade);
    const config = getConfigForUnidade(unidade.id);
    const provedor =
      (config?.provedor_tipo as ProvedorTipo) ||
      (config?.provedor as ProvedorTipo) ||
      "meta_coex";
    setFormProvedor(provedor);
    setFormFields({
      instancia_nome: config?.instancia_nome || config?.instance_id || "",
      instancia_token: config?.instancia_token || config?.token || "",
      instancia_url: config?.instancia_url || config?.base_url || "",
      numero_telefone: config?.numero_telefone || "",
      meta_phone_number_id: config?.meta_phone_number_id || "",
      meta_waba_id: config?.meta_waba_id || "",
      meta_access_token: config?.meta_access_token || "",
      meta_app_id: config?.meta_app_id || "",
      nome_bot: config?.nome_bot || "BIA",
    });
    setConfigDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedUnidade) return;
    const data: Record<string, any> = {
      provedor_tipo: formProvedor,
      provedor: formProvedor,
      nome_bot: formFields.nome_bot || "BIA",
      numero_telefone: formFields.numero_telefone,
      ativo: true,
    };

    if (formProvedor === "meta" || formProvedor === "meta_coex") {
      data.meta_phone_number_id = formFields.meta_phone_number_id;
      data.meta_waba_id = formFields.meta_waba_id;
      data.meta_access_token = formFields.meta_access_token;
      data.meta_app_id = formFields.meta_app_id;
      data.token = formFields.meta_access_token;
      data.instance_id = formFields.meta_phone_number_id;
      data.meta_coexistencia_ativa = formProvedor === "meta_coex";
    } else {
      data.instancia_nome = formFields.instancia_nome;
      data.instancia_token = formFields.instancia_token;
      data.instancia_url = formFields.instancia_url;
      data.token = formFields.instancia_token;
      data.instance_id = formFields.instancia_nome;
      data.base_url = formFields.instancia_url;
    }

    saveMutation.mutate({ unidadeId: selectedUnidade.id, data });
  };

  // ─── QR Code — Evolution API ──────────────────────────────────────────────

  const handleGenerateQREvolution = async (unidade: Unidade) => {
    setSelectedUnidade(unidade);
    setQrCode(null);
    setQrCountdown(60);
    setQrDialogOpen(true);

    try {
      const config = getConfigForUnidade(unidade.id);
      if (!config) throw new Error("Configure o provedor primeiro");

      const url = `https://${PROJECT_ID}.supabase.co/functions/v1/evolution-proxy`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "qrcode",
          instance_id: config.instancia_nome || config.instance_id,
          base_url: config.instancia_url || config.base_url,
          api_key: config.instancia_token || config.token,
        }),
      });
      const result = await res.json();
      const qr = result?.qrcode?.base64 || result?.base64 || result?.qr || null;

      if (qr) {
        setQrCode(qr);
        await supabase
          .from("integracoes_whatsapp")
          .update({
            qr_code_base64: qr,
            qr_code_expira_em: new Date(Date.now() + 60000).toISOString(),
            status_conexao: "aguardando",
          })
          .eq("id", config.id);
        queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-configs"] });
        startQRPolling(config.id);
      } else {
        toast.info("Instância já conectada ou QR não disponível.");
        setQrDialogOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message);
      setQrDialogOpen(false);
    }
  };

  // ─── Embedded Signup — Meta Coexistência ──────────────────────────────────

  const handleEmbeddedSignup = (unidade: Unidade) => {
    setSelectedUnidade(unidade);
    setEmbeddedSignupDialogOpen(true);
  };

  const launchFacebookLogin = useCallback(() => {
    const config = selectedUnidade ? getConfigForUnidade(selectedUnidade.id) : null;
    const appId = config?.meta_app_id || formFields.meta_app_id || "";

    if (!appId) {
      toast.error("Configure o App ID da Meta antes de iniciar o Embedded Signup.");
      setEmbeddedSignupDialogOpen(false);
      setConfigDialogOpen(true);
      return;
    }

    const fbWindow = window as any;

    const doLogin = () => {
      fbWindow.FB.login(
        async (response: any) => {
          if (response.authResponse) {
            const { code } = response.authResponse;
            toast.success("Autorização recebida! Processando...");

            try {
              const res = await fetch(
                `https://${PROJECT_ID}.supabase.co/functions/v1/meta-embedded-signup`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    code,
                    unidade_id: selectedUnidade?.id,
                    app_id: appId,
                  }),
                }
              );
              const result = await res.json();
              if (result.error) throw new Error(result.error);

              if (selectedUnidade) {
                const existing = getConfigForUnidade(selectedUnidade.id);
                if (existing) {
                  await supabase
                    .from("integracoes_whatsapp")
                    .update({
                      meta_access_token: result.access_token,
                      meta_phone_number_id: result.phone_number_id,
                      meta_waba_id: result.waba_id,
                      token: result.access_token,
                      instance_id: result.phone_number_id,
                      provedor: "meta_coex",
                      meta_coexistencia_ativa: true,
                      status_conexao: "aguardando",
                      updated_at: new Date().toISOString(),
                    } as any)
                    .eq("id", existing.id);
                } else {
                  await supabase.from("integracoes_whatsapp").insert({
                    unidade_id: selectedUnidade.id,
                    instance_id: result.phone_number_id,
                    token: result.access_token,
                    provedor: "meta_coex",
                    meta_access_token: result.access_token,
                    meta_phone_number_id: result.phone_number_id,
                    meta_waba_id: result.waba_id,
                    meta_coexistencia_ativa: true,
                    nome_bot: "BIA",
                    ativo: true,
                    status_conexao: "aguardando",
                  } as any);
                }

                queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-configs"] });
                toast.success("WhatsApp autorizado! Agora escaneie o QR Code.");
                setEmbeddedSignupDialogOpen(false);
                setTimeout(() => handleShowCoexQR(selectedUnidade), 500);
              }
            } catch (err: any) {
              toast.error("Erro ao processar autorização: " + err.message);
            }
          } else {
            toast.error("Autorização cancelada ou negada.");
          }
        },
        {
          config_id: appId,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: "coexistence",
            sessionInfoVersion: "3",
          },
        }
      );
    };

    if (fbWindow.FB) {
      fbWindow.FB.init({ appId, cookie: true, xfbml: true, version: "v21.0" });
      doLogin();
    } else {
      // Carregar SDK dinamicamente
      const script = document.createElement("script");
      script.src = "https://connect.facebook.net/pt_BR/sdk.js";
      script.onload = () => {
        fbWindow.FB.init({ appId, cookie: true, xfbml: true, version: "v21.0" });
        doLogin();
      };
      document.body.appendChild(script);
    }
  }, [selectedUnidade, formFields.meta_app_id, configs, getConfigForUnidade]);

  // ─── QR Code — Coexistência Meta ─────────────────────────────────────────

  const handleShowCoexQR = async (unidade: Unidade) => {
    setSelectedUnidade(unidade);
    setQrCode(null);
    setQrCountdown(120);
    setQrDialogOpen(true);

    try {
      const config = getConfigForUnidade(unidade.id);
      if (!config) throw new Error("Configure o provedor primeiro");

      const phoneId = config.meta_phone_number_id || config.instance_id;
      const token = config.meta_access_token || config.token;

      // Tentar buscar QR Code de coexistência via Graph API
      const qrRes = await fetch(
        `https://graph.facebook.com/v21.0/${phoneId}/qr_code?access_token=${token}`
      );
      const qrResult = await qrRes.json();

      if (qrResult.qr_image_url) {
        setQrCode(qrResult.qr_image_url);
        await supabase
          .from("integracoes_whatsapp")
          .update({
            qr_code_base64: qrResult.qr_image_url,
            qr_code_expira_em: new Date(Date.now() + 120000).toISOString(),
            status_conexao: "aguardando",
          })
          .eq("id", config.id);
        startQRPolling(config.id);
      } else if (qrResult.error) {
        throw new Error(
          qrResult.error.message ||
          "Não foi possível gerar o QR Code. Verifique se o App Review foi aprovado e a Coexistência está habilitada."
        );
      } else {
        toast.info("QR Code não disponível. O número pode já estar conectado.");
        setQrDialogOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message);
      setQrDialogOpen(false);
    }
  };

  // ─── Polling para verificar conexão após QR ───────────────────────────────

  const startQRPolling = (configId: string) => {
    setQrPolling(true);
    pollingRef.current = setInterval(async () => {
      const { data } = await supabase
        .from("integracoes_whatsapp")
        .select("status_conexao, qr_code_base64")
        .eq("id", configId)
        .single();

      if (data?.status_conexao === "conectado") {
        clearInterval(pollingRef.current!);
        setQrPolling(false);
        setQrDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-configs"] });
        toast.success("✅ WhatsApp conectado com sucesso!");
      }
    }, 5000);
  };

  // ─── QR Countdown ────────────────────────────────────────────────────────

  useEffect(() => {
    if (qrDialogOpen && qrCode) {
      countdownRef.current = setInterval(() => {
        setQrCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            if (pollingRef.current) clearInterval(pollingRef.current);
            setQrPolling(false);
            setQrDialogOpen(false);
            toast.info("QR Code expirado. Gere novamente.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [qrDialogOpen, qrCode]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const getStatusInfo = (config: WhatsAppConfig | undefined) => {
    const status = (config?.status_conexao as StatusConexao) || "desconectado";
    return STATUS_CONFIG[status] || STATUS_CONFIG.desconectado;
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isMetaProvider = (p: ProvedorTipo) => p === "meta" || p === "meta_coex";

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loadingUnidades || loadingConfigs) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Smartphone className="h-6 w-6 text-green-500" />
          WhatsApp — Configuração de Conexões
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie as conexões WhatsApp de cada unidade. Suporte à API Oficial da Meta com Coexistência (QR Code).
        </p>
      </div>

      {/* Informações sobre Webhook */}
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
          <strong>URL do Webhook Meta:</strong>{" "}
          <code className="text-xs bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">{WEBHOOK_URL}</code>
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 h-5 px-1"
            onClick={() => copyToClipboard(WEBHOOK_URL, "webhook")}
          >
            {copiedField === "webhook" ? "✓" : <Copy className="h-3 w-3" />}
          </Button>
          {" | "}
          <strong>Verify Token:</strong>{" "}
          <code className="text-xs bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">{VERIFY_TOKEN}</code>
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 h-5 px-1"
            onClick={() => copyToClipboard(VERIFY_TOKEN, "verify")}
          >
            {copiedField === "verify" ? "✓" : <Copy className="h-3 w-3" />}
          </Button>
        </AlertDescription>
      </Alert>

      {/* Cards de Unidades */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(unidades || []).map((unidade) => {
          const config = getConfigForUnidade(unidade.id);
          const statusInfo = getStatusInfo(config);
          const StatusIcon = statusInfo.icon;
          const isCoex = config?.provedor === "meta_coex" || config?.meta_coexistencia_ativa;
          const isMeta = config?.provedor === "meta" || config?.provedor === "meta_coex";

          return (
            <Card key={unidade.id} className="relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-1 ${statusInfo.color}`} />

              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {unidade.nome}
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {unidade.tipo} {unidade.cnpj ? `· ${unidade.cnpj}` : ""}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${statusInfo.color}`} />
                    <span className="text-xs text-muted-foreground">{statusInfo.label}</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {config ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {PROVEDOR_LABELS[(config.provedor as ProvedorTipo)] || config.provedor}
                      </Badge>
                      {isCoex && (
                        <Badge className="text-xs bg-green-100 text-green-800 border-green-200">
                          Coexistência
                        </Badge>
                      )}
                    </div>
                    {config.meta_numero_display && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {config.meta_numero_display}
                      </div>
                    )}
                    {config.nome_bot && (
                      <div className="text-xs text-muted-foreground">
                        Bot: <strong>{config.nome_bot}</strong>
                      </div>
                    )}
                    {config.ultima_verificacao && (
                      <div className="text-xs text-muted-foreground">
                        Verificado: {new Date(config.ultima_verificacao).toLocaleString("pt-BR")}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">
                    Nenhuma configuração encontrada
                  </div>
                )}

                <Separator />

                {/* Ações principais */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openConfigDialog(unidade)}
                    className="flex-1"
                  >
                    <Settings className="h-3.5 w-3.5 mr-1" />
                    Configurar
                  </Button>

                  {config && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => verifyMutation.mutate(unidade.id)}
                      disabled={verifyMutation.isPending}
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${verifyMutation.isPending ? "animate-spin" : ""}`}
                      />
                    </Button>
                  )}
                </div>

                {/* Botões de conexão */}
                {config && (
                  <div className="flex flex-wrap gap-2">
                    {/* Meta Coexistência — Embedded Signup */}
                    {config.provedor === "meta_coex" && (
                      <Button
                        size="sm"
                        className="flex-1 bg-[#1877F2] hover:bg-[#166FE5] text-white"
                        onClick={() => handleEmbeddedSignup(unidade)}
                      >
                        <Shield className="h-3.5 w-3.5 mr-1" />
                        Conectar via Facebook
                      </Button>
                    )}

                    {/* QR Code — Meta Coexistência (quando já tem token) */}
                    {config.provedor === "meta_coex" && config.meta_access_token && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-500 text-green-700 hover:bg-green-50"
                        onClick={() => handleShowCoexQR(unidade)}
                      >
                        <QrCode className="h-3.5 w-3.5 mr-1" />
                        QR Code
                      </Button>
                    )}

                    {/* QR Code — Evolution */}
                    {(config.provedor === "evolution" ||
                      config.provedor === "uazapi" ||
                      config.provedor === "zapi") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-green-500 text-green-700 hover:bg-green-50"
                        onClick={() => handleGenerateQREvolution(unidade)}
                      >
                        <QrCode className="h-3.5 w-3.5 mr-1" />
                        Gerar QR Code
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ─── Dialog: Configurar Provedor ─────────────────────────────────── */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurar WhatsApp — {selectedUnidade?.nome}
            </DialogTitle>
            <DialogDescription>
              Escolha o provedor e preencha as credenciais de integração.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Provedor de WhatsApp</Label>
              <Select
                value={formProvedor}
                onValueChange={(v) => setFormProvedor(v as ProvedorTipo)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PROVEDOR_LABELS) as [ProvedorTipo, string][]).map(
                    ([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{PROVEDOR_DESCRICAO[formProvedor]}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome do Bot</Label>
                <Input
                  value={formFields.nome_bot || ""}
                  onChange={(e) => setFormFields((f) => ({ ...f, nome_bot: e.target.value }))}
                  placeholder="BIA"
                />
              </div>
              <div className="space-y-2">
                <Label>Número de Telefone</Label>
                <Input
                  value={formFields.numero_telefone || ""}
                  onChange={(e) =>
                    setFormFields((f) => ({ ...f, numero_telefone: e.target.value }))
                  }
                  placeholder="+55 43 9807-0028"
                />
              </div>
            </div>

            {/* Campos Meta */}
            {isMetaProvider(formProvedor) && (
              <>
                <Separator />
                <p className="text-sm font-medium text-muted-foreground">Credenciais Meta</p>

                {formProvedor === "meta_coex" && (
                  <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 dark:text-amber-200 text-xs">
                      A <strong>Coexistência</strong> exige que seu App Meta tenha passado pelo{" "}
                      <strong>App Review</strong> e que a empresa esteja verificada no Business Manager.
                      Após salvar, clique em <strong>"Conectar via Facebook"</strong>.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label>App ID da Meta</Label>
                  <Input
                    value={formFields.meta_app_id || ""}
                    onChange={(e) =>
                      setFormFields((f) => ({ ...f, meta_app_id: e.target.value }))
                    }
                    placeholder="1695439258558329"
                  />
                  <p className="text-xs text-muted-foreground">
                    Encontre em{" "}
                    <a
                      href="https://developers.facebook.com/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      developers.facebook.com/apps
                    </a>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Phone Number ID</Label>
                  <Input
                    value={formFields.meta_phone_number_id || ""}
                    onChange={(e) =>
                      setFormFields((f) => ({ ...f, meta_phone_number_id: e.target.value }))
                    }
                    placeholder="975431282330331"
                  />
                </div>

                <div className="space-y-2">
                  <Label>WABA ID (WhatsApp Business Account ID)</Label>
                  <Input
                    value={formFields.meta_waba_id || ""}
                    onChange={(e) =>
                      setFormFields((f) => ({ ...f, meta_waba_id: e.target.value }))
                    }
                    placeholder="1515888710165475"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Access Token (System User Token)</Label>
                  <Input
                    type="password"
                    value={formFields.meta_access_token || ""}
                    onChange={(e) =>
                      setFormFields((f) => ({ ...f, meta_access_token: e.target.value }))
                    }
                    placeholder="EAAYFZ..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Token permanente do Sistema de Usuários. Nunca expira.
                  </p>
                </div>

                {/* Informações de Webhook */}
                <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                  <p className="text-xs font-medium">Configure no painel Meta (developers.facebook.com):</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-28 shrink-0">URL Webhook:</span>
                      <code className="flex-1 text-xs bg-background px-1 py-0.5 rounded border truncate">
                        {WEBHOOK_URL}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1 shrink-0"
                        onClick={() => copyToClipboard(WEBHOOK_URL, "wh2")}
                      >
                        {copiedField === "wh2" ? "✓" : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-28 shrink-0">Verify Token:</span>
                      <code className="flex-1 text-xs bg-background px-1 py-0.5 rounded border">
                        {VERIFY_TOKEN}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1 shrink-0"
                        onClick={() => copyToClipboard(VERIFY_TOKEN, "vt2")}
                      >
                        {copiedField === "vt2" ? "✓" : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Campos Evolution / outros */}
            {!isMetaProvider(formProvedor) && (
              <>
                <Separator />
                <p className="text-sm font-medium text-muted-foreground">Credenciais da Instância</p>

                <div className="space-y-2">
                  <Label>Nome da Instância</Label>
                  <Input
                    value={formFields.instancia_nome || ""}
                    onChange={(e) =>
                      setFormFields((f) => ({ ...f, instancia_nome: e.target.value }))
                    }
                    placeholder="centralgas_matriz"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Token da Instância</Label>
                  <Input
                    type="password"
                    value={formFields.instancia_token || ""}
                    onChange={(e) =>
                      setFormFields((f) => ({ ...f, instancia_token: e.target.value }))
                    }
                    placeholder="Token de autenticação"
                  />
                </div>

                <div className="space-y-2">
                  <Label>URL Base da API</Label>
                  <Input
                    value={formFields.instancia_url || ""}
                    onChange={(e) =>
                      setFormFields((f) => ({ ...f, instancia_url: e.target.value }))
                    }
                    placeholder="https://api.evolution.com.br"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Salvar Configuração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Embedded Signup ─────────────────────────────────────── */}
      <Dialog open={embeddedSignupDialogOpen} onOpenChange={setEmbeddedSignupDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Conectar via Facebook — {selectedUnidade?.nome}
            </DialogTitle>
            <DialogDescription>
              Autorize o acesso ao WhatsApp Business da sua empresa através do fluxo oficial da Meta
              (Embedded Signup com Coexistência).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">Como funciona a Coexistência:</p>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  Você continua usando o WhatsApp normalmente no celular
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  A BIA responde automaticamente via API Oficial
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  Mensagens aparecem em ambos os lugares
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  Requer App Review aprovado na Meta
                </li>
              </ul>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Ao clicar no botão abaixo, uma janela do Facebook será aberta. Selecione a conta
                empresarial e o número de telefone que deseja conectar.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="flex-col gap-2">
            <Button
              className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white"
              onClick={launchFacebookLogin}
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Continuar com Facebook
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setEmbeddedSignupDialogOpen(false)}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: QR Code ─────────────────────────────────────────────── */}
      <Dialog
        open={qrDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setQrPolling(false);
          }
          setQrDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5 text-green-600" />
              QR Code — {selectedUnidade?.nome}
            </DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no celular, vá em{" "}
              <strong>Configurações → Aparelhos conectados</strong> e escaneie o QR Code abaixo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            {qrCode ? (
              <>
                <div className="relative">
                  <img
                    src={
                      qrCode.startsWith("data:") || qrCode.startsWith("http")
                        ? qrCode
                        : `data:image/png;base64,${qrCode}`
                    }
                    alt="QR Code WhatsApp"
                    className="w-64 h-64 rounded-xl border-4 border-green-500 shadow-lg"
                  />
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-3 py-1 rounded-full whitespace-nowrap">
                    Escaneie com o WhatsApp
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                  Aguardando conexão... expira em {qrCountdown}s
                </div>

                <p className="text-xs text-muted-foreground text-center max-w-[220px]">
                  Após escanear, aguarde a confirmação automática. Não feche esta janela.
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-green-200 border-t-green-500 animate-spin" />
                  <QrCode className="h-6 w-6 text-green-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <span className="text-sm text-muted-foreground">Gerando QR Code...</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

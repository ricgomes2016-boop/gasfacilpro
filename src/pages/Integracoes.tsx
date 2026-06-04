import { useState, useEffect, lazy, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CreditCard, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


import { integracoes } from "./integracoes/data";
import type { Integracao } from "./integracoes/types";
import { IntegracoesKpis } from "./integracoes/IntegracoesKpis";
import { IntegracoesList } from "./integracoes/IntegracoesList";
import { SugestoesCard } from "./integracoes/SugestoesCard";

// Lazy-load dialogs (heavy)
const GenericConfigDialog = lazy(() => import("./integracoes/dialogs/GenericConfigDialog").then(m => ({ default: m.GenericConfigDialog })));
const WhatsAppEvolutionDialog = lazy(() => import("./integracoes/dialogs/WhatsAppEvolutionDialog").then(m => ({ default: m.WhatsAppEvolutionDialog })));
const MetaDialog = lazy(() => import("./integracoes/dialogs/MetaDialog").then(m => ({ default: m.MetaDialog })));
const QrEvolutionDialog = lazy(() => import("./integracoes/dialogs/QrEvolutionDialog").then(m => ({ default: m.QrEvolutionDialog })));
const CoexQrDialog = lazy(() => import("./integracoes/dialogs/CoexQrDialog").then(m => ({ default: m.CoexQrDialog })));

export default function Integracoes() {
  const [selectedIntegracao, setSelectedIntegracao] = useState<Integracao | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tabAtiva, setTabAtiva] = useState("todas");

  const { unidades } = useUnidade();
  const { empresa } = useEmpresa();
  const [searchParams, setSearchParams] = useSearchParams();

  // Generic per-unit configs
  const [genericConfigs, setGenericConfigs] = useState<any[]>([]);
  const [configUnidadeId, setConfigUnidadeId] = useState("");
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [configEditId, setConfigEditId] = useState<string | null>(null);

  // WhatsApp Evolution
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappConfigs, setWhatsappConfigs] = useState<any[]>([]);
  const [wpUnidadeId, setWpUnidadeId] = useState("");
  const [wpInstanceId, setWpInstanceId] = useState("");
  const [wpCreating, setWpCreating] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrInstanceName, setQrInstanceName] = useState("");
  const [qrStatus, setQrStatus] = useState<string | null>(null);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Meta
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [metaConfigs, setMetaConfigs] = useState<any[]>([]);
  const [metaUnidadeId, setMetaUnidadeId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState("");
  const [metaWabaId, setMetaWabaId] = useState("");
  const [metaVerifyToken, setMetaVerifyToken] = useState("gasfacil_meta_verify");
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaDeletingId, setMetaDeletingId] = useState<string | null>(null);
  const [metaEditId, setMetaEditId] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [metaConexaoModo, setMetaConexaoModo] = useState<"token" | "embedded_signup">("token");
  const [metaAppId, setMetaAppId] = useState("1695439258558329");
  const [embeddedSignupLoading] = useState(false);
  const [coexQrDialogOpen, setCoexQrDialogOpen] = useState(false);
  const [coexQrCode, setCoexQrCode] = useState<string | null>(null);
  const [coexQrCountdown, setCoexQrCountdown] = useState(120);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "gcrdftnnbgsogoqcmcxo";
  const metaWebhookUrl = `https://${projectId}.supabase.co/functions/v1/meta-webhook`;

  const loadMetaConfigs = async () => {
    const { data } = await supabase
      .from("integracoes_whatsapp")
      .select(
        "id, unidade_id, instance_id, nome_bot, ativo, created_at, updated_at, provedor, meta_phone_number_id, meta_waba_id, provedor_tipo, instancia_nome, instancia_url, numero_telefone, status_conexao, ultima_verificacao, qr_code_base64, qr_code_expira_em, loja_foto_url, loja_foto_atualizada_em, unidades(nome)"
      )
      .in("provedor", ["meta", "meta_coex"])
      .order("created_at");
    const base = (data as any[]) || [];
    // Merge sensitive credential columns via admin-only RPC for each row.
    const merged = await Promise.all(
      base.map(async (cfg) => {
        const { data: secrets } = await supabase.rpc(
          "get_whatsapp_integration_secrets",
          { p_unidade_id: cfg.unidade_id }
        );
        const s: any = Array.isArray(secrets) ? secrets[0] : secrets;
        return {
          ...cfg,
          meta_access_token: s?.meta_access_token ?? "",
          meta_verify_token: s?.meta_verify_token ?? "",
          token: s?.token ?? "",
          instancia_token: s?.instancia_token ?? "",
          security_token: s?.security_token ?? "",
        };
      })
    );
    setMetaConfigs(merged);
  };

  const handleEmbeddedSignup = () => {
    if (!metaUnidadeId || !metaAppId) {
      toast.error("Selecione a unidade e informe o App ID da Meta.");
      return;
    }
    sessionStorage.setItem("meta_oauth_unidade_id", metaUnidadeId);
    sessionStorage.setItem("meta_oauth_app_id", metaAppId);
    const redirectUri = `${window.location.origin}/integracoes`;
    const extras = JSON.stringify({ setup: {}, featureType: "coexistence", sessionInfoVersion: "3" });
    const authUrl =
      `https://www.facebook.com/v21.0/dialog/oauth` +
      `?client_id=${encodeURIComponent(metaAppId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent("whatsapp_business_management,whatsapp_business_messaging")}` +
      `&response_type=code` +
      `&config_id=925541403793729` +
      `&extras=${encodeURIComponent(extras)}`;
    window.location.href = authUrl;
  };

  // Processar callback OAuth da Meta
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const errorParam = params.get("error");
    if (errorParam) {
      toast.error("Autorização cancelada ou negada pelo Facebook.");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (!code) return;
    const savedUnidadeId = sessionStorage.getItem("meta_oauth_unidade_id");
    const savedAppId = sessionStorage.getItem("meta_oauth_app_id");
    if (!savedUnidadeId || !savedAppId) {
      toast.error("Sessão OAuth expirada. Tente novamente.");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    sessionStorage.removeItem("meta_oauth_unidade_id");
    sessionStorage.removeItem("meta_oauth_app_id");
    window.history.replaceState({}, "", window.location.pathname);
    const redirectUri = `${window.location.origin}/integracoes`;
    toast.loading("Processando autorização do WhatsApp...", { id: "meta-oauth" });
    supabase.functions.invoke("meta-embedded-signup", {
      body: { code, unidade_id: savedUnidadeId, app_id: savedAppId, redirect_uri: redirectUri },
    }).then(async ({ data: result, error }) => {
      if (error || result?.error) {
        toast.error("Erro ao processar autorização: " + (result?.error || error?.message), { id: "meta-oauth" });
        return;
      }
      const { data: existing } = await supabase
        .from("integracoes_whatsapp")
        .select("id")
        .eq("unidade_id", savedUnidadeId)
        .in("provedor", ["meta", "meta_coex"])
        .maybeSingle();
      const payload = {
        meta_access_token: result.access_token,
        meta_phone_number_id: result.phone_number_id,
        meta_waba_id: result.waba_id || null,
        meta_app_id: savedAppId,
        token: result.access_token,
        instance_id: result.phone_number_id,
        provedor: "meta_coex",
        meta_coexistencia_ativa: true,
        ativo: true,
        updated_at: new Date().toISOString(),
      };
      if (existing) {
        await supabase.from("integracoes_whatsapp").update(payload as any).eq("id", existing.id);
      } else {
        await supabase.from("integracoes_whatsapp").insert({
          ...payload,
          unidade_id: savedUnidadeId,
          nome_bot: "BIA",
          status_conexao: "aguardando",
        } as any);
      }
      await loadMetaConfigs();
      toast.success("WhatsApp autorizado com sucesso! Agora escaneie o QR Code.", { id: "meta-oauth" });
      setTimeout(() => {
        setCoexQrCode(null);
        setCoexQrCountdown(120);
        setCoexQrDialogOpen(true);
        fetchCoexQrCode(result.phone_number_id, result.access_token);
      }, 800);
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Erro inesperado: " + msg, { id: "meta-oauth" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCoexQrCode = async (phoneNumberId: string, token: string) => {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/qr_code?access_token=${token}`
      );
      const data = await res.json();
      if (data.qr_image_url) {
        setCoexQrCode(data.qr_image_url);
      } else {
        toast.error("QR Code não disponível. Verifique se o App Review foi aprovado.");
        setCoexQrDialogOpen(false);
      }
    } catch (err: any) {
      toast.error("Erro ao buscar QR Code: " + err.message);
    }
  };

  const handleSaveMeta = async () => {
    if (!metaUnidadeId || !metaAccessToken || !metaPhoneNumberId) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    setMetaSaving(true);
    try {
      if (metaEditId) {
        const { error } = await supabase.from("integracoes_whatsapp").update({
          meta_access_token: metaAccessToken,
          meta_phone_number_id: metaPhoneNumberId,
          meta_waba_id: metaWabaId || null,
          meta_verify_token: metaVerifyToken || "gasfacil_meta_verify",
          token: metaAccessToken,
          ativo: true,
          updated_at: new Date().toISOString(),
        }).eq("id", metaEditId);
        if (error) throw error;
        toast.success("Configuração Meta atualizada!");
      } else {
        const { data: existing } = await supabase.from("integracoes_whatsapp")
          .select("id").eq("unidade_id", metaUnidadeId).eq("provedor", "meta").maybeSingle();
        if (existing) {
          toast.error("Já existe uma configuração Meta para esta unidade. Edite a existente.");
          setMetaSaving(false);
          return;
        }
        const { error } = await supabase.from("integracoes_whatsapp").insert({
          unidade_id: metaUnidadeId,
          instance_id: `meta_${metaPhoneNumberId}`,
          token: metaAccessToken,
          provedor: "meta",
          meta_access_token: metaAccessToken,
          meta_phone_number_id: metaPhoneNumberId,
          meta_waba_id: metaWabaId || null,
          meta_verify_token: metaVerifyToken || "gasfacil_meta_verify",
          ativo: true,
        });
        if (error) throw error;
        toast.success("WhatsApp Oficial (Meta) configurado com sucesso! ✅");
      }
      await loadMetaConfigs();
      resetMetaForm();
    } catch (err: any) {
      console.error("Meta save error:", err);
      toast.error(err.message || "Erro ao salvar configuração Meta");
    } finally {
      setMetaSaving(false);
    }
  };

  const handleEditMeta = (cfg: any) => {
    setMetaEditId(cfg.id);
    setMetaUnidadeId(cfg.unidade_id);
    setMetaAccessToken(cfg.meta_access_token || "");
    setMetaPhoneNumberId(cfg.meta_phone_number_id || "");
    setMetaWabaId(cfg.meta_waba_id || "");
    setMetaVerifyToken(cfg.meta_verify_token || "gasfacil_meta_verify");
  };

  const handleDeleteMeta = async (id: string) => {
    setMetaDeletingId(id);
    try {
      const { error } = await supabase.from("integracoes_whatsapp").delete().eq("id", id);
      if (error) throw error;
      toast.success("Configuração Meta removida.");
      await loadMetaConfigs();
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover");
    } finally {
      setMetaDeletingId(null);
    }
  };

  const resetMetaForm = () => {
    setMetaEditId(null);
    setMetaUnidadeId("");
    setMetaAccessToken("");
    setMetaPhoneNumberId("");
    setMetaWabaId("");
    setMetaVerifyToken("gasfacil_meta_verify");
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(metaWebhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleEvolutionConnect = async (cfg: any) => {
    setQrInstanceName(cfg.instance_id);
    setQrCodeData(null);
    setQrStatus(null);
    setWhatsappDialogOpen(false);
    setQrDialogOpen(true);
    setQrLoading(true);
    try {
      try {
        await supabase.functions.invoke("evolution-proxy", {
          body: { action: "create", instance_id: cfg.instance_id },
        });
      } catch (err) {
        console.warn("Instance creation warning:", err);
      }
      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: { action: "qrcode", instance_id: cfg.instance_id },
      });
      if (error) throw error;
      const qr = data?.qrcode?.base64 || data?.base64 || data?.qrcode || null;
      if (qr) {
        setQrCodeData(qr);
        startConnectionPolling(cfg.instance_id);
      } else if (data?.instance?.state === "open" || data?.instance?.state === "connected") {
        setQrStatus("connected");
      } else {
        toast.info("Nenhum QR Code retornado. Verifique se a instância está pronta.");
      }
    } catch (err: any) {
      console.error("Evolution connect error:", err);
      if (!err.message?.includes("Abort")) {
        toast.error("Erro ao conectar: " + (err.message || "Verifique o servidor"));
      }
    } finally {
      setQrLoading(false);
    }
  };

  const handleEvolutionStatus = async (cfg: any) => {
    try {
      const { data } = await supabase.functions.invoke("evolution-proxy", {
        body: { action: "status", instance_id: cfg.instance_id },
      });
      const state = data?.instance?.state || data?.state || "unknown";
      toast.info(`Status: ${state === "open" ? "Conectado ✅" : state === "close" ? "Desconectado ❌" : state}`);
    } catch {
      toast.error("Erro ao verificar status");
    }
  };

  const loadWhatsappConfigs = async () => {
    const { data } = await supabase
      .from("integracoes_whatsapp")
      .select("*, unidades(nome)")
      .order("created_at");
    setWhatsappConfigs(data || []);

    for (const cfg of (data || [])) {
      if (cfg.provedor === "evolution") {
        try {
          const { data: statusData } = await supabase.functions.invoke("evolution-proxy", {
            body: { action: "status", instance_id: cfg.instance_id },
          });
          const state = statusData?.instance?.state || statusData?.state || "disconnected";
          setConnectionStatuses(prev => ({ ...prev, [cfg.id]: state }));
        } catch {
          setConnectionStatuses(prev => ({ ...prev, [cfg.id]: "disconnected" }));
        }
      }
    }
  };

  const loadGenericConfigs = async () => {
    const { data } = await supabase
      .from("integracoes_config")
      .select("*, unidades(nome)")
      .order("created_at");
    setGenericConfigs(data || []);
  };

  useEffect(() => {
    loadWhatsappConfigs();
    loadGenericConfigs();
    loadMetaConfigs();
  }, []);

  // Auto-open WhatsApp dialog from URL param
  useEffect(() => {
    if (searchParams.get("open") === "whatsapp") {
      setWhatsappDialogOpen(true);
      searchParams.delete("open");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  // Auto-generate instance name
  useEffect(() => {
    if (wpUnidadeId && empresa?.slug) {
      const unidade = unidades.find(u => u.id === wpUnidadeId);
      if (unidade) {
        const normalizedName = unidade.nome
          .toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");
        setWpInstanceId(`${empresa.slug}_${normalizedName}`);
      }
    }
  }, [wpUnidadeId, empresa?.slug, unidades]);

  const handleCreateConnection = async () => {
    if (!wpUnidadeId || !wpInstanceId) {
      toast.error("Selecione a unidade e defina o nome da instância.");
      return;
    }
    setWpCreating(true);
    try {
      const { data: createData, error: createError } = await supabase.functions.invoke("evolution-proxy", {
        body: { action: "create", instance_id: wpInstanceId },
      });
      if (createError) throw createError;
      const generatedToken = createData?._generated_token || createData?.hash?.apikey || "";

      const { error: insertError } = await supabase.from("integracoes_whatsapp").insert({
        unidade_id: wpUnidadeId,
        instance_id: wpInstanceId,
        token: generatedToken,
        provedor: "evolution",
        ativo: true,
        desconto_etapa1: 5,
        desconto_etapa2: 10,
      });
      if (insertError) throw insertError;

      if (empresa?.id) {
        await supabase.from("whatsapp_gateway_instances").upsert({
          empresa_id: empresa.id,
          unidade_id: wpUnidadeId,
          instance_name: wpInstanceId,
          engine_url: "global",
          api_key: generatedToken,
          status: "disconnected",
        }, { onConflict: "empresa_id,instance_name" });
      }

      const projId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "gcrdftnnbgsogoqcmcxo";
      const webhookUrl = `https://${projId}.supabase.co/functions/v1/evolution-webhook?unidade_id=${wpUnidadeId}&instance=${wpInstanceId}`;

      await supabase.functions.invoke("evolution-proxy", {
        body: {
          action: "webhook",
          instance_id: wpInstanceId,
          body: {
            webhook: {
              enabled: true,
              url: webhookUrl,
              webhook_by_events: false,
              events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE", "CALL"],
            },
          },
        },
      });

      toast.success("Conexão criada com sucesso!");
      await loadWhatsappConfigs();
      setWpUnidadeId("");
      setWpInstanceId("");
      handleEvolutionConnect({ instance_id: wpInstanceId });
    } catch (err: any) {
      console.error("Create connection error:", err);
      toast.error(err.message || "Erro ao criar conexão");
    } finally {
      setWpCreating(false);
    }
  };

  const deleteWhatsappConfig = async (id: string, instanceId: string) => {
    setDeletingId(id);
    try {
      try {
        await supabase.functions.invoke("evolution-proxy", {
          body: { action: "delete", instance_id: instanceId },
        });
      } catch {
        // ignore
      }
      await supabase.from("integracoes_whatsapp").delete().eq("id", id);
      await supabase.from("whatsapp_gateway_instances").delete().eq("instance_name", instanceId);
      toast.success("Conexão removida.");
      loadWhatsappConfigs();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir");
    } finally {
      setDeletingId(null);
    }
  };

  const startConnectionPolling = (instanceId: string) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("evolution-proxy", {
          body: { action: "status", instance_id: instanceId },
        });
        const state = data?.instance?.state || data?.state;
        if (state === "open" || state === "connected") {
          setQrStatus("connected");
          setQrCodeData(null);
          clearInterval(interval);
          toast.success("WhatsApp conectado!");
          loadWhatsappConfigs();
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 3000);
    setTimeout(() => clearInterval(interval), 120000);
  };

  const navigate = useNavigate();

  const handleOpenConfig = (integracao: Integracao) => {
    if (integracao.id === "whatsapp_meta") {
      setMetaDialogOpen(true);
      return;
    }
    if (integracao.id === "asaas") {
      navigate("/config/asaas");
      return;
    }
    if (integracao.isWhatsapp) {
      setWhatsappDialogOpen(true);
      return;
    }
    if (integracao.status === "em_breve") return;
    setSelectedIntegracao(integracao);
    resetGenericForm();
    setConfigOpen(true);
  };

  // Pré-carrega o SDK do Facebook quando o dialog Meta é aberto no modo embedded_signup
  useEffect(() => {
    if (metaDialogOpen && metaConexaoModo === "embedded_signup") {
      if (typeof (window as Window & { FB?: unknown }).FB === "undefined") {
        const existingScript = document.getElementById("facebook-jssdk");
        if (!existingScript) {
          const script = document.createElement("script");
          script.id = "facebook-jssdk";
          script.src = "https://connect.facebook.net/pt_BR/sdk.js";
          script.async = true;
          script.defer = true;
          document.body.appendChild(script);
        }
      }
    }
  }, [metaDialogOpen, metaConexaoModo]);

  const handleSaveGenericConfig = async () => {
    if (!configUnidadeId || !selectedIntegracao) {
      toast.error("Selecione a unidade.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        unidade_id: configUnidadeId,
        integracao_id: selectedIntegracao.id,
        config: configValues,
        ativo: true,
      };
      if (configEditId) {
        const { error } = await supabase.from("integracoes_config").update({
          config: configValues,
          ativo: true,
        }).eq("id", configEditId);
        if (error) throw error;
        toast.success("Configuração atualizada!");
      } else {
        const { error } = await supabase.from("integracoes_config").upsert(payload, {
          onConflict: "unidade_id,integracao_id",
        });
        if (error) throw error;
        toast.success(`${selectedIntegracao.nome} vinculado à unidade!`);
      }
      await loadGenericConfigs();
      setConfigOpen(false);
      resetGenericForm();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const resetGenericForm = () => {
    setConfigUnidadeId("");
    setConfigValues({});
    setConfigEditId(null);
  };

  const editGenericConfig = (config: any, integracao: Integracao) => {
    setSelectedIntegracao(integracao);
    setConfigEditId(config.id);
    setConfigUnidadeId(config.unidade_id);
    setConfigValues(config.config || {});
    setConfigOpen(true);
  };

  const deleteGenericConfig = async (id: string) => {
    await supabase.from("integracoes_config").delete().eq("id", id);
    toast.success("Configuração removida.");
    loadGenericConfigs();
  };

  const getConfigsCountForIntegracao = (integracaoId: string) =>
    genericConfigs.filter((c) => c.integracao_id === integracaoId).length;

  const conectadas = integracoes.filter((i) => i.status === "conectado").length;
  const disponiveis = integracoes.filter((i) => i.status === "disponivel").length;
  const emBreve = integracoes.filter((i) => i.status === "em_breve").length;

  const filteredIntegracoes = tabAtiva === "todas"
    ? integracoes
    : tabAtiva === "ativas"
      ? integracoes.filter(i => i.status === "conectado")
      : integracoes.filter(i => i.status === "disponivel" || i.status === "em_breve");

  return (
    <MainLayout>
      <Header title="Integrações" subtitle="Conecte serviços externos por unidade e amplie o poder do seu sistema" />
      <div className="p-4 md:p-6 space-y-6">
        {/* Atalho destacado para configuração do Asaas */}
        <button
          type="button"
          onClick={() => navigate("/config/asaas")}
          className="w-full text-left rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 hover:border-primary/60 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-primary/15 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm md:text-base">Configurar Asaas (Boleto + PIX)</p>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                  Atalho
                </span>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                API Key, modo sandbox/produção e webhook de baixa automática
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
          </div>
        </button>

        <IntegracoesKpis
          conectadas={conectadas}
          disponiveis={disponiveis}
          emBreve={emBreve}
          total={integracoes.length}
        />

        <Tabs value={tabAtiva} onValueChange={setTabAtiva}>

          <TabsList>
            <TabsTrigger value="todas">Todas ({integracoes.length})</TabsTrigger>
            <TabsTrigger value="ativas">Ativas ({conectadas})</TabsTrigger>
            <TabsTrigger value="disponiveis">Pendentes ({disponiveis + emBreve})</TabsTrigger>
          </TabsList>
        </Tabs>

        <IntegracoesList
          integracoes={filteredIntegracoes}
          whatsappConfigsCount={whatsappConfigs.length}
          getConfigsCountForIntegracao={getConfigsCountForIntegracao}
          onConfigure={handleOpenConfig}
        />

        <SugestoesCard />
      </div>

      <Suspense fallback={null}>
        {configOpen && (
          <GenericConfigDialog
            open={configOpen}
            onOpenChange={setConfigOpen}
            integracao={selectedIntegracao}
            unidades={unidades}
            configs={genericConfigs}
            configUnidadeId={configUnidadeId}
            setConfigUnidadeId={setConfigUnidadeId}
            configValues={configValues}
            setConfigValues={setConfigValues}
            configEditId={configEditId}
            saving={saving}
            onSave={handleSaveGenericConfig}
            onReset={resetGenericForm}
            onEdit={editGenericConfig}
            onDelete={deleteGenericConfig}
          />
        )}

        {whatsappDialogOpen && (
          <WhatsAppEvolutionDialog
            open={whatsappDialogOpen}
            onOpenChange={setWhatsappDialogOpen}
            whatsappConfigs={whatsappConfigs}
            connectionStatuses={connectionStatuses}
            unidades={unidades}
            wpUnidadeId={wpUnidadeId}
            setWpUnidadeId={setWpUnidadeId}
            wpInstanceId={wpInstanceId}
            setWpInstanceId={setWpInstanceId}
            wpCreating={wpCreating}
            deletingId={deletingId}
            onConnect={handleEvolutionConnect}
            onStatus={handleEvolutionStatus}
            onDelete={deleteWhatsappConfig}
            onCreate={handleCreateConnection}
          />
        )}

        {metaDialogOpen && (
          <MetaDialog
            open={metaDialogOpen}
            onOpenChange={setMetaDialogOpen}
            metaWebhookUrl={metaWebhookUrl}
            copiedWebhook={copiedWebhook}
            onCopyWebhook={copyWebhookUrl}
            metaConfigs={metaConfigs}
            metaDeletingId={metaDeletingId}
            unidades={unidades}
            metaEditId={metaEditId}
            metaConexaoModo={metaConexaoModo}
            setMetaConexaoModo={setMetaConexaoModo}
            metaUnidadeId={metaUnidadeId}
            setMetaUnidadeId={setMetaUnidadeId}
            metaAccessToken={metaAccessToken}
            setMetaAccessToken={setMetaAccessToken}
            metaPhoneNumberId={metaPhoneNumberId}
            setMetaPhoneNumberId={setMetaPhoneNumberId}
            metaWabaId={metaWabaId}
            setMetaWabaId={setMetaWabaId}
            metaVerifyToken={metaVerifyToken}
            setMetaVerifyToken={setMetaVerifyToken}
            metaSaving={metaSaving}
            metaAppId={metaAppId}
            setMetaAppId={setMetaAppId}
            embeddedSignupLoading={embeddedSignupLoading}
            onSaveMeta={handleSaveMeta}
            onEditMeta={handleEditMeta}
            onDeleteMeta={handleDeleteMeta}
            onResetMeta={resetMetaForm}
            onEmbeddedSignup={handleEmbeddedSignup}
            onShowCoexQr={(phoneNumberId, token) => {
              setCoexQrCode(null);
              setCoexQrCountdown(120);
              setCoexQrDialogOpen(true);
              fetchCoexQrCode(phoneNumberId, token);
            }}
          />
        )}

        {coexQrDialogOpen && (
          <CoexQrDialog
            open={coexQrDialogOpen}
            onOpenChange={setCoexQrDialogOpen}
            coexQrCode={coexQrCode}
            coexQrCountdown={coexQrCountdown}
          />
        )}

        {qrDialogOpen && (
          <QrEvolutionDialog
            open={qrDialogOpen}
            onOpenChange={setQrDialogOpen}
            qrInstanceName={qrInstanceName}
            qrLoading={qrLoading}
            qrStatus={qrStatus}
            qrCodeData={qrCodeData}
            whatsappConfigs={whatsappConfigs}
            onRetry={handleEvolutionConnect}
          />
        )}
      </Suspense>
    </MainLayout>
  );
}

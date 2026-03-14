import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plug, MessageSquare, CreditCard, FileText, Truck, Globe, Webhook,
  ArrowUpRight, CheckCircle2, Settings, Zap, BarChart3, ScanBarcode,
  Phone, Mail, Receipt, Shield, Loader2, ExternalLink, AlertTriangle, Building2,
  QrCode, RefreshCw, XCircle, Smartphone, Plus, Trash2, Power, PowerOff,
  Signal, SignalZero, Wifi, WifiOff, Code2, Eye,
  ArrowUpDown, Send, Image, MapPin, Copy, Check, ScrollText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";

interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  placeholder: string;
}

interface Integracao {
  id: string;
  nome: string;
  descricao: string;
  icon: React.ElementType;
  status: "conectado" | "disponivel" | "em_breve";
  categoria: "pagamento" | "comunicacao" | "fiscal" | "logistica" | "produtividade";
  configFields?: ConfigField[];
  helpUrl?: string;
  beneficios?: string[];
  /** Whether this integration uses the legacy integracoes_whatsapp table */
  isWhatsapp?: boolean;
}

interface GatewayInstance {
  id: string;
  empresa_id: string;
  unidade_id: string;
  instance_name: string;
  phone: string | null;
  status: string;
  qr_code: string | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  engine_url: string;
  api_key: string | null;
  auto_reconnect: boolean;
  created_at: string;
  updated_at: string;
  unidades?: { nome: string };
  agent_name?: string | null;
}

interface GatewayMessage {
  id: string;
  instance_id: string;
  phone: string;
  message: string | null;
  media_url: string | null;
  message_type: string;
  direction: string;
  status: string;
  created_at: string;
}

const integracoes: Integracao[] = [
  {
    id: "boleto_leitura",
    nome: "Leitura de Boletos (IA)",
    descricao: "Escaneie boletos com a câmera ou envie PDF — a IA extrai fornecedor, valor, vencimento e código de barras automaticamente",
    icon: ScanBarcode,
    status: "conectado",
    categoria: "pagamento",
    configFields: [
      { key: "habilitado", label: "Leitura de boletos habilitada", type: "text", placeholder: "sim" },
    ],
    beneficios: [
      "Leitura automática por câmera ou PDF",
      "Extração de código de barras e linha digitável",
      "Classificação automática de categoria",
      "Lançamento direto em Contas a Pagar",
    ],
  },
  {
    id: "pix",
    nome: "PIX Automático",
    descricao: "Geração de QR Code PIX para pagamentos instantâneos com conciliação automática",
    icon: CreditCard,
    status: "conectado",
    categoria: "pagamento",
    configFields: [
      { key: "chave_pix", label: "Chave PIX", type: "text", placeholder: "CPF, CNPJ, e-mail ou telefone" },
      { key: "nome_beneficiario", label: "Nome do beneficiário", type: "text", placeholder: "Nome que aparece no PIX" },
    ],
    beneficios: [
      "QR Code dinâmico por venda",
      "Conciliação automática de recebimentos",
      "Múltiplas chaves por unidade",
    ],
  },
  {
    id: "pagbank",
    nome: "PagBank / Maquininha",
    descricao: "Integração com terminais físicos PagBank para débito, crédito e PIX na maquininha",
    icon: CreditCard,
    status: "conectado",
    categoria: "pagamento",
    configFields: [
      { key: "terminal_serial", label: "Serial do Terminal", type: "text", placeholder: "Número de série da maquininha" },
      { key: "pagbank_token", label: "Token PagBank", type: "password", placeholder: "Token de integração" },
    ],
    beneficios: [
      "Débito, crédito e PIX via terminal",
      "Cálculo automático de taxas",
      "Agenda de recebíveis D+1/D+30",
      "Dashboard financeiro por terminal",
    ],
  },
  {
    id: "nfe",
    nome: "Emissão de NF-e / NFC-e",
    descricao: "Emissão automática de notas fiscais integrada ao módulo fiscal via Focus NFe",
    icon: FileText,
    status: "disponivel",
    categoria: "fiscal",
    configFields: [
      { key: "FOCUS_NFE_TOKEN", label: "Token Focus NFe", type: "password", placeholder: "Token da API Focus NFe" },
      { key: "FOCUS_NFE_ENV", label: "Ambiente", type: "text", placeholder: "homologacao ou producao" },
    ],
    beneficios: [
      "NF-e, NFC-e, CT-e e MDF-e",
      "Envio automático ao SEFAZ",
      "XML e DANFE gerados automaticamente",
    ],
    helpUrl: "https://focusnfe.com.br/",
  },
  {
    id: "google_maps",
    nome: "Google Maps",
    descricao: "Geocodificação de endereços e otimização de rotas de entrega em tempo real",
    icon: Globe,
    status: "conectado",
    categoria: "logistica",
    configFields: [
      { key: "google_maps_api_key", label: "API Key Google Maps", type: "password", placeholder: "Chave da API Google Maps" },
    ],
    beneficios: [
      "Geocodificação automática de clientes",
      "Otimização de rotas de entrega",
      "Rastreamento em tempo real",
      "Mapa de calor de clientes",
    ],
  },
  {
    id: "bina_goto",
    nome: "Bina / GoTo Connect",
    descricao: "Identificação automática de chamadas recebidas com popup do cliente e histórico",
    icon: Phone,
    status: "disponivel",
    categoria: "comunicacao",
    configFields: [
      { key: "GOTO_CLIENT_ID", label: "Client ID", type: "text", placeholder: "Client ID GoTo" },
      { key: "GOTO_SECRET", label: "Client Secret", type: "password", placeholder: "Secret GoTo" },
    ],
    beneficios: [
      "Popup com dados do cliente ao receber ligação",
      "Histórico de chamadas integrado",
      "Criação de pedido direto da ligação",
    ],
    helpUrl: "https://developer.goto.com/",
  },
  {
    id: "email_smtp",
    nome: "E-mail Transacional",
    descricao: "Envio de boletos, notas fiscais e lembretes por e-mail (modo simulação — configure SMTP para envio real)",
    icon: Mail,
    status: "conectado",
    categoria: "comunicacao",
    configFields: [
      { key: "smtp_host", label: "Servidor SMTP", type: "text", placeholder: "smtp.gmail.com" },
      { key: "smtp_port", label: "Porta", type: "text", placeholder: "587" },
      { key: "smtp_user", label: "Usuário", type: "text", placeholder: "email@empresa.com" },
      { key: "smtp_password", label: "Senha", type: "password", placeholder: "Senha do e-mail" },
    ],
    beneficios: [
      "Envio de NF-e e boletos por e-mail",
      "Templates personalizáveis por tipo",
      "Histórico completo de envios",
      "Automações configuráveis",
    ],
  },
  {
    id: "ifood",
    nome: "iFood / Rappi",
    descricao: "Recebimento automático de pedidos de marketplaces de delivery",
    icon: Truck,
    status: "em_breve",
    categoria: "logistica",
    beneficios: [
      "Pedidos sincronizados automaticamente",
      "Status atualizado em tempo real",
      "Cardápio integrado",
    ],
  },
  {
    id: "contabilidade",
    nome: "Exportação Contábil",
    descricao: "Exportação de lançamentos financeiros em XLSX para Domínio, Alterdata, Fortes e SPED EFD",
    icon: BarChart3,
    status: "conectado",
    categoria: "produtividade",
    configFields: [
      { key: "sistema_contabil", label: "Sistema Contábil", type: "text", placeholder: "Domínio, Alterdata, Fortes..." },
      { key: "codigo_empresa", label: "Código da Empresa", type: "text", placeholder: "Código no sistema contábil" },
    ],
    beneficios: [
      "CSV e XLSX para importação direta",
      "Formatos Domínio, Alterdata e Fortes",
      "Layout SPED EFD simplificado",
      "Exportação por período e unidade",
    ],
  },
  {
    id: "webhook",
    nome: "Webhooks Customizados",
    descricao: "Envie eventos do sistema (novo pedido, status, pagamento) para qualquer endpoint externo",
    icon: Webhook,
    status: "disponivel",
    categoria: "produtividade",
    configFields: [
      { key: "WEBHOOK_URL", label: "URL do Webhook", type: "url", placeholder: "https://seu-sistema.com/webhook" },
      { key: "WEBHOOK_SECRET", label: "Secret (opcional)", type: "password", placeholder: "Chave de autenticação" },
    ],
    beneficios: [
      "Eventos em tempo real para sistemas externos",
      "Automação com Zapier, Make, N8N",
      "Payload customizável por evento",
    ],
  },
];

const statusConfig = {
  conectado: { label: "Conectado", variant: "default" as const, dotColor: "bg-green-500" },
  disponivel: { label: "Disponível", variant: "secondary" as const, dotColor: "bg-blue-500" },
  em_breve: { label: "Em breve", variant: "outline" as const, dotColor: "bg-muted-foreground" },
};

const gatewayStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  connected: { label: "Conectado", color: "bg-green-500", icon: Wifi },
  open: { label: "Conectado", color: "bg-green-500", icon: Wifi },
  connecting: { label: "Conectando...", color: "bg-yellow-500", icon: RefreshCw },
  disconnected: { label: "Desconectado", color: "bg-red-500", icon: WifiOff },
  close: { label: "Desconectado", color: "bg-red-500", icon: WifiOff },
};

const categoriasLabel: Record<string, { label: string; icon: React.ElementType }> = {
  pagamento: { label: "Pagamento", icon: CreditCard },
  comunicacao: { label: "Comunicação", icon: MessageSquare },
  fiscal: { label: "Fiscal", icon: FileText },
  logistica: { label: "Logística", icon: Truck },
  produtividade: { label: "Produtividade", icon: Zap },
};

export default function Integracoes() {
  const [selectedIntegracao, setSelectedIntegracao] = useState<Integracao | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tabAtiva, setTabAtiva] = useState("todas");

  const { unidades } = useUnidade();

  // Generic per-unit configs from integracoes_config
  const [genericConfigs, setGenericConfigs] = useState<any[]>([]);
  const [configUnidadeId, setConfigUnidadeId] = useState("");
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [configEditId, setConfigEditId] = useState<string | null>(null);

  // WhatsApp per-unit config (legacy table)
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappConfigs, setWhatsappConfigs] = useState<any[]>([]);
  const [wpProvedor, setWpProvedor] = useState<"zapi" | "uazapi" | "meta" | "evolution">("zapi");
  const [wpMetaVerifyToken, setWpMetaVerifyToken] = useState("gasfacil_meta_verify");
  const [wpUnidadeId, setWpUnidadeId] = useState("");
  const [wpInstanceId, setWpInstanceId] = useState("");
  const [wpToken, setWpToken] = useState("");
  const [wpSecurityToken, setWpSecurityToken] = useState("");
  const [wpBaseUrl, setWpBaseUrl] = useState("");
  const [wpDescontoEtapa1, setWpDescontoEtapa1] = useState("5");
  const [wpDescontoEtapa2, setWpDescontoEtapa2] = useState("10");
  const [wpPrecoMinimoP13, setWpPrecoMinimoP13] = useState("");
  const [wpPrecoMinimoP20, setWpPrecoMinimoP20] = useState("");
  const [wpSaving, setWpSaving] = useState(false);
  const [wpEditId, setWpEditId] = useState<string | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrInstanceName, setQrInstanceName] = useState("");
  const [qrStatus, setQrStatus] = useState<string | null>(null);

  const handleEvolutionConnect = async (cfg: any) => {
    setQrInstanceName(cfg.instance_id);
    setQrCodeData(null);
    setQrStatus(null);
    setQrDialogOpen(true);
    setQrLoading(true);
    try {
      // First try to create the instance (idempotent)
      await supabase.functions.invoke("evolution-proxy", {
        body: { action: "create", instance_id: cfg.instance_id },
      });
      // Then get QR code
      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: { action: "qrcode", instance_id: cfg.instance_id },
      });
      if (error) throw error;
      const qr = data?.qrcode?.base64 || data?.base64 || data?.qrcode || null;
      if (qr) {
        setQrCodeData(qr);
      } else if (data?.instance?.state === "open" || data?.instance?.state === "connected") {
        setQrStatus("connected");
      } else {
        toast.info("Nenhum QR Code retornado. Verifique se a instância existe no servidor.");
      }
    } catch (err: any) {
      console.error("Evolution connect error:", err);
      toast.error("Erro ao conectar: " + (err.message || "Verifique o servidor"));
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

  // QR Code state for Evolution API
  const [wpQrCode, setWpQrCode] = useState<string | null>(null);
  const [wpConnecting, setWpConnecting] = useState(false);
  const [wpConnectionStatus, setWpConnectionStatus] = useState<string | null>(null);
  const [wpConfiguringWebhook, setWpConfiguringWebhook] = useState(false);
  const [wpNomeBot, setWpNomeBot] = useState("Bia");

  // Gateway specific states (merged from WhatsAppGateway.tsx)
  const [gatewayInstances, setGatewayInstances] = useState<GatewayInstance[]>([]);
  const [gatewayMessagesOpen, setGatewayMessagesOpen] = useState(false);
  const [gatewaySelectedInstance, setGatewaySelectedInstance] = useState<GatewayInstance | null>(null);
  const [gatewayMessages, setGatewayMessages] = useState<GatewayMessage[]>([]);
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [gatewayActionLoading, setGatewayActionLoading] = useState<string | null>(null);
  const [gatewayQrLoading, setGatewayQrLoading] = useState<string | null>(null);

  const callGatewayApi = async (path: string, method = "GET", body?: any) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/whatsapp-gateway-api${path}`;
    const session = (await supabase.auth.getSession()).data.session;
    
    const resp = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return resp.json();
  };

  const loadGatewayInstances = async () => {
    setGatewayLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_gateway_instances")
      .select("*, unidades(nome)")
      .order("created_at");
    if (!error) setGatewayInstances((data as any) || []);
    setGatewayLoading(false);
  };

  const handleCreateGateway = async () => {
    try {
      setGatewayActionLoading("create");
      const name = `inst_${Math.random().toString(36).substring(2, 7)}`;
      const result = await callGatewayApi("/instances/create", "POST", {
        name,
        unidade_id: wpUnidadeId,
      });
      if (result.success) {
        toast.success("Instância criada!");
        await loadGatewayInstances();
      } else {
        toast.error(result.message || "Erro ao criar");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGatewayActionLoading(null);
    }
  };

  const handleGetGatewayQR = async (instanceName: string) => {
    try {
      setGatewayQrLoading(instanceName);
      const result = await callGatewayApi(`/instances/${instanceName}/qr`);
      if (result.success && result.qr) {
        setWpQrCode(result.qr);
        setWpConnectionStatus("QR Code gerado");
      } else {
        toast.error(result.message || "Erro ao obter QR");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGatewayQrLoading(null);
    }
  };

  const manageGatewayAction = async (instanceName: string, action: "disconnect" | "restart" | "delete") => {
    try {
      setGatewayActionLoading(`${instanceName}-${action}`);
      const method = action === "delete" ? "DELETE" : "POST";
      const result = await callGatewayApi(`/instances/${instanceName}/${action}`, method);
      if (result.success) {
        toast.success(`Ação ${action} concluída!`);
        await loadGatewayInstances();
      } else {
        toast.error(result.message || `Erro ao ${action}`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGatewayActionLoading(null);
    }
  };

  const handleViewGatewayMessages = async (instance: GatewayInstance) => {
    try {
      setGatewaySelectedInstance(instance);
      setGatewayMessagesOpen(true);
      setGatewayLoading(true);
      const result = await callGatewayApi(`/instances/${instance.instance_name}/messages`);
      if (result.success) {
        setGatewayMessages(result.messages || []);
      }
    } catch (err: any) {
      toast.error("Erro ao carregar mensagens");
    } finally {
      setGatewayLoading(false);
    }
  };

  const loadWhatsappConfigs = async () => {
    const { data } = await supabase
      .from("integracoes_whatsapp")
      .select("*, unidades(nome)")
      .order("created_at");
    setWhatsappConfigs(data || []);
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
  }, []);

  // --- WhatsApp handlers (legacy) ---
  const handleSaveWhatsapp = async () => {
    if (!wpUnidadeId || !wpInstanceId || !wpToken) {
      toast.error("Preencha Unidade, Instance ID e Token.");
      return;
    }
    setWpSaving(true);
    try {
      const payload = {
        unidade_id: wpUnidadeId,
        instance_id: wpProvedor === "meta" ? (wpInstanceId || "meta") : wpInstanceId,
        token: wpToken,
        security_token: wpSecurityToken || null,
        base_url: wpProvedor === "evolution" ? wpBaseUrl : null,
        provedor: wpProvedor,
        desconto_etapa1: parseFloat(wpDescontoEtapa1) || 5,
        desconto_etapa2: parseFloat(wpDescontoEtapa2) || 10,
        preco_minimo_p13: wpPrecoMinimoP13 ? parseFloat(wpPrecoMinimoP13) : null,
        preco_minimo_p20: wpPrecoMinimoP20 ? parseFloat(wpPrecoMinimoP20) : null,
        ativo: true,
        meta_phone_number_id: wpProvedor === "meta" ? wpInstanceId : null,
        meta_verify_token: wpProvedor === "meta" ? wpMetaVerifyToken : null,
      } as any;
      if (wpEditId) {
        const { error } = await supabase.from("integracoes_whatsapp").update(payload).eq("id", wpEditId);
        if (error) throw error;
        toast.success("Configuração atualizada!");
      } else {
        const { error } = await supabase.from("integracoes_whatsapp").insert(payload);
        if (error) throw error;
        toast.success("WhatsApp vinculado à unidade!");
      }
      await loadWhatsappConfigs();
      resetWhatsappForm();
      loadGatewayInstances();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setWpSaving(false);
    }
  };

  const resetWhatsappForm = () => {
    setWpProvedor("evolution");
    setWpUnidadeId("");
    setWpInstanceId("gasfacil_matriz");
    setWpToken("");
    setWpSecurityToken("");
    setWpBaseUrl("http://187.77.52.241:8000");
    setWpDescontoEtapa1("5");
    setWpDescontoEtapa2("10");
    if (unidades.length === 1) {
      setWpUnidadeId(unidades[0].id);
    }
    setWpPrecoMinimoP13("");
    setWpPrecoMinimoP20("");
    setWpEditId(null);
    setWpMetaVerifyToken("gasfacil_meta_verify");
    setWpQrCode(null);
    setWpConnecting(false);
    setWpConnectionStatus(null);
    setWpNomeBot("Bia");
  };

  // Auto-fetch QR code when dialog opens and it's a new or existing evolution config
  useEffect(() => {
    if (whatsappDialogOpen && wpProvedor === "evolution") {
      const defaultUrl = "http://187.77.52.241:8000";
      const defaultToken = "gasfacilpro2026";
      
      if (!wpBaseUrl) setWpBaseUrl(defaultUrl);
      if (!wpToken) setWpToken(defaultToken);
      
      // If we have minimal info, try to fetch QR automatically after a short delay
      if (wpInstanceId && (wpBaseUrl || defaultUrl) && (wpToken || defaultToken)) {
        const timer = setTimeout(() => {
          handleFetchQrCode();
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [whatsappDialogOpen, wpProvedor, wpInstanceId]);

  const currentWpConfig = wpEditId ? whatsappConfigs.find(c => c.id === wpEditId) : null;

  const handleFetchQrCode = async () => {
    if (!wpBaseUrl || !wpInstanceId || !wpToken) {
      toast.error("Preencha URL, Instance ID e Token (Global API Key) primeiro.");
      return;
    }
    setWpConnecting(true);
    setWpQrCode(null);
    setWpConnectionStatus("Solicitando QR Code...");
    try {
      const baseUrl = wpBaseUrl.replace(/\/$/, "");
      const resp = await fetch(`${baseUrl}/instance/connect/${wpInstanceId}`, {
        method: "GET",
        headers: { apikey: wpToken },
      });
      const data = await resp.json();
      if (data.code || data.base64) {
        setWpQrCode(data.base64 || data.code);
        setWpConnectionStatus("Escaneie o QR Code no seu WhatsApp");
        // Start polling for status
        startConnectionPolling(baseUrl, wpInstanceId, wpToken);
      } else {
        toast.error("Não foi possível gerar o QR Code. Verifique se a instância está pronta.");
        setWpConnectionStatus("Erro ao gerar QR Code");
      }
    } catch (err: any) {
      toast.error("Erro ao conectar com a Evolution API.");
      setWpConnectionStatus("Erro técnico na conexão");
    } finally {
      setWpConnecting(false);
    }
  };

  const startConnectionPolling = (baseUrl: string, instanceId: string, token: string) => {
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`${baseUrl}/instance/connectionState/${instanceId}`, {
          method: "GET",
          headers: { apikey: token },
        });
        const data = await resp.json();
        const state = data.instance?.state || data.state;
        if (state === "open" || state === "connected") {
          setWpConnectionStatus("Conectado com sucesso! 🎉");
          setWpQrCode(null);
          clearInterval(interval);
          toast.success("WhatsApp conectado!");
          loadWhatsappConfigs();
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 3000);
    // Auto-clear after 2 minutes
    setTimeout(() => clearInterval(interval), 120000);
  };

  const editWhatsappConfig = (config: any) => {
    setWpEditId(config.id);
    setWpProvedor(config.provedor || "zapi");
    setWpUnidadeId(config.unidade_id);
    setWpInstanceId(config.provedor === "meta" ? (config.meta_phone_number_id || config.instance_id) : config.instance_id);
    setWpToken(config.token);
    setWpSecurityToken(config.security_token || "");
    setWpBaseUrl(config.base_url || "");
    setWpDescontoEtapa1(String(config.desconto_etapa1 ?? 5));
    setWpDescontoEtapa2(String(config.desconto_etapa2 ?? 10));
    setWpPrecoMinimoP13(config.preco_minimo_p13 ? String(config.preco_minimo_p13) : "");
    setWpPrecoMinimoP20(config.preco_minimo_p20 ? String(config.preco_minimo_p20) : "");
    setWpMetaVerifyToken(config.meta_verify_token || "gasfacil_meta_verify");
    setWpNomeBot(config.nome_bot || "Bia");
    setWhatsappDialogOpen(true);
  };

  const deleteWhatsappConfig = async (id: string) => {
    await supabase.from("integracoes_whatsapp").delete().eq("id", id);
    toast.success("Configuração removida.");
    loadWhatsappConfigs();
  };

  const handleConfigureWebhook = async () => {
    if (!wpBaseUrl || !wpInstanceId || !wpToken) {
      toast.error("Preencha URL, Instance ID e Token primeiro.");
      return;
    }
    
    setWpConfiguringWebhook(true);
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "vjrsptpdtfexxexvjyqx"; // Fallback to provided prod ID if env missing
    const webhookUrl = `https://${projectId}.supabase.co/functions/v1/evolution-webhook?unidade_id=${wpUnidadeId}&instance=${wpInstanceId}`;
    
    try {
      const baseUrl = wpBaseUrl.replace(/\/$/, "");
      const resp = await fetch(`${baseUrl}/webhook/set/${wpInstanceId}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          apikey: wpToken 
        },
        body: JSON.stringify({
          enabled: true,
          url: webhookUrl,
          webhookByEvents: true,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "MESSAGES_DELETE",
            "SEND_MESSAGE",
            "CONNECTION_UPDATE",
            "TYPEBOT_START",
            "TYPEBOT_CHANGE_STATUS"
          ]
        }),
      });
      
      const data = await resp.json();
      if (resp.ok) {
        toast.success("Webhook configurado com sucesso na Evolution API!");
        // Also update the nome_bot if needed
        if (wpNomeBot) await supabase.from("integracoes_whatsapp").update({ nome_bot: wpNomeBot }).eq("id", wpEditId);
      } else {
        toast.error(`Erro ao configurar webhook: ${data.message || "Erro desconhecido"}`);
      }
    } catch (err: any) {
      console.error("Webhook config error:", err);
      toast.error("Falha ao conectar com a Evolution API para configurar o webhook.");
    } finally {
      setWpConfiguringWebhook(false);
    }
  };

  // --- Generic integration handlers ---
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

  const getConfigsForIntegracao = (integracaoId: string) =>
    genericConfigs.filter((c) => c.integracao_id === integracaoId);

  const conectadas = integracoes.filter((i) => i.status === "conectado").length;
  const disponiveis = integracoes.filter((i) => i.status === "disponivel").length;
  const emBreve = integracoes.filter((i) => i.status === "em_breve").length;

  const filteredIntegracoes = tabAtiva === "todas"
    ? integracoes
    : tabAtiva === "ativas"
      ? integracoes.filter(i => i.status === "conectado")
      : integracoes.filter(i => i.status === "disponivel" || i.status === "em_breve");

  const filteredCategorias = [...new Set(filteredIntegracoes.map(i => i.categoria))];

  // Auto-open WhatsApp dialog if requested via URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("open") === "whatsapp") {
      resetWhatsappForm();
      setWhatsappDialogOpen(true);
    }
  }, []);

  const handleOpenConfig = (integracao: Integracao) => {
    if (integracao.isWhatsapp) {
      resetWhatsappForm();
      setWhatsappDialogOpen(true);
      return;
    }
    if (integracao.status === "em_breve") return;
    setSelectedIntegracao(integracao);
    resetGenericForm();
    setConfigOpen(true);
  };

  return (
    <MainLayout>
      <Header title="Integrações" subtitle="Conecte serviços externos por unidade e amplie o poder do seu sistema" />
      <div className="p-4 md:p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{conectadas}</p>
                  <p className="text-xs text-muted-foreground">Ativas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-500/10">
                  <Plug className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{disponiveis}</p>
                  <p className="text-xs text-muted-foreground">Disponíveis</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-500/10">
                  <Zap className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{emBreve}</p>
                  <p className="text-xs text-muted-foreground">Em breve</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-muted">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{integracoes.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={tabAtiva} onValueChange={setTabAtiva}>
          <TabsList>
            <TabsTrigger value="todas">Todas ({integracoes.length})</TabsTrigger>
            <TabsTrigger value="ativas">Ativas ({conectadas})</TabsTrigger>
            <TabsTrigger value="disponiveis">Pendentes ({disponiveis + emBreve})</TabsTrigger>
          </TabsList>
        </Tabs>

        {filteredCategorias.map((cat) => {
          const items = filteredIntegracoes.filter((i) => i.categoria === cat);
          if (items.length === 0) return null;
          const catConfig = categoriasLabel[cat];
          const CatIcon = catConfig?.icon || Plug;

          return (
            <Card key={cat}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CatIcon className="h-4 w-4 text-muted-foreground" />
                  {catConfig?.label || cat}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {items.map((integracao, idx) => {
                  const Icon = integracao.icon;
                  const status = statusConfig[integracao.status];
                  // Count per-unit configs
                  const unitConfigs = integracao.isWhatsapp
                    ? whatsappConfigs
                    : getConfigsForIntegracao(integracao.id);

                  return (
                    <div key={integracao.id}>
                      {idx > 0 && <Separator className="my-4" />}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="p-2.5 rounded-lg bg-muted shrink-0">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">{integracao.nome}</p>
                              <Badge variant={status.variant} className="gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
                                {status.label}
                              </Badge>
                              {unitConfigs.length > 0 && (
                                <Badge variant="outline" className="gap-1 text-[10px]">
                                  <Building2 className="h-3 w-3" />
                                  {unitConfigs.length} unidade{unitConfigs.length > 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                              {integracao.descricao}
                            </p>
                            {integracao.beneficios && integracao.beneficios.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {integracao.beneficios.slice(0, 3).map((b, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px] font-normal">
                                    {b}
                                  </Badge>
                                ))}
                                {integracao.beneficios.length > 3 && (
                                  <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                                    +{integracao.beneficios.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="pl-11 sm:pl-0 flex items-center gap-2">
                          {integracao.status === "em_breve" ? (
                            <Badge variant="outline" className="text-muted-foreground">Em breve</Badge>
                          ) : (
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => handleOpenConfig(integracao)}>
                              <Settings className="h-3.5 w-3.5" />
                              Configurar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}

        {/* Sugestão proativa */}
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10 shrink-0">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">💡 Sugestões de integração</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Com base no seu uso, recomendamos configurar estas integrações para aumentar a produtividade:
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <span><strong>NF-e / NFC-e:</strong> Automatize a emissão fiscal e elimine processos manuais no SEFAZ.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <span><strong>Bina / GoTo:</strong> Identifique clientes ao atender o telefone e ganhe agilidade no atendimento.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <span><strong>Webhooks:</strong> Conecte com Zapier/Make/N8N para automações externas ilimitadas.</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog genérico por Unidade */}
      <Dialog open={configOpen} onOpenChange={(open) => { setConfigOpen(open); if (!open) resetGenericForm(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedIntegracao && <selectedIntegracao.icon className="h-5 w-5" />}
              {selectedIntegracao?.nome} — por Unidade
            </DialogTitle>
            <DialogDescription>
              Configure esta integração individualmente para cada unidade/filial.
              {selectedIntegracao?.helpUrl && (
                <a href={selectedIntegracao.helpUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary mt-1 hover:underline">
                  <ExternalLink className="h-3 w-3" /> Documentação do serviço
                </a>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Existing configs for this integration */}
          {selectedIntegracao && getConfigsForIntegracao(selectedIntegracao.id).length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Configurações ativas:</p>
              {getConfigsForIntegracao(selectedIntegracao.id).map((cfg) => (
                <div key={cfg.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{cfg.unidades?.nome || "Unidade"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {Object.entries(cfg.config || {}).filter(([, v]) => v).map(([k]) => k).join(", ") || "Configurado"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant={cfg.ativo ? "default" : "secondary"} className="text-[10px]">
                      {cfg.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => editGenericConfig(cfg, selectedIntegracao)}>
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteGenericConfig(cfg.id)}>
                      <span className="text-xs">✕</span>
                    </Button>
                  </div>
                </div>
              ))}
              <Separator />
            </div>
          )}

          {/* Form */}
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Select value={configUnidadeId} onValueChange={setConfigUnidadeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedIntegracao?.configFields?.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`cfg-${field.key}`}>{field.label}</Label>
                <Input
                  id={`cfg-${field.key}`}
                  type={field.type === "password" ? "password" : "text"}
                  placeholder={field.placeholder}
                  value={configValues[field.key] || ""}
                  onChange={(e) => setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              </div>
            ))}

            {/* Benefits */}
            {selectedIntegracao?.beneficios && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-1.5">
                <p className="text-xs font-medium">Recursos:</p>
                {selectedIntegracao.beneficios.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfigOpen(false); resetGenericForm(); }}>Cancelar</Button>
            <Button onClick={handleSaveGenericConfig} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {configEditId ? "Atualizar" : "Vincular à Unidade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog WhatsApp por Unidade */}
      <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <MessageSquare className="h-6 w-6 text-primary" />
              Central de WhatsApp
            </DialogTitle>
            <DialogDescription>
              Gerencie as conexões de WhatsApp das suas unidades. Suporte para Evolution, Z-API, Meta e instâncias In-House.
            </DialogDescription>
          </DialogHeader>

          {/* 1. Provedores Externos Configurados */}
          {whatsappConfigs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Provedores Externos
              </h3>
              <div className="grid gap-2">
                {whatsappConfigs.map((cfg) => (
                  <div key={cfg.id} className="flex items-center justify-between p-3 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="min-w-0">
                      <p className="font-bold text-sm">{(cfg as any).unidades?.nome || "Unidade"}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] h-4 uppercase">{(cfg.provedor || "zapi")}</Badge>
                        <span className="truncate">ID: {cfg.instance_id}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {cfg.provedor === "evolution" && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-[10px] gap-1 px-2 font-bold text-primary border-primary/20 bg-primary/5 hover:bg-primary/10" 
                          onClick={() => handleEvolutionConnect(cfg)}
                        >
                          <QrCode className="h-3 w-3" />
                          CONECTAR
                        </Button>
                      )}
                      <Badge variant={cfg.ativo ? "default" : "secondary"} className="text-[10px] h-5">
                        {cfg.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editWhatsappConfig(cfg)}>
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteWhatsappConfig(cfg.id)}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Separator />
            </div>
          )}

          {/* 2. Instâncias In-House (Gateway) */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                Instâncias In-House (Gateway)
              </h3>
              <Button size="sm" variant="outline" className="h-8 gap-2 font-semibold" onClick={handleCreateGateway} disabled={gatewayActionLoading === "create"}>
                {gatewayActionLoading === "create" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Nova Instância
              </Button>
            </div>
            
            {gatewayInstances.length === 0 ? (
              <div className="text-center p-6 border-2 border-dashed rounded-2xl bg-muted/5 flex flex-col items-center gap-2">
                <Smartphone className="h-6 w-6 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">Nenhuma instância in-house configurada.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {gatewayInstances.map((inst) => {
                  const status = gatewayStatusConfig[inst.status || "disconnected"] || gatewayStatusConfig.disconnected;
                  const Icon = status.icon;
                  const isLoading = gatewayActionLoading?.startsWith(inst.instance_name);
                  
                  return (
                    <div key={inst.id} className="p-4 rounded-xl border bg-card/50 flex flex-col gap-3 shadow-sm border-primary/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Smartphone className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-bold leading-none">{inst.instance_name}</p>
                            <p className="text-[10px] text-muted-foreground mt-1 font-medium">{inst.unidades?.nome || "Unidade não vinculada"}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] gap-1 font-bold py-1 ${status.color.replace('bg-', 'text-')} border-current animate-pulse`}>
                          <Icon className="h-2.5 w-2.5" />
                          {status.label.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 justify-between mt-1">
                         <div className="flex items-center gap-2">
                            <Button variant="secondary" size="sm" className="h-8 text-xs gap-2 font-bold" 
                                    onClick={() => handleGetGatewayQR(inst.instance_name)}
                                    disabled={!!gatewayQrLoading}>
                              {gatewayQrLoading === inst.instance_name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                              QR CODE
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-2" onClick={() => handleViewGatewayMessages(inst)}>
                              <Eye className="h-4 w-4" />
                              MENSAGENS
                            </Button>
                         </div>
                         <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-yellow-600 hover:bg-yellow-50" onClick={() => manageGatewayAction(inst.instance_name, "restart")} disabled={isLoading}>
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-red-50" onClick={() => manageGatewayAction(inst.instance_name, "delete")} disabled={isLoading}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                         </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Separator />
          </div>

          <div className="space-y-5 py-4">
            <h3 className="text-sm font-bold text-primary px-1">Configuração de Nova Unidade</h3>
            
            <div className="grid gap-4 bg-muted/20 p-4 rounded-2xl border border-primary/10">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Provedor</Label>
                  <Select value={wpProvedor} onValueChange={(v) => setWpProvedor(v as any)}>
                    <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zapi">Z-API (Oficial)</SelectItem>
                      <SelectItem value="uazapi">UaZapi</SelectItem>
                      <SelectItem value="meta">Meta Cloud API</SelectItem>
                      <SelectItem value="evolution">Evolution API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Unidade</Label>
                  <Select value={wpUnidadeId} onValueChange={setWpUnidadeId}>
                    <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {unidades.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">{wpProvedor === 'meta' ? 'Phone Number ID' : 'Instance ID'}</Label>
                <Input className="h-10 text-xs" value={wpInstanceId} onChange={(e) => setWpInstanceId(e.target.value)} placeholder="Identificador da instância" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Token de Acesso</Label>
                <Input className="h-10 text-xs" type="password" value={wpToken} onChange={(e) => setWpToken(e.target.value)} placeholder="API Key ou Token" />
              </div>

              {wpProvedor === "evolution" && (
                <div className="space-y-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold text-primary uppercase">Configuração Evolution</span>
                  </div>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-muted-foreground">URL do Servidor</Label>
                      <Input 
                        className="h-9 text-xs"
                        type="url"
                        value={wpBaseUrl || "http://187.77.52.241:8000"} 
                        onChange={(e) => setWpBaseUrl(e.target.value)} 
                        placeholder="http://seu-ip:8000" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-muted-foreground">Instância (ID)</Label>
                      <Input 
                        className="h-9 text-xs font-mono" 
                        value={wpInstanceId} 
                        onChange={(e) => setWpInstanceId(e.target.value)} 
                        placeholder="Ex: whatsapp_matriz" 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Inteligência da Bia</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Nome do Agente</Label>
                  <Input className="h-10 text-xs" value={wpNomeBot} onChange={(e) => setWpNomeBot(e.target.value)} placeholder="Ex: Bia" />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-bold">1º Desconto (R$)</Label>
                   <Input className="h-10 text-xs" type="number" value={wpDescontoEtapa1} onChange={(e) => setWpDescontoEtapa1(e.target.value)} />
                </div>
              </div>
            </div>

            {wpProvedor === "evolution" && wpBaseUrl && wpInstanceId && (
              <div className="space-y-4 p-5 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5">
                <div className="flex flex-col items-center gap-4">
                  {wpQrCode ? (
                    <div className="p-3 bg-white rounded-2xl shadow-xl ring-8 ring-primary/5">
                      <img src={wpQrCode} alt="WhatsApp QR Code" className="w-56 h-56" />
                    </div>
                  ) : (
                    <div className="w-56 h-56 bg-muted/50 rounded-2xl flex flex-col items-center justify-center text-center p-6 border-2 border-dashed">
                      {wpConnecting ? <RefreshCw className="h-10 w-10 text-primary animate-spin" /> : <QrCode className="h-10 w-10 text-muted-foreground/20" />}
                      <p className="text-xs text-muted-foreground mt-4 font-medium">
                        {wpConnecting ? "Gerando link seguro..." : "Clique para gerar o QR Code de conexão"}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-2 w-full max-w-xs">
                    <Button onClick={handleFetchQrCode} disabled={wpConnecting} className="w-full gap-2 font-bold py-6 shadow-lg shadow-primary/20">
                      {wpConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                      {wpQrCode ? "Regerar QR Code" : "Conectar Aparelho"}
                    </Button>
                    <Button 
                      variant="secondary" 
                      className="w-full gap-2 font-bold py-6" 
                      onClick={handleConfigureWebhook}
                      disabled={wpConfiguringWebhook || !wpUnidadeId}
                    >
                      {wpConfiguringWebhook ? <Loader2 className="h-4 w-4 animate-spin" /> : <Webhook className="h-4 w-4" />}
                      Webhook Automático
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t gap-2">
            <Button variant="ghost" onClick={() => { setWhatsappDialogOpen(false); resetWhatsappForm(); }} className="font-semibold">Fechar</Button>
            <Button onClick={handleSaveWhatsapp} disabled={wpSaving} className="font-bold px-8">
              {wpSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {wpEditId ? "Salvar Alterações" : "Ativar WhatsApp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog QR Code Evolution API */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <QrCode className="h-6 w-6 text-primary" />
              Conectar WhatsApp
            </DialogTitle>
            <DialogDescription className="font-medium">
              Vincule seu aparelho para ativar as mensagens automáticas da unidade <strong>{qrInstanceName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6 py-6">
            {qrLoading ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-sm font-semibold animate-pulse">Gerando link seguro...</p>
              </div>
            ) : qrStatus === "connected" ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="bg-green-100 p-4 rounded-full">
                  <Wifi className="h-10 w-10 text-green-600" />
                </div>
                <p className="text-lg font-bold text-green-700">Conectado com Sucesso!</p>
                <p className="text-sm text-muted-foreground">Sua unidade já está enviando mensagens.</p>
              </div>
            ) : qrCodeData ? (
              <div className="flex flex-col items-center gap-6 w-full">
                <div className="p-4 bg-white rounded-3xl shadow-2xl ring-8 ring-primary/5 border-2 border-primary/10">
                  <img
                    src={qrCodeData.startsWith("data:") ? qrCodeData : `data:image/png;base64,${qrCodeData}`}
                    alt="QR Code WhatsApp"
                    className="w-56 h-56"
                  />
                </div>
                
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 text-center w-full space-y-2">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Instruções de Pareamento</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    1. Abra o <strong>WhatsApp</strong> no seu celular<br/>
                    2. Toque em <strong>Aparelhos Conectados</strong><br/>
                    3. Toque em <strong>Conectar um aparelho</strong> e aponte a câmera.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8">
                <WifiOff className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">QR Code não disponível</p>
                <Button variant="outline" size="sm" onClick={() => {
                  const cfg = whatsappConfigs.find(c => c.instance_id === qrInstanceName);
                  if (cfg) handleEvolutionConnect(cfg);
                }}>
                  Tentar novamente
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Gateway Instances Management Section */}
      <Dialog open={gatewayMessagesOpen} onOpenChange={setGatewayMessagesOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Histórico de Mensagens — {gatewaySelectedInstance?.instance_name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-4">
              {gatewayLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
              ) : gatewayMessages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma mensagem encontrada.</p>
              ) : (
                <div className="space-y-2">
                  {gatewayMessages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.direction === 'out' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-2xl ${msg.direction === 'out' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted rounded-tl-none'}`}>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] opacity-70 font-semibold">{msg.phone}</span>
                          {msg.message_type === 'text' ? (
                             <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          ) : (
                             <div className="flex items-center gap-2 text-xs">
                               <Image className="h-4 w-4" /> Media: {msg.message_type}
                             </div>
                          )}
                          <span className="text-[9px] opacity-50 self-end">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

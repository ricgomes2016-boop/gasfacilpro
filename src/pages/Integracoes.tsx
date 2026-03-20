import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useEmpresa } from "@/contexts/EmpresaContext";
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
  CheckCircle2, Settings, Zap, BarChart3, ScanBarcode,
  Phone, Mail, Loader2, ExternalLink, AlertTriangle, Building2,
  QrCode, RefreshCw, Smartphone, Plus, Trash2,
  Signal, Wifi, WifiOff,
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
  isWhatsapp?: boolean;
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
  const { empresa } = useEmpresa();
  const [searchParams, setSearchParams] = useSearchParams();

  // Generic per-unit configs from integracoes_config
  const [genericConfigs, setGenericConfigs] = useState<any[]>([]);
  const [configUnidadeId, setConfigUnidadeId] = useState("");
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [configEditId, setConfigEditId] = useState<string | null>(null);

  // WhatsApp simplified connection
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappConfigs, setWhatsappConfigs] = useState<any[]>([]);
  const [wpUnidadeId, setWpUnidadeId] = useState("");
  const [wpInstanceId, setWpInstanceId] = useState("");
  const [wpSaving, setWpSaving] = useState(false);
  const [wpCreating, setWpCreating] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrInstanceName, setQrInstanceName] = useState("");
  const [qrStatus, setQrStatus] = useState<string | null>(null);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleEvolutionConnect = async (cfg: any) => {
    setQrInstanceName(cfg.instance_id);
    setQrCodeData(null);
    setQrStatus(null);
    setWhatsappDialogOpen(false);
    setQrDialogOpen(true);
    setQrLoading(true);
    try {
      // Try create first (idempotent)
      try {
        await supabase.functions.invoke("evolution-proxy", {
          body: { action: "create", instance_id: cfg.instance_id },
        });
      } catch (err) {
        console.warn("Instance creation warning:", err);
      }

      // Get QR code
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

    // Load connection status for each config
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
  }, []);

  // Auto-open WhatsApp dialog from URL param (?open=whatsapp)
  useEffect(() => {
    if (searchParams.get("open") === "whatsapp") {
      setWhatsappDialogOpen(true);
      searchParams.delete("open");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  // Auto-generate instance name based on empresa slug + unidade name
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
  }, [wpUnidadeId, empresa?.slug]);

  // --- Simplified WhatsApp: Create Connection ---
  const handleCreateConnection = async () => {
    if (!wpUnidadeId || !wpInstanceId) {
      toast.error("Selecione a unidade e defina o nome da instância.");
      return;
    }
    setWpCreating(true);
    try {
      // 1. Create instance on Evolution API
      const { data: createData, error: createError } = await supabase.functions.invoke("evolution-proxy", {
        body: { action: "create", instance_id: wpInstanceId },
      });
      
      if (createError) throw createError;
      
      // Extract auto-generated token
      const generatedToken = createData?._generated_token || createData?.hash?.apikey || "";
      
      // 2. Save to integracoes_whatsapp
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

      // 3. Sync with whatsapp_gateway_instances
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

      // 4. Configure webhook automatically
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "scqenurznkatvrqxqjmt";
      const webhookUrl = `https://${projectId}.supabase.co/functions/v1/evolution-webhook?unidade_id=${wpUnidadeId}&instance=${wpInstanceId}`;
      
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
      
      // 5. Show QR code
      await loadWhatsappConfigs();
      setWpUnidadeId("");
      setWpInstanceId("");
      
      // Open QR dialog for this new instance
      const newCfg = { instance_id: wpInstanceId };
      handleEvolutionConnect(newCfg);
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
      // Delete from Evolution API
      try {
        await supabase.functions.invoke("evolution-proxy", {
          body: { action: "delete", instance_id: instanceId },
        });
      } catch {
        // Ignore deletion errors from Evolution
      }
      
      // Delete from DB
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

  const handleOpenConfig = (integracao: Integracao) => {
    if (integracao.isWhatsapp) {
      setWhatsappDialogOpen(true);
      return;
    }
    if (integracao.status === "em_breve") return;
    setSelectedIntegracao(integracao);
    resetGenericForm();
    setConfigOpen(true);
  };

  // Auto-open WhatsApp dialog if requested via URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("open") === "whatsapp") {
      setWhatsappDialogOpen(true);
    }
  }, [whatsappConfigs.length]);

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

  // (auto-open handled above in earlier useEffect)

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

      {/* Dialog WhatsApp — Simplified */}
      <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <MessageSquare className="h-6 w-6 text-primary" />
              Central de WhatsApp
            </DialogTitle>
            <DialogDescription>
              Gerencie as conexões de WhatsApp das suas lojas e filiais.
            </DialogDescription>
          </DialogHeader>

          {/* Active Connections */}
          {whatsappConfigs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                Conexões Ativas
              </h3>
              <div className="grid gap-2">
                {whatsappConfigs.map((cfg) => {
                  const connStatus = connectionStatuses[cfg.id] || "disconnected";
                  const isConnected = connStatus === "open" || connStatus === "connected";
                  return (
                    <div key={cfg.id} className="p-3 rounded-xl border bg-card/50 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-lg ${isConnected ? "bg-green-500/10" : "bg-muted"}`}>
                            <Smartphone className={`h-5 w-5 ${isConnected ? "text-green-600" : "text-muted-foreground"}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate">{cfg.instance_id}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {(cfg as any).unidades?.nome || "Unidade"}
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant={isConnected ? "default" : "secondary"} 
                          className={`text-[10px] gap-1 shrink-0 ${isConnected ? "bg-green-500/10 text-green-700 border-green-500/20" : ""}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500" : "bg-muted-foreground"}`} />
                          {isConnected ? "Conectado" : "Desconectado"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pl-11">
                        <Button 
                          variant="outline" size="sm" 
                          className="h-7 text-[10px] gap-1 px-2 font-bold" 
                          onClick={() => handleEvolutionConnect(cfg)}
                        >
                          <QrCode className="h-3 w-3" />
                          {isConnected ? "Reconectar" : "Conectar"}
                        </Button>
                        <Button 
                          variant="outline" size="sm" 
                          className="h-7 text-[10px] gap-1 px-2" 
                          onClick={() => handleEvolutionStatus(cfg)}
                        >
                          <Signal className="h-3 w-3" />
                          Status
                        </Button>
                        <Button 
                          variant="ghost" size="sm" 
                          className="h-7 text-[10px] gap-1 px-2 text-destructive hover:text-destructive" 
                          onClick={() => deleteWhatsappConfig(cfg.id, cfg.instance_id)}
                          disabled={deletingId === cfg.id}
                        >
                          {deletingId === cfg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Excluir
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Separator />
            </div>
          )}

          {/* New Connection Form */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Nova Conexão
            </h3>
            
            <div className="grid gap-4 bg-muted/20 p-4 rounded-2xl border border-primary/10">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Filial / Unidade</Label>
                <Select value={wpUnidadeId} onValueChange={setWpUnidadeId}>
                  <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Selecione a unidade..." /></SelectTrigger>
                  <SelectContent>
                    {unidades.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Nome da Instância</Label>
                <Input 
                  className="h-10 text-xs font-mono" 
                  value={wpInstanceId} 
                  onChange={(e) => setWpInstanceId(e.target.value)} 
                  placeholder="Ex: suaempresa_matriz" 
                />
                <p className="text-[10px] text-muted-foreground">
                  Gerado automaticamente ao selecionar a unidade. Editável se necessário.
                </p>
              </div>

              <Button 
                onClick={handleCreateConnection} 
                disabled={wpCreating || !wpUnidadeId || !wpInstanceId} 
                className="w-full gap-2 font-bold py-5"
              >
                {wpCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Criar Conexão e Gerar QR Code
              </Button>
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
            <Button variant="ghost" onClick={() => setWhatsappDialogOpen(false)} className="font-semibold">Fechar</Button>
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
              Vincule seu aparelho para ativar as mensagens automáticas da instância <strong>{qrInstanceName}</strong>.
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
                <div className="bg-green-500/10 p-4 rounded-full">
                  <Wifi className="h-10 w-10 text-green-600" />
                </div>
                <p className="text-lg font-bold text-green-700">Conectado com Sucesso!</p>
                <p className="text-sm text-muted-foreground">Sua unidade já está enviando mensagens.</p>
              </div>
            ) : qrCodeData ? (
              <div className="flex flex-col items-center gap-6 w-full">
                <div className="p-4 bg-background rounded-3xl shadow-2xl ring-8 ring-primary/5 border-2 border-primary/10">
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
    </MainLayout>
  );
}

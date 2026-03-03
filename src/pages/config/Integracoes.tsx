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
import {
  Plug, MessageSquare, CreditCard, FileText, Truck, Globe, Webhook,
  ArrowUpRight, CheckCircle2, Settings, Zap, BarChart3, ScanBarcode,
  Phone, Mail, Receipt, Shield, Loader2, ExternalLink, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";

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
}

interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  placeholder: string;
}

const integracoes: Integracao[] = [
  {
    id: "whatsapp_zapi",
    nome: "WhatsApp (Z-API)",
    descricao: "Envio automático de comprovantes, status de entrega e atendimento ao cliente via WhatsApp — configurável por unidade",
    icon: MessageSquare,
    status: "conectado",
    categoria: "comunicacao",
    beneficios: [
      "Um número por unidade/filial",
      "Notificação automática de pedidos",
      "Envio de comprovantes PIX/boleto",
      "Chatbot de atendimento (Bia)",
    ],
    helpUrl: "https://developer.z-api.io/",
  },
  {
    id: "boleto_leitura",
    nome: "Leitura de Boletos (IA)",
    descricao: "Escaneie boletos com a câmera ou envie PDF — a IA extrai fornecedor, valor, vencimento e código de barras automaticamente",
    icon: ScanBarcode,
    status: "conectado",
    categoria: "pagamento",
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
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tabAtiva, setTabAtiva] = useState("todas");

  // WhatsApp per-unit config
  const { unidades, unidadeAtual } = useUnidade();
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappConfigs, setWhatsappConfigs] = useState<any[]>([]);
  const [wpUnidadeId, setWpUnidadeId] = useState("");
  const [wpInstanceId, setWpInstanceId] = useState("");
  const [wpToken, setWpToken] = useState("");
  const [wpSecurityToken, setWpSecurityToken] = useState("");
  const [wpSaving, setWpSaving] = useState(false);
  const [wpEditId, setWpEditId] = useState<string | null>(null);

  const loadWhatsappConfigs = async () => {
    const { data } = await supabase
      .from("integracoes_whatsapp")
      .select("*, unidades(nome)")
      .order("created_at");
    setWhatsappConfigs(data || []);
  };

  useEffect(() => { loadWhatsappConfigs(); }, []);

  const handleSaveWhatsapp = async () => {
    if (!wpUnidadeId || !wpInstanceId || !wpToken) {
      toast.error("Preencha Unidade, Instance ID e Token.");
      return;
    }
    setWpSaving(true);
    try {
      const payload = {
        unidade_id: wpUnidadeId,
        instance_id: wpInstanceId,
        token: wpToken,
        security_token: wpSecurityToken || null,
        ativo: true,
      };
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
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setWpSaving(false);
    }
  };

  const resetWhatsappForm = () => {
    setWpUnidadeId("");
    setWpInstanceId("");
    setWpToken("");
    setWpSecurityToken("");
    setWpEditId(null);
  };

  const editWhatsappConfig = (config: any) => {
    setWpEditId(config.id);
    setWpUnidadeId(config.unidade_id);
    setWpInstanceId(config.instance_id);
    setWpToken(config.token);
    setWpSecurityToken(config.security_token || "");
    setWhatsappDialogOpen(true);
  };

  const deleteWhatsappConfig = async (id: string) => {
    await supabase.from("integracoes_whatsapp").delete().eq("id", id);
    toast.success("Configuração removida.");
    loadWhatsappConfigs();
  };

  const conectadas = integracoes.filter((i) => i.status === "conectado").length;
  const disponiveis = integracoes.filter((i) => i.status === "disponivel").length;
  const emBreve = integracoes.filter((i) => i.status === "em_breve").length;

  const categorias = [...new Set(integracoes.map((i) => i.categoria))];

  const filteredIntegracoes = tabAtiva === "todas"
    ? integracoes
    : tabAtiva === "ativas"
      ? integracoes.filter(i => i.status === "conectado")
      : integracoes.filter(i => i.status === "disponivel" || i.status === "em_breve");

  const filteredCategorias = [...new Set(filteredIntegracoes.map(i => i.categoria))];

  const handleOpenConfig = (integracao: Integracao) => {
    // WhatsApp uses per-unit dialog
    if (integracao.id === "whatsapp_zapi") {
      resetWhatsappForm();
      setWhatsappDialogOpen(true);
      return;
    }
    setSelectedIntegracao(integracao);
    if (integracao.configFields && integracao.configFields.length > 0) {
      setConfigOpen(true);
    } else {
      setDetailOpen(true);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    // Simulate saving — in real usage this would call add_secret or update settings
    await new Promise(r => setTimeout(r, 1200));
    setSaving(false);
    setConfigOpen(false);
    toast.success(`Configuração de ${selectedIntegracao?.nome} salva com sucesso!`);
  };

  return (
    <MainLayout>
      <Header title="Integrações" subtitle="Conecte serviços externos e amplie o poder do seu sistema" />
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

        {/* Tabs de filtro */}
        <Tabs value={tabAtiva} onValueChange={setTabAtiva}>
          <TabsList>
            <TabsTrigger value="todas">Todas ({integracoes.length})</TabsTrigger>
            <TabsTrigger value="ativas">Ativas ({conectadas})</TabsTrigger>
            <TabsTrigger value="disponiveis">Pendentes ({disponiveis + emBreve})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Por categoria */}
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
                          {integracao.status === "conectado" ? (
                            <>
                              <Switch checked disabled />
                              <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleOpenConfig(integracao)}>
                                <Settings className="h-3.5 w-3.5" />
                                Detalhes
                              </Button>
                            </>
                          ) : integracao.status === "disponivel" ? (
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => handleOpenConfig(integracao)}>
                              <Plug className="h-3.5 w-3.5" />
                              Configurar
                            </Button>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Em breve
                            </Badge>
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

      {/* Dialog de configuração */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedIntegracao && <selectedIntegracao.icon className="h-5 w-5" />}
              Configurar {selectedIntegracao?.nome}
            </DialogTitle>
            <DialogDescription>
              Preencha as credenciais para ativar esta integração.
              {selectedIntegracao?.helpUrl && (
                <a
                  href={selectedIntegracao.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary mt-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Documentação do serviço
                </a>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedIntegracao?.configFields?.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  type={field.type === "password" ? "password" : "text"}
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveConfig} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {saving ? "Salvando..." : "Salvar e ativar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de detalhes */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedIntegracao && <selectedIntegracao.icon className="h-5 w-5" />}
              {selectedIntegracao?.nome}
            </DialogTitle>
            <DialogDescription>{selectedIntegracao?.descricao}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="default" className="gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Conectado e funcionando
              </Badge>
            </div>
            {selectedIntegracao?.beneficios && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Recursos ativos:</p>
                {selectedIntegracao.beneficios.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog WhatsApp por Unidade */}
      <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              WhatsApp por Unidade
            </DialogTitle>
            <DialogDescription>
              Cada unidade pode ter seu próprio número de WhatsApp (Z-API).
              Configure o Webhook no painel Z-API apontando para:
            </DialogDescription>
          </DialogHeader>

          {/* Existing configs */}
          {whatsappConfigs.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Configurações ativas:</p>
              {whatsappConfigs.map((cfg) => (
                <div key={cfg.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{(cfg as any).unidades?.nome || "Unidade"}</p>
                    <p className="text-xs text-muted-foreground truncate">Instance: {cfg.instance_id}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant={cfg.ativo ? "default" : "secondary"} className="text-[10px]">
                      {cfg.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => editWhatsappConfig(cfg)}>
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteWhatsappConfig(cfg.id)}>
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
              <Select value={wpUnidadeId} onValueChange={setWpUnidadeId}>
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
            <div className="space-y-1.5">
              <Label>Instance ID</Label>
              <Input value={wpInstanceId} onChange={(e) => setWpInstanceId(e.target.value)} placeholder="Sua Instance ID da Z-API" />
            </div>
            <div className="space-y-1.5">
              <Label>Token</Label>
              <Input type="password" value={wpToken} onChange={(e) => setWpToken(e.target.value)} placeholder="Token da Z-API" />
            </div>
            <div className="space-y-1.5">
              <Label>Security Token (opcional)</Label>
              <Input type="password" value={wpSecurityToken} onChange={(e) => setWpSecurityToken(e.target.value)} placeholder="Token de segurança" />
            </div>

            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <p className="text-xs font-medium">URL do Webhook (cole no painel Z-API):</p>
              <code className="text-[11px] break-all text-primary">
                {`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/zapi-webhook?unidade_id=${wpUnidadeId || "<selecione>"}`}
              </code>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setWhatsappDialogOpen(false); resetWhatsappForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleSaveWhatsapp} disabled={wpSaving}>
              {wpSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {wpEditId ? "Atualizar" : "Vincular WhatsApp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

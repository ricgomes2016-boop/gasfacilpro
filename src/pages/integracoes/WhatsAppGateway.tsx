import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Smartphone, QrCode, Plus, RefreshCw, Trash2, Power, PowerOff,
  Settings, MessageSquare, Webhook, Loader2, Copy, Check,
  Signal, SignalZero, Wifi, WifiOff, ExternalLink, Code2, Eye,
  ArrowUpDown, Phone, Send, Image, FileText, MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

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

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  connected: { label: "Conectado", color: "bg-green-500", icon: Wifi },
  open: { label: "Conectado", color: "bg-green-500", icon: Wifi },
  connecting: { label: "Conectando...", color: "bg-yellow-500", icon: RefreshCw },
  disconnected: { label: "Desconectado", color: "bg-red-500", icon: WifiOff },
  close: { label: "Desconectado", color: "bg-red-500", icon: WifiOff },
};

export default function WhatsAppGateway() {
  const { unidades, unidadeAtual } = useUnidade();
  const { profile } = useAuth();
  const [instances, setInstances] = useState<GatewayInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [apiDocsOpen, setApiDocsOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<GatewayInstance | null>(null);
  const [messages, setMessages] = useState<GatewayMessage[]>([]);
  const [qrLoading, setQrLoading] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("instances");

  // Form state
  const [formName, setFormName] = useState("");
  const [formUnidade, setFormUnidade] = useState("");
  const [formEngineUrl, setFormEngineUrl] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formWebhookUrl, setFormWebhookUrl] = useState("");
  const [formWebhookSecret, setFormWebhookSecret] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  const loadInstances = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_gateway_instances")
      .select("*, unidades(nome)")
      .order("created_at");
    if (!error) setInstances((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadInstances();

    // Realtime status updates
    const channel = supabase
      .channel("gateway-instances")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "whatsapp_gateway_instances",
      }, () => {
        loadInstances();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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

  const handleCreate = async () => {
    if (!formName || !formUnidade || !formEngineUrl) {
      toast.error("Preencha nome, unidade e URL do engine.");
      return;
    }
    setFormSaving(true);
    try {
      const { data: unidade } = await supabase
        .from("unidades")
        .select("empresa_id")
        .eq("id", formUnidade)
        .single();

      const { error } = await supabase.from("whatsapp_gateway_instances").insert({
        empresa_id: unidade?.empresa_id,
        unidade_id: formUnidade,
        instance_name: formName.toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
        engine_url: formEngineUrl,
        api_key: formApiKey || null,
        webhook_url: formWebhookUrl || null,
        webhook_secret: formWebhookSecret || null,
      });
      if (error) throw error;
      toast.success("Instância criada!");
      setCreateOpen(false);
      resetForm();
      loadInstances();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleGetQR = async (instance: GatewayInstance) => {
    setQrLoading(instance.id);
    try {
      const result = await callGatewayApi(`/instances/${instance.instance_name}/qrcode`);
      if (result.qrcode) {
        toast.success("QR Code gerado! Escaneie com seu WhatsApp.");
        loadInstances();
      } else {
        toast.info("Nenhum QR Code disponível. A instância pode já estar conectada.");
      }
    } catch {
      toast.error("Erro ao obter QR Code.");
    } finally {
      setQrLoading(null);
    }
  };

  const handleDisconnect = async (instance: GatewayInstance) => {
    setActionLoading(instance.id);
    try {
      await callGatewayApi(`/instances/${instance.instance_name}/disconnect`, "POST");
      toast.success("Instância desconectada.");
      loadInstances();
    } catch {
      toast.error("Erro ao desconectar.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async (instance: GatewayInstance) => {
    setActionLoading(instance.id);
    try {
      await callGatewayApi(`/instances/${instance.instance_name}/restart`, "POST");
      toast.success("Instância reiniciada.");
      loadInstances();
    } catch {
      toast.error("Erro ao reiniciar.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (instanceId: string) => {
    const instance = instances.find(i => i.id === instanceId);
    if (!instance) return;
    try {
      await callGatewayApi(`/instances/${instance.instance_name}/delete`, "DELETE");
      toast.success("Instância removida.");
      setDeleteConfirm(null);
      loadInstances();
    } catch {
      // Fallback: delete from DB directly
      await supabase.from("whatsapp_gateway_instances").delete().eq("id", instanceId);
      toast.success("Instância removida.");
      setDeleteConfirm(null);
      loadInstances();
    }
  };

  const handleOpenConfig = (instance: GatewayInstance) => {
    setSelectedInstance(instance);
    setFormWebhookUrl(instance.webhook_url || "");
    setFormWebhookSecret(instance.webhook_secret || "");
    setFormEngineUrl(instance.engine_url);
    setFormApiKey(instance.api_key || "");
    setConfigOpen(true);
  };

  const handleSaveConfig = async () => {
    if (!selectedInstance) return;
    setFormSaving(true);
    try {
      const { error } = await supabase.from("whatsapp_gateway_instances")
        .update({
          webhook_url: formWebhookUrl || null,
          webhook_secret: formWebhookSecret || null,
          engine_url: formEngineUrl,
          api_key: formApiKey || null,
        })
        .eq("id", selectedInstance.id);
      if (error) throw error;
      toast.success("Configuração salva!");
      setConfigOpen(false);
      loadInstances();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setFormSaving(false);
    }
  };

  const handleViewMessages = async (instance: GatewayInstance) => {
    setSelectedInstance(instance);
    setMessagesOpen(true);
    const { data } = await supabase
      .from("whatsapp_gateway_messages")
      .select("*")
      .eq("instance_id", instance.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setMessages((data as any) || []);
  };

  const resetForm = () => {
    setFormName("");
    setFormUnidade("");
    setFormEngineUrl("");
    setFormApiKey("");
    setFormWebhookUrl("");
    setFormWebhookSecret("");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copiado!");
  };

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const gatewayBaseUrl = `https://${projectId}.supabase.co/functions/v1/whatsapp-gateway-api`;

  const connectedCount = instances.filter(i => i.status === "connected" || i.status === "open").length;
  const disconnectedCount = instances.filter(i => i.status === "disconnected" || i.status === "close").length;

  return (
    <MainLayout>
      <Header title="WhatsApp Gateway" subtitle="Gerencie instâncias WhatsApp via QR Code — substituto direto de Z-API" />
      <div className="p-4 md:p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10"><Wifi className="h-5 w-5 text-green-500" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{connectedCount}</p>
                <p className="text-xs text-muted-foreground">Conectadas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-500/20 bg-red-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10"><WifiOff className="h-5 w-5 text-red-500" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{disconnectedCount}</p>
                <p className="text-xs text-muted-foreground">Desconectadas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Smartphone className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{instances.length}</p>
                <p className="text-xs text-muted-foreground">Total Instâncias</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10"><Code2 className="h-5 w-5 text-blue-500" /></div>
              <div>
                <Button variant="outline" size="sm" onClick={() => setApiDocsOpen(true)} className="text-xs">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  API Docs
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Instância
          </Button>
          <Button variant="outline" onClick={loadInstances} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {/* Instances Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : instances.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Smartphone className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma instância criada</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Crie sua primeira instância WhatsApp para começar a enviar e receber mensagens.
              </p>
              <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Instância
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {instances.map((instance) => {
                const st = statusConfig[instance.status] || statusConfig.disconnected;
                const StatusIcon = st.icon;
                const isConnected = instance.status === "connected" || instance.status === "open";
                const isLoading = actionLoading === instance.id || qrLoading === instance.id;

                return (
                  <motion.div
                    key={instance.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Smartphone className="h-4 w-4 text-primary" />
                              {instance.instance_name}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {(instance as any).unidades?.nome || "—"}
                            </CardDescription>
                          </div>
                          <Badge variant="outline" className="gap-1.5 text-xs">
                            <span className={`h-2 w-2 rounded-full ${st.color}`} />
                            {st.label}
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {/* QR Code or Phone */}
                        {isConnected ? (
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                            <Phone className="h-5 w-5 text-green-500" />
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {instance.phone || "Conectado"}
                              </p>
                              <p className="text-xs text-muted-foreground">WhatsApp ativo</p>
                            </div>
                          </div>
                        ) : instance.qr_code ? (
                          <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
                            <img
                              src={instance.qr_code.startsWith("data:") ? instance.qr_code : `data:image/png;base64,${instance.qr_code}`}
                              alt="QR Code"
                              className="w-48 h-48 rounded-lg"
                            />
                            <p className="text-xs text-muted-foreground">Escaneie com seu WhatsApp</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 p-6 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/20">
                            <QrCode className="h-10 w-10 text-muted-foreground/40" />
                            <p className="text-xs text-muted-foreground">Clique em "Conectar" para gerar QR Code</p>
                          </div>
                        )}

                        {/* Webhook indicator */}
                        {instance.webhook_url && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Webhook className="h-3 w-3" />
                            <span className="truncate">{instance.webhook_url}</span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                          {!isConnected && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleGetQR(instance)}
                              disabled={isLoading}
                              className="gap-1.5 text-xs"
                            >
                              {qrLoading === instance.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <QrCode className="h-3 w-3" />
                              )}
                              Conectar
                            </Button>
                          )}
                          {isConnected && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDisconnect(instance)}
                              disabled={isLoading}
                              className="gap-1.5 text-xs text-red-500 hover:text-red-600"
                            >
                              <PowerOff className="h-3 w-3" />
                              Desconectar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestart(instance)}
                            disabled={isLoading}
                            className="gap-1.5 text-xs"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenConfig(instance)}
                            className="gap-1.5 text-xs"
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewMessages(instance)}
                            className="gap-1.5 text-xs"
                          >
                            <MessageSquare className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirm(instance.id)}
                            className="gap-1.5 text-xs text-red-500 hover:text-red-600 ml-auto"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* CREATE DIALOG */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Nova Instância WhatsApp
              </DialogTitle>
              <DialogDescription>
                Configure uma nova instância conectada ao seu WhatsApp Engine (Baileys/Evolution API)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Instância *</Label>
                <Input
                  placeholder="centralgas_filial1"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Use apenas letras minúsculas, números, _ e -</p>
              </div>
              <div className="space-y-2">
                <Label>Unidade *</Label>
                <Select value={formUnidade} onValueChange={setFormUnidade}>
                  <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                  <SelectContent>
                    {unidades.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>URL do Engine (Baileys/Evolution API) *</Label>
                <Input
                  placeholder="https://seu-servidor.com:8080"
                  value={formEngineUrl}
                  onChange={(e) => setFormEngineUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>API Key do Engine</Label>
                <Input
                  placeholder="Chave de autenticação do engine"
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  type="password"
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Webhook URL (para receber mensagens)</Label>
                <Input
                  placeholder="https://seu-erp.com/webhook"
                  value={formWebhookUrl}
                  onChange={(e) => setFormWebhookUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Webhook Secret</Label>
                <Input
                  placeholder="Token de segurança"
                  value={formWebhookSecret}
                  onChange={(e) => setFormWebhookSecret(e.target.value)}
                  type="password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={formSaving}>
                {formSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Criar Instância
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* CONFIG DIALOG */}
        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Configurações: {selectedInstance?.instance_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>URL do Engine</Label>
                <Input
                  value={formEngineUrl}
                  onChange={(e) => setFormEngineUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  type="password"
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input
                  value={formWebhookUrl}
                  onChange={(e) => setFormWebhookUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Webhook Secret</Label>
                <Input
                  value={formWebhookSecret}
                  onChange={(e) => setFormWebhookSecret(e.target.value)}
                  type="password"
                />
              </div>
              <Separator />
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">URL do Webhook (para configurar no Engine)</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-background p-2 rounded flex-1 break-all">
                    {gatewayBaseUrl}/webhook/{selectedInstance?.instance_name}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => copyToClipboard(`${gatewayBaseUrl}/webhook/${selectedInstance?.instance_name}`)}
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveConfig} disabled={formSaving}>
                {formSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MESSAGES DIALOG */}
        <Dialog open={messagesOpen} onOpenChange={setMessagesOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Mensagens: {selectedInstance?.instance_name}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[500px]">
              {messages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma mensagem registrada.</p>
              ) : (
                <div className="space-y-2 pr-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg text-sm ${
                        msg.direction === "inbound"
                          ? "bg-muted/50 mr-12"
                          : "bg-primary/10 ml-12"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-xs">
                          {msg.direction === "inbound" ? "📥" : "📤"} {msg.phone}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-foreground">{msg.message || `[${msg.message_type}]`}</p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* DELETE CONFIRM */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir instância?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação é irreversível. A instância será desconectada e todo o histórico de mensagens será perdido.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* API DOCS DIALOG */}
        <Dialog open={apiDocsOpen} onOpenChange={setApiDocsOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-primary" />
                API Documentation
              </DialogTitle>
              <DialogDescription>
                REST API compatível com Z-API para integração com ERPs e assistentes IA
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[500px]">
              <div className="space-y-6 pr-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2 text-foreground">Base URL</h3>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted p-2 rounded flex-1 break-all">{gatewayBaseUrl}</code>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(gatewayBaseUrl)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <Separator />

                {[
                  {
                    method: "POST",
                    path: "/instances/{name}/send-text",
                    desc: "Enviar mensagem de texto",
                    body: '{ "phone": "5543999999999", "message": "Olá!" }',
                    color: "text-green-500",
                  },
                  {
                    method: "POST",
                    path: "/instances/{name}/send-image",
                    desc: "Enviar imagem",
                    body: '{ "phone": "5543999999999", "image": "https://...", "caption": "Legenda" }',
                    color: "text-green-500",
                  },
                  {
                    method: "POST",
                    path: "/instances/{name}/send-document",
                    desc: "Enviar documento",
                    body: '{ "phone": "5543999999999", "document": "https://...", "fileName": "nota.pdf" }',
                    color: "text-green-500",
                  },
                  {
                    method: "POST",
                    path: "/instances/{name}/send-location",
                    desc: "Enviar localização",
                    body: '{ "phone": "5543999999999", "latitude": -23.55, "longitude": -46.63 }',
                    color: "text-green-500",
                  },
                  {
                    method: "GET",
                    path: "/instances/{name}/status",
                    desc: "Verificar status da instância",
                    body: null,
                    color: "text-blue-500",
                  },
                  {
                    method: "GET",
                    path: "/instances/{name}/qrcode",
                    desc: "Obter QR Code para conexão",
                    body: null,
                    color: "text-blue-500",
                  },
                  {
                    method: "GET",
                    path: "/instances/{name}/messages",
                    desc: "Histórico de mensagens",
                    body: null,
                    color: "text-blue-500",
                  },
                  {
                    method: "POST",
                    path: "/instances/{name}/disconnect",
                    desc: "Desconectar instância",
                    body: null,
                    color: "text-yellow-500",
                  },
                  {
                    method: "POST",
                    path: "/instances/{name}/restart",
                    desc: "Reiniciar instância",
                    body: null,
                    color: "text-yellow-500",
                  },
                  {
                    method: "DELETE",
                    path: "/instances/{name}/delete",
                    desc: "Excluir instância",
                    body: null,
                    color: "text-red-500",
                  },
                ].map((endpoint, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`font-mono text-xs ${endpoint.color}`}>
                        {endpoint.method}
                      </Badge>
                      <code className="text-xs text-foreground">{endpoint.path}</code>
                    </div>
                    <p className="text-xs text-muted-foreground">{endpoint.desc}</p>
                    {endpoint.body && (
                      <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto">
                        {endpoint.body}
                      </pre>
                    )}
                  </div>
                ))}

                <Separator />

                <div>
                  <h3 className="text-sm font-semibold mb-2 text-foreground">Webhook Payload (mensagens recebidas)</h3>
                  <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto">
{`{
  "instance": "centralgas_filial1",
  "instance_id": "uuid",
  "phone": "5543999999999",
  "name": "Carlos",
  "message": "Quero gás",
  "timestamp": "2026-03-10T04:00:00.000Z",
  "raw": { ... }
}`}
                  </pre>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2 text-foreground">Autenticação</h3>
                  <p className="text-xs text-muted-foreground">
                    Use o header <code className="bg-muted px-1 rounded">Authorization: Bearer {`{supabase_jwt}`}</code> para
                    chamadas autenticadas, ou configure uma API Key customizada no engine.
                  </p>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

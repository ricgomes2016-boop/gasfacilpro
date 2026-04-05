import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Wifi, WifiOff, Loader2, QrCode, Settings, RefreshCw, Phone, Building2 } from "lucide-react";
import { useEffect, useRef } from "react";

type ProvedorTipo = "meta" | "evolution" | "zapi" | "uazapi";
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

const PROVEDOR_LABELS: Record<ProvedorTipo, string> = {
  meta: "Meta Cloud API",
  evolution: "Evolution API",
  zapi: "Z-API",
  uazapi: "UazAPI",
};

const STATUS_CONFIG: Record<StatusConexao, { color: string; label: string; icon: typeof Wifi }> = {
  conectado: { color: "bg-emerald-500", label: "Conectado", icon: Wifi },
  desconectado: { color: "bg-red-500", label: "Desconectado", icon: WifiOff },
  aguardando: { color: "bg-amber-500", label: "Aguardando", icon: Loader2 },
};

export default function AdminWhatsAppConfig() {
  const queryClient = useQueryClient();
  const [selectedUnidade, setSelectedUnidade] = useState<Unidade | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrCountdown, setQrCountdown] = useState(60);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Form state
  const [formProvedor, setFormProvedor] = useState<ProvedorTipo>("evolution");
  const [formFields, setFormFields] = useState<Record<string, string>>({});

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
        .select("*");
      if (error) throw error;
      return data as unknown as WhatsAppConfig[];
    },
  });

  const getConfigForUnidade = (unidadeId: string) =>
    configs?.find((c) => c.unidade_id === unidadeId);

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
            instance_id: params.data.instance_id || "",
            token: params.data.token || params.data.instancia_token || "",
            provedor: params.data.provedor_tipo || "evolution",
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

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/whatsapp-gateway-api`;

      const res = await fetch(`${url}/instances/${config.instancia_nome || config.instance_id}/status`, {
        headers: { apikey: config.instancia_token || config.token },
      });
      const result = await res.json();

      const newStatus: StatusConexao = result?.state === "open" || result?.connected
        ? "conectado"
        : "desconectado";

      await supabase
        .from("integracoes_whatsapp")
        .update({
          status_conexao: newStatus,
          ultima_verificacao: new Date().toISOString(),
        })
        .eq("id", config.id);

      return newStatus;
    },
    onSuccess: (status) => {
      queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-configs"] });
      toast.success(`Status: ${status}`);
    },
    onError: (err: any) => toast.error("Erro ao verificar: " + err.message),
  });

  const openConfigDialog = (unidade: Unidade) => {
    setSelectedUnidade(unidade);
    const config = getConfigForUnidade(unidade.id);
    setFormProvedor((config?.provedor_tipo as ProvedorTipo) || (config?.provedor as ProvedorTipo) || "evolution");
    setFormFields({
      instancia_nome: config?.instancia_nome || config?.instance_id || "",
      instancia_token: config?.instancia_token || config?.token || "",
      instancia_url: config?.instancia_url || config?.base_url || "",
      numero_telefone: config?.numero_telefone || "",
      meta_phone_number_id: config?.meta_phone_number_id || "",
      meta_waba_id: config?.meta_waba_id || "",
      meta_access_token: config?.meta_access_token || "",
      nome_bot: config?.nome_bot || "BIA",
    });
    setConfigDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedUnidade) return;
    const data: Record<string, any> = {
      provedor_tipo: formProvedor,
      provedor: formProvedor,
      nome_bot: formFields.nome_bot,
      numero_telefone: formFields.numero_telefone,
      ativo: true,
    };

    if (formProvedor === "meta") {
      data.meta_phone_number_id = formFields.meta_phone_number_id;
      data.meta_waba_id = formFields.meta_waba_id;
      data.meta_access_token = formFields.meta_access_token;
      data.token = formFields.meta_access_token;
      data.instance_id = formFields.meta_phone_number_id;
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

  const handleGenerateQR = async (unidade: Unidade) => {
    setSelectedUnidade(unidade);
    setQrCode(null);
    setQrCountdown(60);
    setQrDialogOpen(true);

    try {
      const config = getConfigForUnidade(unidade.id);
      if (!config) throw new Error("Configure o provedor primeiro");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/whatsapp-gateway-api`;

      const res = await fetch(`${url}/instances/${config.instancia_nome || config.instance_id}/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.instancia_token || config.token,
        },
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
      } else {
        toast.info("Instância já conectada ou QR não disponível.");
        setQrDialogOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message);
      setQrDialogOpen(false);
    }
  };

  // QR countdown
  useEffect(() => {
    if (qrDialogOpen && qrCode) {
      countdownRef.current = setInterval(() => {
        setQrCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
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

  const getStatusInfo = (config: WhatsAppConfig | undefined) => {
    const status = (config?.status_conexao as StatusConexao) || "desconectado";
    return STATUS_CONFIG[status] || STATUS_CONFIG.desconectado;
  };

  if (loadingUnidades || loadingConfigs) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuração WhatsApp</h1>
        <p className="text-muted-foreground">Gerencie as conexões WhatsApp de cada unidade</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {unidades?.map((unidade) => {
          const config = getConfigForUnidade(unidade.id);
          const statusInfo = getStatusInfo(config);
          const StatusIcon = statusInfo.icon;
          const provedor = (config?.provedor_tipo || config?.provedor || "—") as string;

          return (
            <Card key={unidade.id} className="relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full ${statusInfo.color}`} />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{unidade.nome}</CardTitle>
                      <CardDescription className="text-xs">
                        {unidade.tipo === "matriz" ? "Matriz" : "Filial"}
                        {unidade.cnpj && ` · ${unidade.cnpj}`}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs gap-1 ${
                      statusInfo.label === "Conectado"
                        ? "border-emerald-500 text-emerald-700"
                        : statusInfo.label === "Aguardando"
                        ? "border-amber-500 text-amber-700"
                        : "border-red-500 text-red-700"
                    }`}
                  >
                    <StatusIcon className={`h-3 w-3 ${statusInfo.label === "Aguardando" ? "animate-spin" : ""}`} />
                    {statusInfo.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provedor:</span>
                    <span className="font-medium">
                      {PROVEDOR_LABELS[provedor as ProvedorTipo] || provedor}
                    </span>
                  </div>
                  {config?.numero_telefone && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Número:</span>
                      <span className="font-medium flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {config.numero_telefone}
                      </span>
                    </div>
                  )}
                  {config?.ultima_verificacao && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Última verificação:</span>
                      <span className="text-xs">
                        {new Date(config.ultima_verificacao).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openConfigDialog(unidade)}
                  >
                    <Settings className="h-4 w-4 mr-1" /> Configurar
                  </Button>
                  {config && provedor !== "meta" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateQR(unidade)}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                  )}
                  {config && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => verifyMutation.mutate(unidade.id)}
                      disabled={verifyMutation.isPending}
                    >
                      <RefreshCw className={`h-4 w-4 ${verifyMutation.isPending ? "animate-spin" : ""}`} />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Config Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar WhatsApp — {selectedUnidade?.nome}</DialogTitle>
            <DialogDescription>
              Preencha os dados do provedor de WhatsApp para esta unidade.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Provedor</Label>
              <Select value={formProvedor} onValueChange={(v) => setFormProvedor(v as ProvedorTipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">Meta Cloud API</SelectItem>
                  <SelectItem value="evolution">Evolution API</SelectItem>
                  <SelectItem value="zapi">Z-API</SelectItem>
                  <SelectItem value="uazapi">UazAPI</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
                onChange={(e) => setFormFields((f) => ({ ...f, numero_telefone: e.target.value }))}
                placeholder="+55 43 9807-0028"
              />
            </div>

            {formProvedor === "meta" && (
              <>
                <div className="space-y-2">
                  <Label>Phone Number ID</Label>
                  <Input
                    value={formFields.meta_phone_number_id || ""}
                    onChange={(e) => setFormFields((f) => ({ ...f, meta_phone_number_id: e.target.value }))}
                    placeholder="1025260084009234"
                  />
                </div>
                <div className="space-y-2">
                  <Label>WABA ID</Label>
                  <Input
                    value={formFields.meta_waba_id || ""}
                    onChange={(e) => setFormFields((f) => ({ ...f, meta_waba_id: e.target.value }))}
                    placeholder="898649429546834"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Access Token</Label>
                  <Input
                    type="password"
                    value={formFields.meta_access_token || ""}
                    onChange={(e) => setFormFields((f) => ({ ...f, meta_access_token: e.target.value }))}
                    placeholder="EAAYFZ..."
                  />
                </div>
              </>
            )}

            {formProvedor !== "meta" && (
              <>
                <div className="space-y-2">
                  <Label>Nome da Instância</Label>
                  <Input
                    value={formFields.instancia_nome || ""}
                    onChange={(e) => setFormFields((f) => ({ ...f, instancia_nome: e.target.value }))}
                    placeholder="minha-instancia"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Token da Instância</Label>
                  <Input
                    type="password"
                    value={formFields.instancia_token || ""}
                    onChange={(e) => setFormFields((f) => ({ ...f, instancia_token: e.target.value }))}
                    placeholder="Token de autenticação"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL Base</Label>
                  <Input
                    value={formFields.instancia_url || ""}
                    onChange={(e) => setFormFields((f) => ({ ...f, instancia_url: e.target.value }))}
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
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>QR Code — {selectedUnidade?.nome}</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com o WhatsApp para conectar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrCode ? (
              <>
                <img
                  src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64 rounded-lg border"
                />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Expira em {qrCountdown}s
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Gerando QR Code...</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

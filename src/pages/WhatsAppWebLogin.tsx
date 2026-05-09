/**
 * Página de Login WhatsApp Web via QR Code
 * 
 * Conecta-se à infraestrutura existente:
 * - Evolution API (QR Code real)
 * - Gateway API (QR Code via engine)
 * - Supabase para persistência de sessão
 * - Realtime para atualizações de status
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Smartphone,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

type ConnectionStatus = "idle" | "loading" | "qr_ready" | "connecting" | "connected" | "error" | "expired";

export default function WhatsAppWebLogin() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [qrCode, setQrCode] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>("");
  const [provedor, setProvedor] = useState<string>("");
  const [instanceId, setInstanceId] = useState<string>("");

  // Buscar unidades do usuário
  const { data: unidades } = useQuery({
    queryKey: ["unidades"],
    queryFn: async () => {
      const { data } = await supabase.from("unidades").select("id, nome").order("nome");
      return data || [];
    },
  });

  // Buscar integração ativa
  const { data: integracao, refetch: refetchIntegracao } = useQuery({
    queryKey: ["integracao-whatsapp", selectedUnidadeId],
    queryFn: async () => {
      let query = supabase
        .from("integracoes_whatsapp")
        .select("*")
        .eq("ativo", true);

      if (selectedUnidadeId) {
        query = query.eq("unidade_id", selectedUnidadeId);
      }

      const { data } = await query.limit(1).maybeSingle();
      return data;
    },
    enabled: true,
  });

  // Auto-selecionar unidade e verificar status
  useEffect(() => {
    if (unidades?.length && !selectedUnidadeId) {
      setSelectedUnidadeId(unidades[0].id);
    }
  }, [unidades, selectedUnidadeId]);

  // Verificar status da integração
  useEffect(() => {
    if (integracao) {
      setProvedor(integracao.provedor || "");
      setInstanceId(integracao.instance_id || "");

      if (integracao.status_conexao === "conectado") {
        setStatus("connected");
        setPhoneNumber(integracao.numero_telefone || "");
      } else if (integracao.qr_code_base64) {
        // Verificar se QR não expirou
        const expiresAt = integracao.qr_code_expira_em
          ? new Date(integracao.qr_code_expira_em)
          : null;

        if (expiresAt && expiresAt < new Date()) {
          setStatus("expired");
        } else {
          setQrCode(integracao.qr_code_base64);
          setStatus("qr_ready");
        }
      }
    }
  }, [integracao]);

  // Realtime: escutar mudanças na integração
  useEffect(() => {
    if (!integracao?.id) return;

    const channel = supabase
      .channel(`whatsapp-login-${integracao.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "integracoes_whatsapp",
          filter: `id=eq.${integracao.id}`,
        },
        (payload) => {
          const updated = payload.new as any;

          if (updated.status_conexao === "conectado") {
            setStatus("connected");
            setPhoneNumber(updated.numero_telefone || "");
            toast.success("WhatsApp conectado com sucesso!");
          } else if (updated.qr_code_base64) {
            setQrCode(updated.qr_code_base64);
            setStatus("qr_ready");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [integracao?.id]);

  // Gerar QR Code
  const handleGenerateQR = useCallback(async () => {
    try {
      setStatus("loading");
      setErrorMessage("");

      if (!integracao) {
        setErrorMessage("Nenhuma integração WhatsApp configurada. Vá em Configurações > WhatsApp.");
        setStatus("error");
        return;
      }

      const currentProvedor = integracao.provedor;

      if (currentProvedor === "evolution") {
        // Gerar QR via Evolution Proxy
        const { data, error } = await supabase.functions.invoke("evolution-proxy", {
          body: {
            action: "qrcode",
            instance_id: integracao.instance_id,
            unidade_id: selectedUnidadeId,
          },
        });

        if (error) throw new Error(error.message);

        if (data?.qrcode?.base64 || data?.base64) {
          const qrBase64 = data.qrcode?.base64 || data.base64;
          setQrCode(qrBase64);
          setStatus("qr_ready");

          // Salvar QR no banco
          await supabase
            .from("integracoes_whatsapp")
            .update({
              qr_code_base64: qrBase64,
              qr_code_expira_em: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
              status_conexao: "aguardando",
            })
            .eq("id", integracao.id);
        } else if (data?.instance?.state === "open") {
          setStatus("connected");
          setPhoneNumber(data.instance?.phoneNumber || "");
          toast.success("WhatsApp já está conectado!");
        } else {
          throw new Error("Não foi possível gerar QR Code");
        }
      } else if (currentProvedor === "gateway" || integracao.base_url) {
        // Gerar QR via Gateway API
        const { data, error } = await supabase.functions.invoke("whatsapp-gateway-api", {
          body: {
            action: "qrcode",
            instance_name: integracao.instance_id,
          },
        });

        if (error) throw new Error(error.message);

        if (data?.qrcode) {
          setQrCode(data.qrcode);
          setStatus("qr_ready");
        } else {
          throw new Error("QR Code não disponível");
        }
      } else {
        // Meta Cloud API não usa QR Code
        setErrorMessage(
          "A API Meta Cloud não usa QR Code. Use o Embedded Signup em Configurações > WhatsApp."
        );
        setStatus("error");
      }
    } catch (err: any) {
      console.error("Erro ao gerar QR:", err);
      setErrorMessage(err.message || "Erro ao gerar QR Code");
      setStatus("error");
    }
  }, [integracao, selectedUnidadeId]);

  // Verificar status da conexão
  const handleCheckStatus = useCallback(async () => {
    try {
      if (!integracao) return;

      if (integracao.provedor === "evolution") {
        const { data } = await supabase.functions.invoke("evolution-proxy", {
          body: {
            action: "status",
            instance_id: integracao.instance_id,
            unidade_id: selectedUnidadeId,
          },
        });

        if (data?.instance?.state === "open") {
          setStatus("connected");
          setPhoneNumber(data.instance?.phoneNumber || integracao.numero_telefone || "");

          await supabase
            .from("integracoes_whatsapp")
            .update({ status_conexao: "conectado" })
            .eq("id", integracao.id);

          toast.success("WhatsApp conectado!");
        }
      }
    } catch (err) {
      console.error("Erro ao verificar status:", err);
    }
  }, [integracao, selectedUnidadeId]);

  // Ir para o chat
  const handleGoToChat = () => {
    navigate("/chat");
  };

  // Ir para configurações
  const handleGoToConfig = () => {
    navigate("/integracoes?open=whatsapp");
  };

  return (
    <MainLayout>
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <MessageCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl">Conectar WhatsApp Web</CardTitle>
            <CardDescription>
              Escaneie o QR Code com seu celular para conectar o WhatsApp
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Status Badge */}
            <div className="flex justify-center">
              <StatusBadge status={status} phoneNumber={phoneNumber} provedor={provedor} />
            </div>

            {/* Seletor de Unidade */}
            {unidades && unidades.length > 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Unidade</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={selectedUnidadeId}
                  onChange={(e) => setSelectedUnidadeId(e.target.value)}
                >
                  {unidades.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* QR Code Display */}
            {status === "qr_ready" && qrCode && (
              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-white rounded-xl border-2 border-green-200 shadow-sm">
                  <img
                    src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR Code WhatsApp"
                    className="w-64 h-64 object-contain"
                  />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Abra o WhatsApp no celular → Menu (⋮) → Aparelhos conectados → Conectar
                  </p>
                  <p className="text-xs text-muted-foreground">
                    O QR Code expira em 5 minutos
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleGenerateQR}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Novo QR
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCheckStatus}>
                    <Wifi className="h-4 w-4 mr-1" />
                    Verificar
                  </Button>
                </div>
              </div>
            )}

            {/* Loading */}
            {status === "loading" && (
              <div className="flex flex-col items-center space-y-4 py-8">
                <Loader2 className="h-12 w-12 animate-spin text-green-600" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            )}

            {/* Connected */}
            {status === "connected" && (
              <div className="flex flex-col items-center space-y-4 py-4">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-green-700">WhatsApp Conectado!</p>
                  {phoneNumber && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <Smartphone className="h-3 w-3 inline mr-1" />
                      {phoneNumber}
                    </p>
                  )}
                </div>
                <Button onClick={handleGoToChat} className="bg-green-600 hover:bg-green-700">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Abrir Inbox WhatsApp
                </Button>
              </div>
            )}

            {/* Error */}
            {status === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* Expired */}
            {status === "expired" && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  QR Code expirado. Clique em "Gerar QR Code" para um novo.
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            {(status === "idle" || status === "error" || status === "expired") && (
              <div className="flex flex-col items-center space-y-3">
                <Button
                  onClick={handleGenerateQR}
                  className="w-full max-w-xs bg-green-600 hover:bg-green-700"
                  disabled={!integracao}
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  Gerar QR Code
                </Button>

                {!integracao && (
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Nenhuma integração WhatsApp configurada.
                    </p>
                    <Button variant="link" size="sm" onClick={handleGoToConfig}>
                      Configurar WhatsApp →
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Instructions */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium mb-3">Como conectar:</h4>
              <ol className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="bg-green-100 text-green-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    1
                  </span>
                  Clique em "Gerar QR Code" acima
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-green-100 text-green-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    2
                  </span>
                  No celular, abra WhatsApp → Menu (⋮) → Aparelhos conectados
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-green-100 text-green-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    3
                  </span>
                  Toque em "Conectar um aparelho" e escaneie o QR Code
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-green-100 text-green-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    4
                  </span>
                  Pronto! A BIA começará a atender automaticamente
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

// ========== Sub-components ==========

function StatusBadge({
  status,
  phoneNumber,
  provedor,
}: {
  status: ConnectionStatus;
  phoneNumber: string;
  provedor: string;
}) {
  const configs: Record<ConnectionStatus, { icon: any; label: string; variant: string }> = {
    idle: { icon: WifiOff, label: "Desconectado", variant: "secondary" },
    loading: { icon: Loader2, label: "Gerando...", variant: "outline" },
    qr_ready: { icon: QrCode, label: "Aguardando scan", variant: "outline" },
    connecting: { icon: Loader2, label: "Conectando...", variant: "outline" },
    connected: { icon: Wifi, label: "Conectado", variant: "default" },
    error: { icon: AlertCircle, label: "Erro", variant: "destructive" },
    expired: { icon: AlertCircle, label: "Expirado", variant: "secondary" },
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant as any} className="px-3 py-1 text-sm">
      <Icon className={`h-3 w-3 mr-1.5 ${status === "loading" || status === "connecting" ? "animate-spin" : ""}`} />
      {config.label}
      {provedor && status !== "error" && (
        <span className="ml-1.5 opacity-60">({provedor})</span>
      )}
    </Badge>
  );
}

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Smartphone, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface QRCodeSession {
  id: string;
  qrCode: string;
  status: "pending" | "authenticated" | "expired";
  deviceName?: string;
}

export default function QRCodeLogin() {
  const [session, setSession] = useState<QRCodeSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "scanning" | "authenticated">(
    "idle"
  );
  const [qrImage, setQrImage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Gerar novo QR Code
  const generateQRCode = async () => {
    setLoading(true);
    try {
      // Chamar endpoint para gerar QR Code
      const response = await fetch("/api/auth/qrcode/generate", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Erro ao gerar QR Code");
      }

      const data = await response.json();
      setSession(data.session);
      setQrImage(data.qrImage);
      setStatus("scanning");

      // Conectar WebSocket para monitorar autenticação
      connectWebSocket(data.session.id);

      toast.success("QR Code gerado! Escaneie com seu celular.");
    } catch (error) {
      console.error("Erro ao gerar QR Code:", error);
      toast.error("Erro ao gerar QR Code");
    } finally {
      setLoading(false);
    }
  };

  // Conectar WebSocket
  const connectWebSocket = (sessionId: string) => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/api/auth/qrcode/ws?session=${sessionId}`
    );

    ws.onopen = () => {
      console.log("WebSocket conectado");
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "qr_scanned":
          setStatus("scanning");
          toast.info("QR Code escaneado! Aguarde confirmação...");
          break;

        case "authentication_success":
          setStatus("authenticated");
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  status: "authenticated",
                  deviceName: message.payload?.deviceName,
                }
              : null
          );
          toast.success("Autenticado com sucesso!");

          // Redirecionar após 2 segundos
          setTimeout(() => {
            window.location.href = "/dashboard";
          }, 2000);
          break;

        case "authentication_failed":
          setStatus("idle");
          toast.error(message.error || "Falha na autenticação");
          break;

        case "session_expired":
          setStatus("idle");
          toast.error("QR Code expirou. Gere um novo.");
          break;
      }
    };

    ws.onerror = (error) => {
      console.error("Erro WebSocket:", error);
      toast.error("Erro de conexão");
    };

    ws.onclose = () => {
      console.log("WebSocket desconectado");
    };

    wsRef.current = ws;
  };

  // Limpar WebSocket ao desmontar
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-info to-info flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">GásFácil</h1>
          <p className="text-gray-600">Autenticação via QR Code</p>
        </div>

        {/* Card Principal */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Escaneie com seu Celular
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* QR Code */}
            {qrImage ? (
              <div className="flex flex-col items-center space-y-4">
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                  <img
                    src={qrImage}
                    alt="QR Code"
                    className="w-64 h-64 object-contain"
                  />
                </div>

                {/* Status */}
                <div className="w-full">
                  {status === "scanning" && (
                    <div className="flex items-center justify-center gap-2 text-info bg-info/10 p-3 rounded-lg">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm font-medium">
                        Aguardando escaneamento...
                      </span>
                    </div>
                  )}

                  {status === "authenticated" && (
                    <div className="flex items-center justify-center gap-2 text-success bg-success/10 p-3 rounded-lg">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Autenticado com sucesso!
                      </span>
                    </div>
                  )}
                </div>

                {/* Informações */}
                <div className="w-full text-center text-sm text-gray-600 space-y-2">
                  <p>
                    <strong>Sessão:</strong> {session?.id.slice(0, 8)}...
                  </p>
                  {session?.deviceName && (
                    <p>
                      <strong>Dispositivo:</strong> {session.deviceName}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    O QR Code expira em 5 minutos
                  </p>
                </div>

                {/* Botão de Gerar Novo */}
                <Button
                  variant="outline"
                  onClick={generateQRCode}
                  disabled={loading || status === "authenticated"}
                  className="w-full"
                >
                  Gerar Novo QR Code
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <div className="w-64 h-64 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                  <div className="text-center">
                    <Smartphone className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">
                      Clique em "Gerar QR Code" para começar
                    </p>
                  </div>
                </div>

                <Button
                  onClick={generateQRCode}
                  disabled={loading}
                  className="w-full bg-info hover:bg-info"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    "Gerar QR Code"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instruções */}
        <Card className="bg-info border-info">
          <CardContent className="pt-6">
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-info text-white flex items-center justify-center text-xs font-bold">
                  1
                </div>
                <p>Clique em "Gerar QR Code"</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-info text-white flex items-center justify-center text-xs font-bold">
                  2
                </div>
                <p>Abra a câmera do seu celular</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-info text-white flex items-center justify-center text-xs font-bold">
                  3
                </div>
                <p>Aponte para o QR Code</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-info text-white flex items-center justify-center text-xs font-bold">
                  4
                </div>
                <p>Confirme a autenticação no seu celular</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Aviso de Segurança */}
        <div className="flex gap-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            Nunca compartilhe seu QR Code com outras pessoas. Cada código é
            único e pessoal.
          </p>
        </div>

        {/* Link de Login Alternativo */}
        <div className="text-center text-sm">
          <p className="text-gray-600">
            Prefere fazer login tradicional?{" "}
            <a href="/login" className="text-info hover:underline font-medium">
              Clique aqui
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

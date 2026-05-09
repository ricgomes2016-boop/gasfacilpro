import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Loader2, MessageCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function WhatsAppWebLogin() {
  const [sessionId, setSessionId] = useState<string>("");
  const [qrCode, setQrCode] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "generating" | "waiting" | "connected" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");

  // Gerar novo QR Code
  const handleGenerateQR = async () => {
    try {
      setStatus("generating");
      setErrorMessage("");

      // Simular geração de QR Code
      const newSessionId = `session_${Date.now()}`;
      setSessionId(newSessionId);

      // Simular delay de geração
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Gerar QR Code simulado
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=gasfacil-whatsapp-${newSessionId}`;
      setQrCode(qrCodeUrl);
      setStatus("waiting");

      // Simular espera por escaneamento (em produção, seria WebSocket)
      setTimeout(() => {
        handleSimulateConnection();
      }, 5000);
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Erro ao gerar QR Code");
    }
  };

  // Simular conexão bem-sucedida
  const handleSimulateConnection = () => {
    setPhoneNumber("55 43 99999-9999");
    setStatus("connected");
  };

  // Confirmar e prosseguir
  const handleConfirm = () => {
    if (status === "connected") {
      // Redirecionar para dashboard
      window.location.href = "/whatsapp";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 p-4 rounded-full">
                <MessageCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">WhatsApp Web</h1>
            <p className="text-gray-600 mt-2">Conecte seu WhatsApp ao GasFácil</p>
          </div>

          {/* QR Code Section */}
          {status !== "connected" && (
            <div className="mb-6">
              {status === "idle" && (
                <div className="text-center">
                  <p className="text-gray-600 mb-4">
                    Clique no botão abaixo para gerar um QR Code e conectar seu WhatsApp
                  </p>
                  <Button
                    onClick={handleGenerateQR}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    Gerar QR Code
                  </Button>
                </div>
              )}

              {status === "generating" && (
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Gerando QR Code...</p>
                </div>
              )}

              {status === "waiting" && qrCode && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg border-2 border-green-200 flex justify-center">
                    <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      📱 <strong>Abra o WhatsApp no seu celular</strong> e aponte a câmera para o QR Code acima
                    </p>
                  </div>
                  <p className="text-center text-sm text-gray-500">Aguardando escaneamento...</p>
                </div>
              )}

              {status === "error" && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Connected Section */}
          {status === "connected" && (
            <div className="space-y-4">
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-center">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-green-900 mb-2">Conectado com Sucesso!</h2>
                <p className="text-green-700 text-sm mb-3">Número: {phoneNumber}</p>
                <p className="text-green-600 text-xs">
                  Seu WhatsApp está sincronizado com o GasFácil
                </p>
              </div>

              <Button
                onClick={handleConfirm}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                Ir para Dashboard
              </Button>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              ✓ Sua conexão é segura e criptografada
            </p>
            <p className="text-xs text-gray-500 text-center mt-2">
              Você pode desconectar a qualquer momento nas configurações
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

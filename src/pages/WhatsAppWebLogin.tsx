import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Loader2, MessageCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/contexts/AuthContext";

export default function WhatsAppWebLogin() {
  const { empresaSelecionada } = useEmpresa();
  const { user } = useAuth();
  
  const [sessionId, setSessionId] = useState<string>("");
  const [qrCode, setQrCode] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "generating" | "waiting" | "connected" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");

  // Gerar novo QR Code
  const handleGenerateQR = async () => {
    try {
      if (!empresaSelecionada?.id) {
        setErrorMessage("Empresa não selecionada");
        setStatus("error");
        return;
      }

      setStatus("generating");
      setErrorMessage("");

      // Criar session ID único para esta empresa
      const newSessionId = `session_${empresaSelecionada.id}_${Date.now()}`;
      setSessionId(newSessionId);

      // Simular delay de geração
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Gerar QR Code usando API QR Server
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=gasfacil-whatsapp-${newSessionId}`;
      setQrCode(qrCodeUrl);
      setStatus("waiting");

      // Simular espera por escaneamento (em produção, seria WebSocket)
      // Timeout de 5 minutos
      const timeoutId = setTimeout(() => {
        if (status === "waiting") {
          setStatus("error");
          setErrorMessage("QR Code expirou. Gere um novo.");
        }
      }, 300000);

      // Simular conexão bem-sucedida após 5 segundos (para teste)
      setTimeout(() => {
        if (status === "waiting") {
          handleSimulateConnection();
          clearTimeout(timeoutId);
        }
      }, 5000);

      return () => clearTimeout(timeoutId);
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Erro ao gerar QR Code");
    }
  };

  // Simular conexão bem-sucedida
  const handleSimulateConnection = () => {
    // Em produção, isso viria do servidor após validação
    setPhoneNumber("55 43 99999-9999");
    setStatus("connected");
  };

  // Confirmar e prosseguir
  const handleConfirm = () => {
    if (status === "connected" && empresaSelecionada?.id) {
      // Salvar sessão no localStorage para referência
      localStorage.setItem(`whatsapp_session_${empresaSelecionada.id}`, sessionId);
      localStorage.setItem(`whatsapp_phone_${empresaSelecionada.id}`, phoneNumber);
      
      // Redirecionar para dashboard
      window.location.href = "/whatsapp/web";
    }
  };

  // Desconectar
  const handleDisconnect = () => {
    if (empresaSelecionada?.id) {
      localStorage.removeItem(`whatsapp_session_${empresaSelecionada.id}`);
      localStorage.removeItem(`whatsapp_phone_${empresaSelecionada.id}`);
    }
    setSessionId("");
    setQrCode("");
    setStatus("idle");
    setPhoneNumber("");
    setErrorMessage("");
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
            {empresaSelecionada && (
              <p className="text-sm text-gray-500 mt-2">Empresa: {empresaSelecionada.nome}</p>
            )}
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
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Gerar QR Code
                  </Button>
                </div>
              )}

              {status === "generating" && (
                <div className="text-center">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-green-600" />
                  <p className="text-gray-600">Gerando QR Code...</p>
                </div>
              )}

              {status === "waiting" && qrCode && (
                <div className="text-center">
                  <p className="text-gray-600 mb-4">Escaneie este QR Code com seu WhatsApp</p>
                  <div className="bg-white p-4 rounded-lg mb-4 inline-block border-2 border-green-200">
                    <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Aguardando escaneamento... (Expira em 5 minutos)
                  </p>
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-green-600" />
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
            <div className="mb-6">
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center mb-4">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <p className="text-gray-900 font-semibold mb-2">Conectado com sucesso!</p>
                <p className="text-gray-600 text-sm mb-4">Número: {phoneNumber}</p>
                <p className="text-gray-500 text-xs">
                  Sua sessão está ativa para a empresa {empresaSelecionada?.nome}
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={handleConfirm}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Ir para Dashboard
                </Button>
                <Button
                  onClick={handleDisconnect}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  Desconectar
                </Button>
              </div>
            </div>
          )}

          {/* Info Box */}
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">
              Cada empresa tem sua própria sessão do WhatsApp. Você pode conectar múltiplos números para diferentes empresas.
            </AlertDescription>
          </Alert>
        </div>
      </Card>
    </div>
  );
}

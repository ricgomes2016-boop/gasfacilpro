import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

export default function QRCodeScanner() {
  const [scanning, setScanning] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Iniciar câmera
  const startCamera = async () => {
    try {
      setScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      console.error("Erro ao acessar câmera:", error);
      toast.error("Não foi possível acessar a câmera do dispositivo");
      setScanning(false);
    }
  };

  // Parar câmera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  // Capturar frame e processar
  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext("2d");
    if (!context) return;

    context.drawImage(
      videoRef.current,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    // Em produção, usar biblioteca jsQR ou similar
    // Este é um exemplo simplificado
    const imageData = context.getImageData(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    // Simular detecção de QR Code
    // Em produção, processar com jsQR
    console.log("Frame capturado para análise de QR Code");
  };

  // Processar QR Code escaneado
  const handleQRCodeScanned = async (qrData: string) => {
    try {
      setLoading(true);

      // Validar formato do QR Code
      if (!qrData.startsWith("gasfacil://auth")) {
        toast.error("QR Code inválido");
        return;
      }

      // Extrair parâmetros
      const url = new URL(qrData);
      const sessionId = url.searchParams.get("session");
      const token = url.searchParams.get("token");

      if (!sessionId || !token) {
        toast.error("QR Code incompleto");
        return;
      }

      // Enviar autenticação
      const response = await fetch("/api/auth/qrcode/authenticate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          token,
          deviceName: deviceName || "Dispositivo Móvel",
        }),
      });

      if (!response.ok) {
        throw new Error("Falha na autenticação");
      }

      const data = await response.json();

      setAuthenticated(true);
      toast.success("Autenticado com sucesso!");

      // Redirecionar após 2 segundos
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 2000);
    } catch (error) {
      console.error("Erro ao autenticar:", error);
      toast.error("Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  // Simular escaneamento (para testes)
  const simulateScan = () => {
    handleQRCodeScanned(
      "gasfacil://auth?session=abc123&token=def456"
    );
  };

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-info to-info flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">GásFácil</h1>
          <p className="text-gray-600">Autenticação via QR Code</p>
        </div>

        {/* Card Principal */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Escaneie o QR Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {authenticated ? (
              // Estado Autenticado
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-success flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    Autenticado com Sucesso!
                  </h3>
                  <p className="text-sm text-gray-600">
                    Você será redirecionado em breve...
                  </p>
                </div>
                <div className="w-full">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-info" />
                </div>
              </div>
            ) : scanning ? (
              // Estado Escaneando
              <div className="space-y-4">
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-64 object-cover"
                  />
                  <canvas
                    ref={canvasRef}
                    width={320}
                    height={320}
                    className="hidden"
                  />

                  {/* Overlay com guia */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-info rounded-lg"></div>
                  </div>

                  {/* Fechar */}
                  <button
                    onClick={stopCamera}
                    className="absolute top-4 right-4 bg-destructive text-white p-2 rounded-full hover:bg-destructive"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-center text-sm text-gray-600">
                  <p>Aponte a câmera para o QR Code</p>
                </div>

                <Button
                  variant="outline"
                  onClick={captureFrame}
                  className="w-full"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Capturar
                </Button>

                {/* Botão de teste */}
                <Button
                  variant="secondary"
                  onClick={simulateScan}
                  className="w-full text-xs"
                >
                  Simular Escaneamento (Teste)
                </Button>
              </div>
            ) : (
              // Estado Inicial
              <div className="flex flex-col items-center space-y-4">
                <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                  <Camera className="w-12 h-12 text-gray-400" />
                </div>

                <div className="text-center">
                  <p className="text-gray-600 text-sm mb-4">
                    Clique em "Iniciar Câmera" para escanear o QR Code
                  </p>
                </div>

                <Button
                  onClick={startCamera}
                  disabled={loading}
                  className="w-full bg-info hover:bg-info"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 mr-2" />
                      Iniciar Câmera
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Nome do Dispositivo */}
            {!scanning && !authenticated && (
              <div className="space-y-2">
                <Label htmlFor="deviceName">Nome do Dispositivo</Label>
                <Input
                  id="deviceName"
                  placeholder="Ex: Meu Celular"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="text-sm"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dicas */}
        <Card className="bg-info border-info">
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <Badge className="bg-info flex-shrink-0">💡</Badge>
                <p>Certifique-se de que a câmera está bem iluminada</p>
              </div>
              <div className="flex gap-2">
                <Badge className="bg-info flex-shrink-0">💡</Badge>
                <p>Mantenha o QR Code dentro do quadrado de guia</p>
              </div>
              <div className="flex gap-2">
                <Badge className="bg-info flex-shrink-0">💡</Badge>
                <p>Não muito perto, não muito longe</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Aviso */}
        <div className="flex gap-2 text-xs text-warning bg-warning p-3 rounded-lg border border-warning">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            Apenas escaneie QR Codes que você confia. Não escaneie códigos de
            fontes desconhecidas.
          </p>
        </div>
      </div>
    </div>
  );
}

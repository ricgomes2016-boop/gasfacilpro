import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, RefreshCw } from "lucide-react";

interface QRCodeScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
}

export function QRCodeScanner({ onScan, onError }: QRCodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startScanning = async () => {
    if (!containerRef.current) return;

    try {
      setError(null);
      
      // Create scanner instance
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      // Get available cameras
      const cameras = await Html5Qrcode.getCameras();
      
      if (cameras.length === 0) {
        throw new Error("Nenhuma câmera encontrada no dispositivo");
      }

      // Prefer back camera on mobile devices
      const backCamera = cameras.find(
        (camera) =>
          camera.label.toLowerCase().includes("back") ||
          camera.label.toLowerCase().includes("traseira") ||
          camera.label.toLowerCase().includes("rear")
      );
      const cameraId = backCamera?.id || cameras[0].id;

      await scanner.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          // Successfully scanned
          stopScanning();
          onScan(decodedText);
        },
        () => {
          // QR code not found in frame - this is expected during scanning
        }
      );

      setIsScanning(true);
      setHasPermission(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Erro ao acessar a câmera";
      
      if (errorMessage.includes("Permission") || errorMessage.includes("permission")) {
        setHasPermission(false);
        setError("Permissão de câmera negada. Por favor, permita o acesso à câmera nas configurações do navegador.");
      } else {
        setError(errorMessage);
      }
      
      onError?.(errorMessage);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // Ignore errors when stopping
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        id="qr-reader"
        className="w-full aspect-square bg-muted rounded-lg overflow-hidden relative"
      >
        {!isScanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            {error ? (
              <>
                <CameraOff className="h-16 w-16 text-destructive mb-4" />
                <p className="text-sm text-destructive text-center">{error}</p>
              </>
            ) : hasPermission === false ? (
              <>
                <CameraOff className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground text-center">
                  Permissão de câmera necessária para escanear QR Codes
                </p>
              </>
            ) : (
              <>
                <Camera className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground text-center">
                  Posicione o QR Code na câmera
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <Button
        onClick={isScanning ? stopScanning : startScanning}
        className={`w-full ${isScanning ? "" : "gradient-primary text-white"}`}
        variant={isScanning ? "outline" : "photo"}
      >
        {isScanning ? (
          <>
            <CameraOff className="h-4 w-4 mr-2" />
            Parar Câmera
          </>
        ) : (
          <>
            <Camera className="h-4 w-4 mr-2" />
            {error ? "Tentar Novamente" : "Iniciar Câmera"}
          </>
        )}
      </Button>

      {hasPermission === false && (
        <Button
          variant="ghost"
          onClick={startScanning}
          className="w-full text-muted-foreground"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

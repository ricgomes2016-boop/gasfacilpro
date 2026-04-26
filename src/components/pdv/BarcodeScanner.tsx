import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  isActive: boolean;
  onToggle: () => void;
  hideToggle?: boolean;
}

export function BarcodeScanner({ onScan, isActive, onToggle, hideToggle }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // Ignore errors when stopping
      }
      scannerRef.current = null;
    }
  }, []);

  const startScanning = useCallback(async () => {
    try {
      setError(null);
      
      const scanner = new Html5Qrcode("barcode-reader");
      scannerRef.current = scanner;

      const cameras = await Html5Qrcode.getCameras();
      
      if (cameras.length === 0) {
        throw new Error("Nenhuma câmera encontrada");
      }

      // Prefer back camera
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
          qrbox: { width: 280, height: 100 },
          aspectRatio: 2.5,
        },
        (decodedText) => {
          // Debounce repeated scans
          const now = Date.now();
          if (decodedText === lastScanRef.current && now - lastScanTimeRef.current < 2000) {
            return;
          }
          lastScanRef.current = decodedText;
          lastScanTimeRef.current = now;
          onScan(decodedText);
        },
        () => {
          // QR code not found - expected during scanning
        }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao acessar câmera";
      setError(errorMessage);
    }
  }, [onScan]);

  useEffect(() => {
    if (isActive) {
      startScanning();
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isActive, startScanning, stopScanning]);

  return (
    <div className="space-y-2">
      {!hideToggle && (
        <div className="flex items-center gap-2">
          <Button
            variant={isActive ? "destructive" : "photo"}
            size="sm"
            onClick={onToggle}
            className="gap-2"
          >
            {isActive ? (
              <>
                <CameraOff className="h-4 w-4" />
                Parar Scanner
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" />
                Ler Código de Barras
              </>
            )}
          </Button>
          {error && (
            <span className="text-xs text-destructive">{error}</span>
          )}
        </div>
      )}
      {hideToggle && error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
      
      {isActive && (
        <div
          id="barcode-reader"
          className="w-full max-w-md h-32 bg-muted rounded-lg overflow-hidden mx-auto"
        />
      )}
    </div>
  );
}

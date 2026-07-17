import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Loader2, Wifi, WifiOff } from "lucide-react";

interface QrEvolutionDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  qrInstanceName: string;
  qrLoading: boolean;
  qrStatus: string | null;
  qrCodeData: string | null;
  whatsappConfigs: any[];
  onRetry: (cfg: any) => void;
}

export function QrEvolutionDialog({
  open, onOpenChange, qrInstanceName, qrLoading, qrStatus, qrCodeData, whatsappConfigs, onRetry,
}: QrEvolutionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <QrCode className="h-6 w-6 text-primary" />
            Conectar WhatsApp
          </DialogTitle>
          <DialogDescription className="font-medium">
            Vincule seu aparelho para ativar as mensagens automáticas da instância <strong>{qrInstanceName}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-6">
          {qrLoading ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm font-semibold animate-pulse">Gerando link seguro...</p>
            </div>
          ) : qrStatus === "connected" ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="bg-success/10 p-4 rounded-full">
                <Wifi className="h-10 w-10 text-success" />
              </div>
              <p className="text-lg font-bold text-success">Conectado com Sucesso!</p>
              <p className="text-sm text-muted-foreground">Sua unidade já está enviando mensagens.</p>
            </div>
          ) : qrCodeData ? (
            <div className="flex flex-col items-center gap-6 w-full">
              <div className="p-4 bg-background rounded-3xl shadow-2xl ring-8 ring-primary/5 border-2 border-primary/10">
                <img
                  src={qrCodeData.startsWith("data:") ? qrCodeData : `data:image/png;base64,${qrCodeData}`}
                  alt="QR Code WhatsApp"
                  className="w-56 h-56"
                />
              </div>
              <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 text-center w-full space-y-2">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Instruções de Pareamento</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  1. Abra o <strong>WhatsApp</strong> no seu celular<br/>
                  2. Toque em <strong>Aparelhos Conectados</strong><br/>
                  3. Toque em <strong>Conectar um aparelho</strong> e aponte a câmera.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <WifiOff className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">QR Code não disponível</p>
              <Button variant="outline" size="sm" onClick={() => {
                const cfg = whatsappConfigs.find(c => c.instance_id === qrInstanceName);
                if (cfg) onRetry(cfg);
              }}>
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

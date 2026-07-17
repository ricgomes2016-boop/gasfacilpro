import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QrCode, Loader2 } from "lucide-react";

interface CoexQrDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  coexQrCode: string | null;
  coexQrCountdown: number;
}

export function CoexQrDialog({ open, onOpenChange, coexQrCode, coexQrCountdown }: CoexQrDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-xl font-bold">
            <QrCode className="h-6 w-6 text-success" />
            QR Code — Coexistência
          </DialogTitle>
          <DialogDescription>
            Abra o WhatsApp no celular, vá em <strong>Configurações → Aparelhos Conectados</strong> e escaneie o código abaixo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {coexQrCode ? (
            <>
              <div className="relative">
                <img
                  src={coexQrCode}
                  alt="QR Code Coexistência"
                  className="w-64 h-64 rounded-xl border-4 border-success shadow-lg"
                />
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-success text-white text-xs px-3 py-1 rounded-full whitespace-nowrap">
                  Escaneie com o WhatsApp
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
                <Loader2 className="h-4 w-4 animate-spin text-warning" />
                Aguardando conexão... expira em {coexQrCountdown}s
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-[220px]">
                Após escanear, aguarde a confirmação. Não feche esta janela.
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-success border-t-green-500 animate-spin" />
                <QrCode className="h-6 w-6 text-success absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <span className="text-sm text-muted-foreground">Gerando QR Code...</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Printer, Download, X } from "lucide-react";
import { useRef } from "react";

interface ValeGasQRCodeProps {
  open: boolean;
  onClose: () => void;
  vale: {
    numero: number;
    codigo: string;
    valor: number;
    parceiroNome?: string;
  };
}

export function ValeGasQRCode({ open, onClose, vale }: ValeGasQRCodeProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const escapeHtml = (str: string | number): string => {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Vale Gás Nº ${vale.numero}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              min-height: 100vh;
              padding: 20px;
            }
            .vale-card {
              border: 2px solid #000;
              border-radius: 12px;
              padding: 24px;
              width: 300px;
              text-align: center;
            }
            .logo { font-size: 24px; font-weight: bold; margin-bottom: 16px; color: #2fc2b5; }
            .qr-container { margin: 16px 0; }
            .numero { font-size: 28px; font-weight: bold; margin: 8px 0; }
            .codigo { font-family: monospace; font-size: 12px; color: #666; margin-bottom: 12px; }
            .valor { font-size: 32px; font-weight: bold; color: #16a34a; margin: 12px 0; }
            .parceiro { font-size: 14px; color: #666; margin-top: 8px; }
            .instrucao { font-size: 11px; color: #999; margin-top: 16px; border-top: 1px dashed #ccc; padding-top: 12px; }
            @media print {
              body { margin: 0; }
              .vale-card { border: 2px solid #000; }
            }
          </style>
        </head>
        <body>
          <div class="vale-card">
            <div class="logo">🔥 Gas Express25</div>
            <div class="qr-container">
              ${printContent.querySelector("svg")?.outerHTML || ""}
            </div>
            <div class="numero">Vale Nº ${escapeHtml(vale.numero)}</div>
            <div class="codigo">${escapeHtml(vale.codigo)}</div>
            <div class="valor">R$ ${escapeHtml(vale.valor.toFixed(2))}</div>
            ${vale.parceiroNome ? `<div class="parceiro">${escapeHtml(vale.parceiroNome)}</div>` : ""}
            <div class="instrucao">
              Apresente este QR Code ao entregador para validar seu vale gás.
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownload = () => {
    const svg = printRef.current?.querySelector("svg");
    if (!svg) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      const link = document.createElement("a");
      link.download = `vale-gas-${vale.numero}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">QR Code do Vale</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center py-4">
          <div 
            ref={printRef}
            className="bg-white p-6 rounded-xl border-2 border-dashed border-muted-foreground/30"
          >
            <div className="text-center mb-4">
              <p className="text-lg font-bold text-primary">🔥 Gas Express25</p>
            </div>
            
            <QRCodeSVG
              value={vale.codigo}
              size={200}
              level="H"
              includeMargin
              className="mx-auto"
            />
            
            <div className="text-center mt-4 space-y-1">
              <p className="text-2xl font-bold">Vale Nº {vale.numero}</p>
              <p className="font-mono text-xs text-muted-foreground">{vale.codigo}</p>
              <p className="text-3xl font-bold text-success mt-2">
                R$ {vale.valor.toFixed(2)}
              </p>
              {vale.parceiroNome && (
                <p className="text-sm text-muted-foreground">{vale.parceiroNome}</p>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4 max-w-[250px]">
            Apresente este QR Code ao entregador para validar seu vale gás.
          </p>

          <div className="flex gap-2 mt-6 w-full">
            <Button onClick={handlePrint} className="flex-1 gap-2">
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
            <Button onClick={handleDownload} variant="outline" className="flex-1 gap-2">
              <Download className="h-4 w-4" />
              Baixar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

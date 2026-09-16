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
import html2canvas from "html2canvas";
import { obterApresentacaoVale } from "@/lib/vales/apresentacaoVale";

interface ValeGasQRCodeProps {
  open: boolean;
  onClose: () => void;
  vale: {
    numero: number;
    codigo: string;
    valor: number;
    parceiroNome?: string;
    produtoNome?: string | null;
    descricao?: string | null;
    numeroEmpenho?: string | null;
  };
  empresa?: { nome: string; telefone?: string | null; endereco?: string | null };
}

export function ValeGasQRCode({ open, onClose, vale, empresa: empresaProp }: ValeGasQRCodeProps) {
  const empresa = empresaProp ?? { nome: "", telefone: null, endereco: null };
  const printRef = useRef<HTMLDivElement>(null);
  const apresentacao = obterApresentacaoVale(vale.produtoNome, vale.descricao);


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
          <title>${escapeHtml(apresentacao.titulo)} Nº ${vale.numero}</title>
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
            .empresa { font-size: 15px; font-weight: 800; color: #0f766e; text-transform: uppercase; }
            .contato { min-height: 28px; margin-top: 4px; font-size: 9px; color: #64748b; line-height: 1.3; }
            .logo { font-size: 20px; font-weight: 800; margin: 8px 0; color: #172033; }
            .qr-container { margin: 16px 0; }
            .numero { font-size: 28px; font-weight: bold; margin: 8px 0; }
            .codigo { font-family: monospace; font-size: 12px; color: #666; margin-bottom: 12px; }
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
            <div class="empresa">${escapeHtml(empresa.nome)}</div>
            <div class="contato">${empresa.telefone ? `Telefone: ${escapeHtml(empresa.telefone)}<br>` : ""}${empresa.endereco ? escapeHtml(empresa.endereco) : ""}</div>
            <div class="logo">${escapeHtml(apresentacao.titulo)}</div>
            <div class="qr-container">
              ${printContent.querySelector("svg")?.outerHTML || ""}
            </div>
            <div class="numero">Vale Nº ${escapeHtml(vale.numero)}</div>
            <div class="codigo">${escapeHtml(vale.codigo)}</div>
            ${vale.parceiroNome ? `<div class="parceiro">${escapeHtml(vale.parceiroNome)}</div>` : ""}
            ${vale.produtoNome ? `<div class="parceiro">Produto: ${escapeHtml(vale.produtoNome)}</div>` : ""}
            ${vale.numeroEmpenho ? `<div class="parceiro"><strong>Empenho:</strong> ${escapeHtml(vale.numeroEmpenho)}</div>` : ""}
            <div class="instrucao">
              Apresente este QR Code ao entregador para validar este vale.
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

  const handleDownload = async () => {
    if (!printRef.current) return;
    const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const link = document.createElement("a");
    link.download = `${apresentacao.nomeArquivo}-${vale.numero}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
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
              <p className="text-sm font-extrabold uppercase text-primary">{empresa.nome}</p>
              <p className="text-[9px] leading-tight text-muted-foreground">
                {empresa.telefone && <>Telefone: {empresa.telefone}<br /></>}
                {empresa.endereco}
              </p>
              <p className="mt-2 text-lg font-extrabold text-foreground">{apresentacao.titulo}</p>
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
              {vale.parceiroNome && (
                <p className="text-sm text-muted-foreground">{vale.parceiroNome}</p>
              )}
              {vale.produtoNome && <p className="text-sm text-muted-foreground">Produto: {vale.produtoNome}</p>}
              {vale.numeroEmpenho && <p className="text-sm font-semibold text-foreground">Empenho: {vale.numeroEmpenho}</p>}
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4 max-w-[250px]">
            Apresente este QR Code ao entregador para validar este vale.
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

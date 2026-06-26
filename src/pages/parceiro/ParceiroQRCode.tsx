import { ParceiroLayout } from "@/components/parceiro/ParceiroLayout";
import { useParceiroDados } from "@/hooks/useParceiroDados";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download, Share2, QrCode, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRef } from "react";
import { esc } from "@/lib/escapeHtml";

export default function ParceiroQRCode() {
  const { parceiro, isLoading, disponiveis } = useParceiroDados();
  const qrRef = useRef<HTMLDivElement>(null);

  const baseUrl = window.location.origin;
  const link = parceiro ? `${baseUrl}/vale-gas/comprar/${parceiro.id}` : "";

  const copiarLink = () => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const compartilhar = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Vale Gás Digital",
          text: "Adquira seu Vale Gás!",
          url: link,
        });
      } catch {
        copiarLink();
      }
    } else {
      copiarLink();
    }
  };

  const baixarQRCode = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.download = `qrcode-vale-gas-${parceiro?.nome?.replace(/\s+/g, "-")}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const imprimirQRCode = () => {
    const svg = qrRef.current?.querySelector("svg")?.outerHTML || "";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><title>QR Code Vale Gás</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
        .card { border: 2px solid #000; border-radius: 16px; padding: 32px; text-align: center; width: 320px; }
        .logo { font-size: 24px; font-weight: bold; color: #2fc2b5; margin-bottom: 12px; }
        .qr { margin: 20px 0; }
        .name { font-size: 18px; font-weight: bold; margin: 12px 0 4px; }
        .sub { font-size: 12px; color: #666; }
        .info { font-size: 11px; color: #999; margin-top: 16px; border-top: 1px dashed #ccc; padding-top: 12px; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <div class="card">
        <div class="logo">🔥 Gas Express25</div>
        <div class="qr">${svg}</div>
        <div class="name">${esc(parceiro?.nome || "Parceiro")}</div>
        <div class="sub">Escaneie o QR Code para adquirir seu Vale Gás</div>
        <div class="info">Aponte a câmera do celular para o QR Code acima</div>
      </div>
      <script>window.onload=function(){window.print();window.close();}</script>
      </body></html>
    `);
    win.document.close();
  };

  if (isLoading) {
    return (
      <ParceiroLayout title="Meu QR Code">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ParceiroLayout>
    );
  }

  return (
    <ParceiroLayout title="Meu QR Code">
      <div className="p-4 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-5 w-5" /> QR Code de Venda
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Compartilhe este QR Code com seus clientes. Ao escanear, eles podem solicitar um Vale Gás diretamente.
            </p>

            <div
              ref={qrRef}
              className="bg-white p-6 rounded-2xl border-2 border-dashed border-muted-foreground/20 shadow-sm"
            >
              <QRCodeSVG
                value={link}
                size={220}
                level="H"
                includeMargin
                className="mx-auto"
              />
              <p className="text-center text-sm font-bold mt-3">{parceiro?.nome}</p>
              <p className="text-center text-xs text-muted-foreground">Escaneie para adquirir Vale Gás</p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 w-full">
              <p className="text-xs text-muted-foreground mb-1">Link direto:</p>
              <p className="text-xs font-mono break-all">{link}</p>
            </div>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">Vales disponíveis: </span>
              <span className="font-bold text-primary">{disponiveis.length}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full">
              <Button onClick={copiarLink} variant="outline" className="gap-2">
                <Copy className="h-4 w-4" /> Copiar Link
              </Button>
              <Button onClick={compartilhar} variant="outline" className="gap-2">
                <Share2 className="h-4 w-4" /> Compartilhar
              </Button>
              <Button onClick={baixarQRCode} variant="outline" className="gap-2">
                <Download className="h-4 w-4" /> Baixar PNG
              </Button>
              <Button onClick={imprimirQRCode} className="gap-2">
                <QrCode className="h-4 w-4" /> Imprimir
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ParceiroLayout>
  );
}

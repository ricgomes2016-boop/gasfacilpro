import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Download, Printer } from "lucide-react";
import { esc } from "@/lib/escapeHtml";

interface TerminalQRCodeDialogProps {
  open: boolean;
  onClose: () => void;
  terminalId: string;
}

export function TerminalQRCodeDialog({ open, onClose, terminalId }: TerminalQRCodeDialogProps) {
  const [terminal, setTerminal] = useState<{ nome: string; numero_serie: string | null } | null>(null);

  useEffect(() => {
    if (!open || !terminalId) return;
    (async () => {
      const { data } = await (supabase.from("terminais_cartao" as any).select("nome, numero_serie").eq("id", terminalId).maybeSingle() as any);
      if (data) setTerminal(data);
    })();
  }, [open, terminalId]);

  const qrValue = `terminal:${terminalId}`;

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=400,height=500");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>QR Code - ${esc(terminal?.nome || "Terminal")}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;}
      h2{margin-bottom:8px;}p{color:#666;margin:4px 0;}</style></head><body>
      <h2>${esc(terminal?.nome || "Terminal")}</h2>
      ${terminal?.numero_serie ? `<p>S/N: ${esc(terminal.numero_serie)}</p>` : ""}
      <div style="margin:20px 0;">${document.getElementById("terminal-qr-svg")?.innerHTML || ""}</div>
      <p style="font-size:11px;color:#999;">Escaneie com o app do entregador</p>
      <script>setTimeout(()=>window.print(),300)</script></body></html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-center">QR Code do Terminal</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {terminal && (
            <>
              <p className="font-semibold text-lg">{terminal.nome}</p>
              {terminal.numero_serie && (
                <p className="text-sm text-muted-foreground">S/N: {terminal.numero_serie}</p>
              )}
            </>
          )}
          <div id="terminal-qr-svg" className="p-4 bg-white rounded-xl">
            <QRCodeSVG value={qrValue} size={200} level="H" />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            O entregador escaneia este QR Code para vincular a maquininha à sua jornada.
          </p>
          <Button onClick={handlePrint} className="w-full gap-2">
            <Printer className="h-4 w-4" />
            Imprimir Etiqueta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

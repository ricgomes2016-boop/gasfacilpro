import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Printer, MessageCircle, XCircle, Clock, Truck, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PedidoFormatado } from "@/types/pedido";
import { esc } from "@/lib/escapeHtml";

interface PedidoViewDialogProps {
  pedido: PedidoFormatado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelar: (pedidoId: string) => void;
}

const statusConfig = {
  pendente: { label: "Pendente", variant: "secondary" as const, icon: Clock },
  em_rota: { label: "Em Rota", variant: "default" as const, icon: Truck },
  entregue: { label: "Entregue", variant: "outline" as const, icon: CheckCircle },
  cancelado: { label: "Cancelado", variant: "destructive" as const, icon: XCircle },
};

export function PedidoViewDialog({ pedido, open, onOpenChange, onCancelar }: PedidoViewDialogProps) {
  const { toast } = useToast();

  if (!pedido) return null;

  const config = statusConfig[pedido.status];
  const StatusIcon = config.icon;

  // Número de exibição: usa numero_sequencial quando disponível, com fallback para UUID curto
  const idCurto = pedido.numero_sequencial != null
    ? String(pedido.numero_sequencial)
    : pedido.id.substring(0, 8).toUpperCase();

  const handlePrint = () => {
    const itensHtml = pedido.itens
      .map((item) => `<div class="info">${item.quantidade}x ${esc(item.produto?.nome || 'Produto')} - R$ ${(item.preco_unitario * item.quantidade).toFixed(2)}</div>`)
      .join("");

    const printContent = `
      <html>
        <head>
          <title>Pedido #${esc(idCurto)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .info { margin: 10px 0; }
            .label { font-weight: bold; }
            .total { font-size: 18px; font-weight: bold; margin-top: 20px; }
            .separator { border-top: 1px dashed #ccc; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>PEDIDO #${esc(idCurto)}</h2>
            <p>${esc(pedido.data)}</p>
          </div>
          <div class="separator"></div>
          <div class="info"><span class="label">Cliente:</span> ${esc(pedido.cliente)}</div>
          <div class="info"><span class="label">Endereço:</span> ${esc(pedido.endereco)}</div>
          <div class="separator"></div>
          <div class="info"><span class="label">Itens:</span></div>
          ${itensHtml || `<div class="info">${esc(pedido.produtos)}</div>`}
          ${pedido.entregador ? `<div class="separator"></div><div class="info"><span class="label">Entregador:</span> ${esc(pedido.entregador)}</div>` : ''}
          ${pedido.observacoes ? `<div class="info"><span class="label">Obs:</span> ${esc(pedido.observacoes)}</div>` : ''}
          <div class="separator"></div>
          <div class="total">TOTAL: R$ ${pedido.valor.toFixed(2)}</div>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
    
    toast({
      title: "Impressão iniciada",
      description: `Pedido #${idCurto} enviado para impressão.`,
    });
  };

  const handleWhatsApp = () => {
    const itensTexto = pedido.itens
      .map((item) => `  • ${item.quantidade}x ${item.produto?.nome || 'Produto'}`)
      .join("\n");

    const mensagem = encodeURIComponent(
      `*Pedido #${idCurto}*\n\n` +
      `📦 *Produtos:*\n${itensTexto || pedido.produtos}\n\n` +
      `💰 *Valor:* R$ ${pedido.valor.toFixed(2)}\n` +
      `📍 *Endereço:* ${pedido.endereco}\n` +
      `📅 *Data:* ${pedido.data}\n` +
      (pedido.observacoes ? `📝 *Obs:* ${pedido.observacoes}\n` : '') +
      `\nObrigado pela preferência!`
    );
    
    window.open(`https://wa.me/?text=${mensagem}`, '_blank');
    
    toast({
      title: "WhatsApp aberto",
      description: "Compartilhe o pedido via WhatsApp.",
    });
  };

  const handleCancelar = () => {
    onCancelar(pedido.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Pedido #{idCurto}</span>
            <Badge variant={config.variant} className="gap-1">
              <StatusIcon className="h-3 w-3" />
              {config.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Data/Hora</span>
              <span className="font-medium">{pedido.data}</span>
            </div>
            <Separator />
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Cliente</h4>
            <p className="text-sm">{pedido.cliente}</p>
            <p className="text-sm text-muted-foreground">{pedido.endereco}</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="font-medium">Produtos</h4>
            {pedido.itens.length > 0 ? (
              <ul className="text-sm space-y-1">
                {pedido.itens.map((item) => (
                  <li key={item.id} className="flex justify-between">
                    <span>{item.quantidade}x {item.produto?.nome || 'Produto'}</span>
                    <span className="text-muted-foreground">R$ {(item.preco_unitario * item.quantidade).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm">{pedido.produtos}</p>
            )}
          </div>

          {pedido.entregador && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium">Entregador</h4>
                <p className="text-sm">{pedido.entregador}</p>
              </div>
            </>
          )}

          {pedido.observacoes && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium">Observações</h4>
                <p className="text-sm text-muted-foreground">{pedido.observacoes}</p>
              </div>
            </>
          )}

          <Separator />

          <div className="flex justify-between items-center">
            <span className="text-lg font-bold">Total</span>
            <span className="text-lg font-bold text-primary">
              R$ {pedido.valor.toFixed(2)}
            </span>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleWhatsApp}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
            </div>
            {pedido.status !== "cancelado" && pedido.status !== "entregue" && (
              <Button 
                variant="destructive" 
                className="w-full"
                onClick={handleCancelar}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar Pedido
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

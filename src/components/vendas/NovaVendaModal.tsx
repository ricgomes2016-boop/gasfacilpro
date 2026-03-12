import { lazy, Suspense } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ShoppingCart } from "lucide-react";
import { Loader2 } from "lucide-react";

const NovaVenda = lazy(() => import("@/pages/vendas/NovaVenda"));

interface NovaVendaModalProps {
  open: boolean;
  onClose: () => void;
  clienteId?: string | null;
}

export function NovaVendaModal({ open, onClose, clienteId }: NovaVendaModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[100vw] w-full h-[100dvh] max-h-[100dvh] p-0 gap-0 rounded-none border-none overflow-hidden [&>button]:hidden">
        {/* Compact header */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-primary/5 shrink-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Nova Venda (via Atendimento)
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            {open && (
              <NovaVenda
                embedded
                initialClienteId={clienteId}
                onClose={onClose}
              />
            )}
          </Suspense>
        </div>
      </DialogContent>
    </Dialog>
  );
}

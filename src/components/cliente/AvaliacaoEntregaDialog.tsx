import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AvaliacaoEntregaDialogProps {
  open: boolean;
  onClose: () => void;
  pedidoId: string;
  entregadorId: string | null;
  entregadorNome?: string;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          className="p-0.5 transition-transform hover:scale-110"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
        >
          <Star
            className={`h-8 w-8 transition-colors ${
              star <= (hover || value) ? "fill-warning text-warning" : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function AvaliacaoEntregaDialog({ open, onClose, pedidoId, entregadorId, entregadorNome }: AvaliacaoEntregaDialogProps) {
  const { user } = useAuth();
  const [notaEntregador, setNotaEntregador] = useState(0);
  const [notaProduto, setNotaProduto] = useState(0);
  const [comentario, setComentario] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (notaEntregador === 0 || notaProduto === 0) {
      toast.error("Selecione as estrelas para avaliar");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("avaliacoes_entrega").insert({
        pedido_id: pedidoId,
        user_id: user?.id || "",
        nota_entregador: notaEntregador,
        nota_produto: notaProduto,
        comentario: comentario.trim() || null,
        entregador_id: entregadorId,
      });

      if (error) throw error;
      toast.success("Avaliação enviada! Obrigado 🎉");
      onClose();
    } catch {
      toast.error("Erro ao enviar avaliação");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Como foi sua entrega?</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {entregadorId && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Entregador{entregadorNome ? `: ${entregadorNome}` : ""}</p>
              <StarRating value={notaEntregador} onChange={setNotaEntregador} />
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Produto / Pedido</p>
            <StarRating value={notaProduto} onChange={setNotaProduto} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Comentário (opcional)</p>
            <Textarea
              placeholder="Conte-nos mais sobre sua experiência..."
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
            />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Enviando..." : "Enviar Avaliação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

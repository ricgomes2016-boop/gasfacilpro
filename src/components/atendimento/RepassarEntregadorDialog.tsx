import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";

interface Entregador {
  id: string;
  nome: string;
  status: string | null;
}

interface RepassarEntregadorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedidoId: string | null;
  onSuccess: () => void;
}

export function RepassarEntregadorDialog({
  open,
  onOpenChange,
  pedidoId,
  onSuccess,
}: RepassarEntregadorDialogProps) {
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const { unidadeAtual } = useUnidade();

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    const fetch = async () => {
      let query = supabase
        .from("entregadores")
        .select("id, nome, status")
        .eq("ativo", true)
        .order("nome");

      if (unidadeAtual?.id) {
        query = query.eq("unidade_id", unidadeAtual.id);
      }

      const { data } = await query;
      setEntregadores(data || []);
      setLoading(false);
    };

    fetch();
  }, [open, unidadeAtual?.id]);

  const handleAssign = async (entregador: Entregador) => {
    if (!pedidoId) return;
    setAssigning(entregador.id);
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({
          entregador_id: entregador.id,
          entregador_nome: entregador.nome,
          status: "confirmado",
        })
        .eq("id", pedidoId);

      if (error) throw error;

      toast.success(`Pedido repassado para ${entregador.nome}`);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao repassar pedido");
    } finally {
      setAssigning(null);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "disponivel":
        return <Badge variant="default" className="text-[10px]">Disponível</Badge>;
      case "em_rota":
        return <Badge variant="secondary" className="text-[10px]">Em Rota</Badge>;
      case "indisponivel":
        return <Badge variant="destructive" className="text-[10px]">Indisponível</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Repassar para Entregador
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : entregadores.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Nenhum entregador ativo encontrado nesta unidade.
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {entregadores.map((e) => (
              <button
                key={e.id}
                disabled={assigning !== null}
                onClick={() => handleAssign(e)}
                className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Truck className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">{e.nome}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(e.status)}
                  {assigning === e.id && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

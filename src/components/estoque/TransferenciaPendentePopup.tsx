import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Truck, Package } from "lucide-react";

interface TransferenciaPendente {
  id: string;
  unidade_origem: { nome: string };
  valor_total: number;
  data_transferencia: string | null;
  created_at: string;
  itens: { produto_nome: string; quantidade: number }[];
}

export function TransferenciaPendentePopup() {
  const { unidadeAtual } = useUnidade();
  const navigate = useNavigate();
  const [pendente, setPendente] = useState<TransferenciaPendente | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const checkPendentes = useCallback(async () => {
    if (!unidadeAtual?.id) return;

    const { data } = await supabase
      .from("transferencias_estoque")
      .select(`
        id, valor_total, data_transferencia, created_at,
        unidade_origem:unidade_origem_id(nome),
        itens:transferencia_estoque_itens(quantidade, produtos:produto_id(nome))
      `)
      .eq("unidade_destino_id", unidadeAtual.id)
      .eq("status", "em_transito")
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const t = data[0] as any;
      if (!dismissed.has(t.id)) {
        setPendente({
          id: t.id,
          unidade_origem: t.unidade_origem,
          valor_total: t.valor_total,
          data_transferencia: t.data_transferencia,
          created_at: t.created_at,
          itens: (t.itens || []).map((i: any) => ({
            produto_nome: i.produtos?.nome || "",
            quantidade: i.quantidade,
          })),
        });
      }
    } else {
      setPendente(null);
    }
  }, [unidadeAtual?.id, dismissed]);

  useEffect(() => {
    checkPendentes();
    const interval = setInterval(checkPendentes, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [checkPendentes]);

  // Realtime subscription for instant notification
  useEffect(() => {
    if (!unidadeAtual?.id) return;
    const channel = supabase
      .channel(`transf-pendente-${unidadeAtual.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transferencias_estoque",
          filter: `unidade_destino_id=eq.${unidadeAtual.id}`,
        },
        () => checkPendentes()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [unidadeAtual?.id, checkPendentes]);

  const handleAccept = () => {
    setPendente(null);
    navigate("/estoque/transferencia");
  };

  const handleDismiss = () => {
    if (pendente) {
      setDismissed((prev) => new Set(prev).add(pendente.id));
    }
    setPendente(null);
  };

  if (!pendente) return null;

  const resumoItens = pendente.itens
    .map((i) => `${i.quantidade}x ${i.produto_nome}`)
    .join(", ");

  return (
    <AlertDialog open={!!pendente} onOpenChange={(open) => !open && handleDismiss()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Truck className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <AlertDialogTitle className="text-lg">
              Transferência Recebida!
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p className="text-sm">
                <strong>{pendente.unidade_origem?.nome}</strong> enviou uma transferência de estoque para sua unidade.
              </p>
              <div className="bg-muted rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Itens:
                </div>
                <p className="text-sm text-foreground">{resumoItens}</p>
                <p className="text-sm font-semibold text-primary mt-1">
                  Valor: R$ {pendente.valor_total.toFixed(2)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Acesse a tela de transferências para confirmar o recebimento.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDismiss}>Depois</AlertDialogCancel>
          <AlertDialogAction onClick={handleAccept}>
            Ir para Transferências
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

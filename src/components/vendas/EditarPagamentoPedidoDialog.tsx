import { useEffect, useState } from "react";
import { Loader2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PaymentSection, Pagamento } from "@/components/vendas/PaymentSection";
import { rerotearPagamentosPedido, rotearPagamentosVenda } from "@/services/paymentRoutingService";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido: {
    id: string;
    numero_sequencial: number | null;
    cliente: string;
    cliente_id: string | null;
    valor: number;
    status: string;
    forma_pagamento?: string;
    entregador_id?: string | null;
    itens?: Array<{ produto?: { nome: string }; quantidade: number }>;
  } | null;
  onSaved?: () => void;
}

const STATUS_JA_MOVIMENTA = new Set([
  "entregue",
  "finalizado",
  "pago_cartao",
]);

export function EditarPagamentoPedidoDialog({ open, onOpenChange, pedido, onSaved }: Props) {
  const { unidadeAtual } = useUnidade();
  const { user } = useAuth();
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [saving, setSaving] = useState(false);

  // Pré-preenche com a forma atual (valor total do pedido) ao abrir.
  useEffect(() => {
    if (!open || !pedido) return;
    const formas = (pedido.forma_pagamento || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (formas.length === 0) {
      setPagamentos([]);
      return;
    }
    const valorPorForma = pedido.valor / formas.length;
    setPagamentos(
      formas.map((f) => ({
        id: crypto.randomUUID(),
        forma: f,
        valor: valorPorForma,
      }))
    );
  }, [open, pedido]);

  if (!pedido) return null;

  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const diferenca = Number((pedido.valor - totalPago).toFixed(2));
  const okValor = Math.abs(diferenca) < 0.01;

  const itens = (pedido.itens || []).map((it) => ({
    nome: it.produto?.nome || "Produto",
    quantidade: it.quantidade,
  }));

  const handleSalvar = async () => {
    if (pagamentos.length === 0) {
      toast.error("Adicione ao menos uma forma de pagamento");
      return;
    }
    if (!okValor) {
      toast.error(
        `Total das formas (R$ ${totalPago.toFixed(2)}) difere do valor do pedido (R$ ${pedido.valor.toFixed(2)})`
      );
      return;
    }
    setSaving(true);
    try {
      // 1. Atualiza forma_pagamento resumida no pedido
      const formaResumo = pagamentos.map((p) => p.forma).join(", ");
      const { error: upErr } = await supabase
        .from("pedidos")
        .update({ forma_pagamento: formaResumo })
        .eq("id", pedido.id);
      if (upErr) throw upErr;

      // 2. Se pedido já gera movimentação financeira, refaz o roteamento
      //    para direcionar às contas/operadoras corretas.
      const jaMovimenta = STATUS_JA_MOVIMENTA.has(pedido.status);
      const routingPayload = {
        pedidoId: pedido.id,
        pedidoNumero: pedido.numero_sequencial ?? undefined,
        clienteId: pedido.cliente_id,
        clienteNome: pedido.cliente,
        pagamentos: pagamentos.map((p) => ({
          forma: p.forma,
          valor: p.valor,
          cheque_numero: p.cheque_numero,
          cheque_banco: p.cheque_banco,
          cheque_foto_url: p.cheque_foto_url,
          data_vencimento_fiado: p.data_vencimento_fiado,
          operadora_id: p.operadora_id,
          conta_bancaria_id: p.conta_bancaria_id,
          parcelas: p.parcelas,
        })),
        unidadeId: unidadeAtual?.id ?? null,
        entregadorId: pedido.entregador_id ?? null,
        userId: user?.id,
      };

      if (jaMovimenta) {
        await rerotearPagamentosPedido(routingPayload);
        toast.success("Pagamento atualizado e movimentações financeiras refeitas");
      } else {
        toast.success("Forma de pagamento atualizada");
      }

      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao salvar pagamento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Editar pagamento — Pedido #{pedido.numero_sequencial ?? pedido.id.slice(0, 8).toUpperCase()}
          </DialogTitle>
          <DialogDescription>
            Escolha a forma, operadora (cartão) ou chave PIX vinculada à conta bancária.
            Se o pedido já estiver entregue/pago, as movimentações financeiras serão refeitas
            automaticamente para as contas corretas.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2">
          <PaymentSection
            pagamentos={pagamentos}
            onChange={setPagamentos}
            totalVenda={pedido.valor}
            itens={itens}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={saving || !okValor || pagamentos.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Salvar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { supabase } from "@/integrations/supabase/client";

interface ValePagamentoReserva {
  vale_gas_id?: string;
}

export async function reservarValesGasDoPedido(
  pedidoId: string,
  pagamentos: ValePagamentoReserva[],
  clienteId?: string | null,
  clienteNome?: string | null,
) {
  const ids = [...new Set(pagamentos.map((pagamento) => pagamento.vale_gas_id).filter(Boolean))] as string[];
  for (const valeId of ids) {
    const { data, error } = await (supabase as any)
      .from("vale_gas")
      .update({
        venda_id: pedidoId,
        cliente_id: clienteId || null,
        cliente_nome: clienteNome || null,
      })
      .eq("id", valeId)
      .is("venda_id", null)
      .in("status", ["disponivel", "vendido"])
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      await liberarValesGasDoPedido(pedidoId);
      throw new Error("Este Vale Gás acabou de ser usado ou reservado em outro pedido.");
    }
  }
}

export async function liberarValesGasDoPedido(pedidoId: string) {
  const { error } = await (supabase as any)
    .from("vale_gas")
    .update({ venda_id: null, cliente_id: null, cliente_nome: null })
    .eq("venda_id", pedidoId)
    .in("status", ["disponivel", "vendido"]);
  if (error) console.error("Falha ao liberar reserva de Vale Gás:", error);
}

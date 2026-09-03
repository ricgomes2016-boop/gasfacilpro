import { supabase } from "@/integrations/supabase/client";

export interface VendaAntecipadaValidationResult {
  valido: boolean;
  valeId?: string;
  vendaAntecipadaId?: string;
  codigo: string;
  numero?: number;
  produtoId?: string | null;
  produtoNome?: string;
  valor: number;
  clienteId?: string | null;
  clienteNome?: string;
  erro?: string;
}

/** Valida o vale pessoal pré-pago. Não consulta a tabela de vales de parceiros. */
export async function validarValeVendaAntecipada(entrada: string, clienteId?: string | null): Promise<VendaAntecipadaValidationResult> {
  const codigo = entrada.trim().toUpperCase();
  const falhar = (erro: string): VendaAntecipadaValidationResult => ({ valido: false, codigo, valor: 0, erro });
  if (!codigo) return falhar("Informe o código da venda antecipada");

  try {
    const campos = "id, venda_antecipada_id, codigo, numero, status, produto_id, produto_nome, valor_unitario, cliente_id, unidade_id, vendas_antecipadas!inner(cliente_nome)";
    let registros: any[] = [];
    if (/^\d+$/.test(codigo)) {
      let query = (supabase as any).from("vendas_antecipadas_vales")
        .select(campos).eq("numero", Number(codigo)).eq("status", "disponivel");
      if (clienteId) query = query.eq("cliente_id", clienteId);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(2);
      if (error) throw error;
      registros = data || [];
      if (registros.length > 1) return falhar("Este número existe em mais de uma venda. Digite o código completo impresso no vale (ex.: VA-2026-00001-01).");
    } else {
      const { data, error } = await (supabase as any).from("vendas_antecipadas_vales")
        .select(campos).ilike("codigo", codigo).limit(1);
      if (error) throw error;
      registros = data || [];
    }
    const vale = registros[0];
    if (!vale) return falhar("Venda antecipada não encontrada ou já utilizada");
    if (vale.status === "retirado") return falhar("Este vale já foi retirado");
    if (vale.status === "cancelado") return falhar("Este vale foi cancelado");
    return {
      valido: true,
      valeId: vale.id,
      vendaAntecipadaId: vale.venda_antecipada_id,
      codigo: vale.codigo,
      numero: vale.numero,
      produtoId: vale.produto_id,
      produtoNome: vale.produto_nome,
      valor: Number(vale.valor_unitario) || 0,
      clienteId: vale.cliente_id,
      clienteNome: vale.vendas_antecipadas?.cliente_nome,
    };
  } catch (error: any) {
    return falhar(error?.message || "Não foi possível validar a venda antecipada");
  }
}

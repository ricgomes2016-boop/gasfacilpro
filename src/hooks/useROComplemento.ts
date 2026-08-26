import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth } from "date-fns";

export interface ROAjuste {
  chave: string;
  valor: number;
  observacao?: string | null;
}

export interface FluxoLateral {
  dinheiro: number;
  cartao: number;
  boletos: number;
  chequesPreVista: number;
  chequesDevolvidos: number;
  valeUltragazP13: number;
  valeUltragazP45: number;
  saldosBancarios: { banco: string; saldo: number }[];
  estoqueValorizado: { produto: string; qtd: number; valor: number }[];
}

const CHAVES_AJUSTES = [
  "nota_credito",
  "saidas",
  "investimentos",
  "pendencias",
  "fernando_abm",
  "prazo_faturamento",
];

export function useROComplemento(
  unidadeId: string | undefined,
  ano: number,
  mes: number,
) {
  const [loading, setLoading] = useState(false);
  const [ajustes, setAjustes] = useState<Record<string, ROAjuste>>({});
  const [fluxo, setFluxo] = useState<FluxoLateral>({
    dinheiro: 0,
    cartao: 0,
    boletos: 0,
    chequesPreVista: 0,
    chequesDevolvidos: 0,
    valeUltragazP13: 0,
    valeUltragazP45: 0,
    saldosBancarios: [],
    estoqueValorizado: [],
  });

  const fetchAll = useCallback(async () => {
    if (!unidadeId) return;
    setLoading(true);
    try {
      const inicio = startOfMonth(new Date(ano, mes, 1)).toISOString();
      const fim = endOfMonth(new Date(ano, mes, 1)).toISOString();

      const [
        ajustesRes,
        caixaRes,
        crRes,
        boletosRes,
        chequesRes,
        valeRes,
        contasBancRes,
        produtosRes,
      ] = await Promise.all([
        supabase.from("ro_ajustes_mensais").select("chave, valor, observacao")
          .eq("unidade_id", unidadeId).eq("ano", ano).eq("mes", mes + 1),
        supabase.from("movimentacoes_caixa").select("valor, forma_pagamento, tipo, status")
          .eq("unidade_id", unidadeId).eq("tipo", "entrada").neq("status", "rejeitada")
          .gte("created_at", inicio).lte("created_at", fim),
        supabase.from("contas_receber").select("valor, valor_liquido, forma_pagamento, status, operadora_id, data_recebimento")
          .eq("unidade_id", unidadeId).eq("status", "pago")
          .gte("data_recebimento", inicio.substring(0, 10)).lte("data_recebimento", fim.substring(0, 10)),
        supabase.from("boletos_emitidos").select("valor, status")
          .eq("unidade_id", unidadeId).in("status", ["pago", "liquidado"])
          .gte("created_at", inicio).lte("created_at", fim),
        supabase.from("cheques").select("valor, status")
          .eq("unidade_id", unidadeId)
          .gte("created_at", inicio).lte("created_at", fim),
        supabase.from("vale_gas").select("valor, valor_venda, produto_id, status")
          .eq("unidade_id", unidadeId)
          .gte("created_at", inicio).lte("created_at", fim),
        supabase.from("contas_bancarias").select("banco, saldo_atual")
          .eq("unidade_id", unidadeId).eq("ativo", true),
        supabase.from("produtos").select("id, nome, preco_custo, estoque").eq("unidade_id", unidadeId),
      ]);

      // Ajustes
      const mapAj: Record<string, ROAjuste> = {};
      (ajustesRes.data || []).forEach((a: any) => { mapAj[a.chave] = a as ROAjuste; });
      CHAVES_AJUSTES.forEach((k) => { if (!mapAj[k]) mapAj[k] = { chave: k, valor: 0 }; });
      setAjustes(mapAj);

      // Dinheiro (entradas de caixa em dinheiro)
      const dinheiro = (caixaRes.data || [])
        .filter((m: any) => !m.forma_pagamento || String(m.forma_pagamento).toLowerCase().includes("dinheiro"))
        .reduce((s: number, m: any) => s + (Number(m.valor) || 0), 0);

      // Cartão (contas_receber com operadora_id não nula ou forma cartão/pix maquininha)
      const cartao = (crRes.data || [])
        .filter((c: any) => c.operadora_id || /cart|pix.?maquin|maquineta|pix_maquin/i.test(String(c.forma_pagamento || "")))
        .reduce((s: number, c: any) => s + (Number(c.valor_liquido ?? c.valor) || 0), 0);

      // Boletos
      const boletos = (boletosRes.data || []).reduce((s: number, b: any) => s + (Number(b.valor) || 0), 0);

      // Cheques
      let chPre = 0, chDev = 0;
      (chequesRes.data || []).forEach((c: any) => {
        const v = Number(c.valor) || 0;
        if (String(c.status).toLowerCase().includes("devolv")) chDev += v;
        else chPre += v;
      });

      // Vale ultragaz por produto (heurística: P13 x P45 pelo nome do produto)
      const prodMap = new Map((produtosRes.data || []).map((p: any) => [p.id, p]));
      let vP13 = 0, vP45 = 0;
      (valeRes.data || []).forEach((v: any) => {
        const p: any = prodMap.get(v.produto_id);
        const nome = (p?.nome || "").toLowerCase();
        const val = Number(v.valor_venda ?? v.valor) || 0;
        if (/p45|45.?kg/.test(nome)) vP45 += val;
        else vP13 += val;
      });

      // Saldos bancários (agrupa por banco)
      const saldosMap: Record<string, number> = {};
      (contasBancRes.data || []).forEach((c: any) => {
        const b = c.banco || "Outros";
        saldosMap[b] = (saldosMap[b] || 0) + (Number(c.saldo_atual) || 0);
      });
      const saldosBancarios = Object.entries(saldosMap).map(([banco, saldo]) => ({ banco, saldo }));

      // Estoque valorizado (só produtos com estoque > 0)
      const estoqueValorizado = (produtosRes.data || [])
        .filter((p: any) => (Number(p.estoque) || 0) > 0)
        .map((p: any) => ({
          produto: p.nome,
          qtd: Number(p.estoque) || 0,
          valor: (Number(p.estoque) || 0) * (Number(p.preco_custo) || 0),
        }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 8);

      setFluxo({
        dinheiro, cartao, boletos,
        chequesPreVista: chPre,
        chequesDevolvidos: chDev,
        valeUltragazP13: vP13,
        valeUltragazP45: vP45,
        saldosBancarios,
        estoqueValorizado,
      });
    } catch (e) {
      console.error("[useROComplemento]", e);
    } finally {
      setLoading(false);
    }
  }, [unidadeId, ano, mes]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const salvarAjuste = useCallback(async (
    chave: string,
    valor: number,
    empresaId: string,
    observacao?: string,
  ) => {
    if (!unidadeId) return;
    const { error } = await supabase.from("ro_ajustes_mensais")
      .upsert({
        unidade_id: unidadeId,
        empresa_id: empresaId,
        ano,
        mes: mes + 1,
        chave,
        valor,
        observacao,
      }, { onConflict: "unidade_id,ano,mes,chave" });
    if (error) console.error("[salvarAjuste]", error);
    setAjustes((prev) => ({ ...prev, [chave]: { chave, valor, observacao } }));
  }, [unidadeId, ano, mes]);

  return { loading, ajustes, fluxo, salvarAjuste, refetch: fetchAll };
}

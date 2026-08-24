// Edge Function: baixar-nfe-chave
// Busca o XML de uma NF-e pela chave de acesso (44 dígitos) via serviço
// NFeDistribuicaoDFe / consChNFe. O transporte mTLS é delegado ao serviço
// externo `fiscal-bridge`. Sempre retorna 200 OK; em erro { ok:false, motivo }.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, autorizarUnidade, carregarCertificadoUnidade } from "../_shared/nfe-cert.ts";
import { bridgeConfigurado, chamarBridge, MENSAGEM_BRIDGE_AUSENTE } from "../_shared/fiscal-bridge.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const unidadeId: string | undefined = body?.unidadeId;
    const chave: string = String(body?.chave || "").replace(/\D/g, "");

    if (!unidadeId) return json({ ok: false, motivo: "bad_request", mensagem: "unidadeId é obrigatório." });
    if (chave.length !== 44) {
      return json({ ok: false, motivo: "chave_invalida", mensagem: "A chave da NF-e deve ter 44 dígitos." });
    }

    const auth = await autorizarUnidade(req, unidadeId);
    if (!auth.ok) return json({ ok: false, motivo: auth.motivo, mensagem: auth.mensagem }, auth.status);

    const admin = adminClient();
    const carga = await carregarCertificadoUnidade(admin, unidadeId);
    if (!carga.ok) return json({ ok: false, motivo: carga.motivo, mensagem: carga.mensagem });

    if (!bridgeConfigurado()) {
      return json({ ok: false, motivo: "bridge_nao_configurado", mensagem: MENSAGEM_BRIDGE_AUSENTE });
    }

    const resp = await chamarBridge<{
      xml?: string; completo?: boolean; cStat?: string | null; xMotivo?: string | null;
      titular?: string; podeRepetir?: boolean; detalheTecnico?: string;
    }>("/dfe/consulta-chave", { unidadeId, cnpj: carga.cnpj, chave });

    if (!resp.ok) {
      const d = resp.dados ?? {};
      return json({
        ok: false,
        motivo: resp.motivo || "sefaz_indisponivel",
        cStat: d.cStat ?? null,
        podeRepetir: d.podeRepetir ?? false,
        detalhe: d.detalheTecnico ?? d.xMotivo ?? null,
        mensagem: resp.mensagem
          || "A SEFAZ não retornou o XML desta chave. Normalmente é preciso fazer a Manifestação do Destinatário (Ciência da Operação) ou a nota não é destinada a este CNPJ.",
      });
    }

    const dados = resp.dados!;
    if (!dados.completo || !dados.xml) {
      return json({
        ok: false,
        motivo: "apenas_resumo",
        mensagem: "A SEFAZ retornou apenas o resumo da nota (sem itens). Faça a Manifestação do Destinatário para liberar o XML completo.",
      });
    }

    return json({ ok: true, xml: dados.xml, chave, titular: dados.titular ?? carga.cert.titular });
  } catch (err) {
    console.error("[baixar-nfe-chave]", err);
    return json({ ok: false, motivo: "exception", mensagem: String((err as Error)?.message || err) });
  }
});

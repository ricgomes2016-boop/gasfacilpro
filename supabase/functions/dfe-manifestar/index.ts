// Edge Function: dfe-manifestar
// Registra o evento de Manifestação do Destinatário na SEFAZ (Ambiente Nacional):
//  210200 Confirmação da Operação | 210210 Ciência da Emissão
//  210220 Desconhecimento da Operação | 210240 Operação não Realizada
// A assinatura XMLDSig e o transporte mTLS são executados pelo serviço externo
// `fiscal-bridge`, que usa o certificado A1 (e-CNPJ) da unidade sob demanda.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, autorizarUnidade, carregarCertificadoUnidade } from "../_shared/nfe-cert.ts";
import { bridgeConfigurado, chamarBridge, MENSAGEM_BRIDGE_AUSENTE } from "../_shared/fiscal-bridge.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Tipo = "ciencia" | "confirmada" | "desconhecida" | "nao_realizada";

const CODIGO: Record<Tipo, string> = {
  confirmada: "210200", ciencia: "210210", desconhecida: "210220", nao_realizada: "210240",
};
const DESCRICAO: Record<Tipo, string> = {
  confirmada: "Confirmacao da Operacao", ciencia: "Ciencia da Emissao",
  desconhecida: "Desconhecimento da Operacao", nao_realizada: "Operacao nao Realizada",
};
const CONCLUSIVAS: Tipo[] = ["confirmada", "desconhecida", "nao_realizada"];
const EXIGE_JUSTIFICATIVA: Tipo[] = ["desconhecida", "nao_realizada"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const unidadeId: string | undefined = body?.unidadeId;
    const chave: string = String(body?.chave || "").replace(/\D/g, "");
    const tipo = String(body?.tipo || "") as Tipo;
    const justificativa = String(body?.justificativa || "").trim();

    if (!unidadeId) return json({ ok: false, motivo: "bad_request", mensagem: "unidadeId é obrigatório." });
    if (chave.length !== 44) return json({ ok: false, motivo: "chave_invalida", mensagem: "Chave de acesso inválida." });
    if (!CODIGO[tipo]) return json({ ok: false, motivo: "tipo_invalido", mensagem: "Tipo de manifestação inválido." });
    if (EXIGE_JUSTIFICATIVA.includes(tipo) && (justificativa.length < 15 || justificativa.length > 255)) {
      return json({
        ok: false, motivo: "justificativa_invalida",
        mensagem: "Justificativa obrigatória entre 15 e 255 caracteres para esta manifestação.",
      });
    }

    const auth = await autorizarUnidade(req, unidadeId);
    if (!auth.ok) return json({ ok: false, motivo: auth.motivo, mensagem: auth.mensagem }, auth.status);

    const admin = adminClient();

    const { data: documento } = await admin
      .from("dfe_documentos").select("id, manifestacao, empresa_id")
      .eq("unidade_id", unidadeId).eq("chave", chave).maybeSingle();

    const atual = (documento?.manifestacao ?? null) as Tipo | null;
    if (atual && CONCLUSIVAS.includes(atual)) {
      return json({ ok: false, motivo: "manifestacao_conclusiva", mensagem: "A nota já possui manifestação conclusiva." });
    }
    if (atual === "ciencia" && tipo === "ciencia") {
      return json({ ok: false, motivo: "ja_manifestada", mensagem: "A Ciência da Emissão já foi registrada." });
    }

    // Valida unidade, certificado A1 e CNPJ antes de delegar.
    const carga = await carregarCertificadoUnidade(admin, unidadeId);
    if (!carga.ok) return json({ ok: false, motivo: carga.motivo, mensagem: carga.mensagem });
    const empresaId = (documento?.empresa_id as string | null) ?? (carga.unidade.empresa_id as string | null) ?? null;

    if (!bridgeConfigurado()) {
      return json({ ok: false, motivo: "bridge_nao_configurado", mensagem: MENSAGEM_BRIDGE_AUSENTE });
    }

    // Sequência do evento: incrementa a cada registro bem-sucedido do mesmo tipo
    const { count } = await admin
      .from("dfe_eventos").select("id", { count: "exact", head: true })
      .eq("unidade_id", unidadeId).eq("chave", chave).eq("tipo_evento", CODIGO[tipo]).eq("sucesso", true);
    const seq = Number(count ?? 0) + 1;

    const resp = await chamarBridge<{
      cStat?: string | null; xMotivo?: string | null; protocolo?: string | null; detalheTecnico?: string;
    }>("/dfe/manifestar", {
      unidadeId, cnpj: carga.cnpj, chave, tipo,
      justificativa: EXIGE_JUSTIFICATIVA.includes(tipo) ? justificativa : "",
      sequencia: seq,
    });

    const dados = resp.dados ?? {};
    const cStat = dados.cStat ?? null;
    const xMotivo = dados.xMotivo ?? null;
    const protocolo = dados.protocolo ?? null;
    const sucesso = resp.ok === true;

    if (documento && (sucesso || cStat)) {
      await admin.from("dfe_eventos").insert({
        documento_id: documento.id, unidade_id: unidadeId, empresa_id: empresaId, chave,
        tipo_evento: CODIGO[tipo], descricao: DESCRICAO[tipo], sequencia: seq,
        protocolo, cstat: cStat, xmotivo: xMotivo,
        justificativa: EXIGE_JUSTIFICATIVA.includes(tipo) ? justificativa : null,
        sucesso, criado_por: auth.userId, payload: { origem: "manifestacao_manual", via: "fiscal-bridge" },
      });
      if (sucesso) {
        await admin.from("dfe_documentos")
          .update({ manifestacao: tipo, manifestacao_em: new Date().toISOString() })
          .eq("id", documento.id);
      }
    }

    return json({
      ok: sucesso, cStat, xMotivo, protocolo, tipo, sequencia: seq,
      mensagem: sucesso
        ? `${DESCRICAO[tipo]} registrada na SEFAZ${protocolo ? ` (protocolo ${protocolo})` : ""}.`
        : (resp.mensagem || `SEFAZ ${cStat ?? ""}: ${xMotivo ?? "evento não registrado"}`),
      motivo: sucesso ? undefined : (resp.motivo || "evento_rejeitado"),
      detalheTecnico: dados.detalheTecnico ?? null,
    });
  } catch (err) {
    console.error("[dfe-manifestar]", err);
    return json({ ok: false, motivo: "exception", mensagem: String((err as Error)?.message || err) });
  }
});

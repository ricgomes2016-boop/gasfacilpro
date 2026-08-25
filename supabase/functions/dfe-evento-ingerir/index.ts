// Edge Function: dfe-evento-ingerir
// Persiste o resultado de uma manifestação executada pelo AGENTE LOCAL, sem
// refazer a chamada à SEFAZ. O navegador não é fonte de verdade: a Edge só
// grava a manifestação depois de validar criptograficamente o XML do evento
// assinado com o certificado A1 da unidade (ver _shared/xmldsig-nfe.ts).

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, autorizarUnidade, carregarCertificadoUnidade } from "../_shared/nfe-cert.ts";
import { lerRetEvento, verificarEventoAssinado } from "../_shared/xmldsig-nfe.ts";

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
const CSTAT_OK = new Set(["135", "136", "155"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const unidadeId: string | undefined = body?.unidadeId;
    const chave = String(body?.chave || "").replace(/\D/g, "");
    const tipo = String(body?.tipo || "") as Tipo;
    const justificativa = String(body?.justificativa || "").trim();
    const eventoXml = String(body?.eventoXml || "");
    const retornoXml = String(body?.retornoXml || "");

    // --- payload mínimo ---
    if (!unidadeId) return json({ ok: false, motivo: "bad_request", mensagem: "unidadeId é obrigatório." });
    if (chave.length !== 44) return json({ ok: false, motivo: "chave_invalida", mensagem: "Chave de acesso inválida." });
    if (!CODIGO[tipo]) return json({ ok: false, motivo: "tipo_invalido", mensagem: "Tipo de manifestação inválido." });
    if (EXIGE_JUSTIFICATIVA.includes(tipo) && (justificativa.length < 15 || justificativa.length > 255)) {
      return json({ ok: false, motivo: "justificativa_invalida", mensagem: "Justificativa obrigatória entre 15 e 255 caracteres." });
    }
    if (!eventoXml) {
      return json({ ok: false, motivo: "evento_xml_ausente", mensagem: "O XML assinado do evento é obrigatório." });
    }

    const auth = await autorizarUnidade(req, unidadeId);
    if (!auth.ok) return json({ ok: false, motivo: auth.motivo, mensagem: auth.mensagem }, auth.status);

    const admin = adminClient();

    const { data: documento } = await admin
      .from("dfe_documentos").select("id, manifestacao, empresa_id")
      .eq("unidade_id", unidadeId).eq("chave", chave).maybeSingle();
    if (!documento) {
      return json({ ok: false, motivo: "documento_nao_encontrado", mensagem: "Documento DF-e não encontrado nesta unidade." });
    }
    const atual = (documento.manifestacao ?? null) as Tipo | null;
    if (atual && CONCLUSIVAS.includes(atual)) {
      return json({ ok: false, motivo: "manifestacao_conclusiva", mensagem: "A nota já possui manifestação conclusiva." });
    }

    // --- verificação criptográfica (o navegador não decide o sucesso) ---
    const carga = await carregarCertificadoUnidade(admin, unidadeId);
    if (!carga.ok) return json({ ok: false, motivo: carga.motivo, mensagem: carga.mensagem });

    const conferencia = verificarEventoAssinado({
      eventoXml, chave, codigoEvento: CODIGO[tipo],
      cnpjUnidade: carga.cnpj,
      certBase64Referencia: carga.cert.certBase64 ?? null,
    });
    if (!conferencia.ok) {
      console.error(`[dfe-evento-ingerir] recusado motivo=${conferencia.motivo}`);
      await admin.from("dfe_eventos").insert({
        documento_id: documento.id, unidade_id: unidadeId, empresa_id: documento.empresa_id ?? null, chave,
        tipo_evento: CODIGO[tipo], descricao: DESCRICAO[tipo], sequencia: 0,
        cstat: null, xmotivo: conferencia.mensagem, sucesso: false, criado_por: auth.userId,
        payload: { origem: "agente_local", verificado: false, motivo: conferencia.motivo },
      });
      return json({ ok: false, motivo: conferencia.motivo, mensagem: conferencia.mensagem });
    }

    const ret = lerRetEvento(retornoXml);
    const cStat = ret.cStat ?? (body?.cStat ? String(body.cStat) : null);
    const xMotivo = ret.xMotivo ?? (body?.xMotivo ? String(body.xMotivo) : null);
    const protocolo = ret.protocolo ?? (body?.protocolo ? String(body.protocolo) : null);
    const aceito = Boolean(cStat && CSTAT_OK.has(cStat));

    const { data: evento } = await admin.from("dfe_eventos").insert({
      documento_id: documento.id, unidade_id: unidadeId, empresa_id: documento.empresa_id ?? null, chave,
      tipo_evento: CODIGO[tipo], descricao: DESCRICAO[tipo], sequencia: conferencia.sequencia,
      protocolo, cstat: cStat, xmotivo: xMotivo,
      justificativa: EXIGE_JUSTIFICATIVA.includes(tipo) ? justificativa : null,
      sucesso: aceito, criado_por: auth.userId,
      payload: {
        origem: "agente_local", verificado: true, id_evento: conferencia.idEvento,
        titular: conferencia.titular, evento_xml: eventoXml.slice(0, 60_000),
        retorno_xml: retornoXml.slice(0, 60_000),
      },
    }).select("id").maybeSingle();

    if (aceito) {
      await admin.from("dfe_documentos")
        .update({ manifestacao: tipo, manifestacao_em: new Date().toISOString() })
        .eq("id", documento.id);
    }

    return json({
      ok: aceito,
      eventoId: evento?.id ?? null,
      cStat, xMotivo, protocolo, tipo, sequencia: conferencia.sequencia,
      mensagem: aceito
        ? `${DESCRICAO[tipo]} registrada e conferida${protocolo ? ` (protocolo ${protocolo})` : ""}.`
        : `SEFAZ ${cStat ?? ""}: ${xMotivo ?? "evento não registrado"}`,
      motivo: aceito ? undefined : "evento_rejeitado",
    });
  } catch (err) {
    console.error("[dfe-evento-ingerir]", err);
    return json({ ok: false, motivo: "exception", mensagem: "Falha ao registrar o evento." });
  }
});

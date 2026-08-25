// Edge Function: dfe-ingerir
// Recebe XMLs brutos de DF-e obtidos pelo agente local (PC do escritório) ou por
// importação manual e persiste em dfe_documentos / dfe_eventos com RLS multi-tenant.
// O certificado A1 nunca passa por aqui: o agente só devolve os XMLs.
// Sempre responde 200 com { ok: boolean, ... }.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, autorizarUnidade } from "../_shared/nfe-cert.ts";
import { parseDfeDocumento, deveAtualizarDocumento } from "../_shared/dfe-parse.ts";

const MAX_DOCUMENTOS = 500;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface DocEntrada { nsu?: number | string | null; schema?: string | null; xml?: string }

function so(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

/** CNPJ/CPF do destinatário no XML (resNFe traz o do próprio interessado). */
function destinatarioDoXml(xml: string): string | null {
  const dest = xml.match(/<(?:\w+:)?dest[^>]*>([\s\S]*?)<\/(?:\w+:)?dest>/i)?.[1];
  if (dest) {
    const doc = so(dest.match(/<(?:\w+:)?(?:CNPJ|CPF)>([\s\S]*?)</i)?.[1]);
    if (doc) return doc;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const unidadeId: string | undefined = body?.unidadeId;
    const documentos: DocEntrada[] = Array.isArray(body?.documentos) ? body.documentos : [];
    // Lote vazio é aceito apenas quando a intenção é registrar o avanço do NSU
    // após uma consulta real bem-sucedida sem documentos novos ("cStat 137").
    const registrarEstado = body?.registrarEstado === true;
    if (!unidadeId) return json({ ok: false, motivo: "bad_request", mensagem: "unidadeId é obrigatório." });
    if (!documentos.length && !registrarEstado) {
      return json({ ok: false, motivo: "bad_request", mensagem: "Envie ao menos um documento XML." });
    }
    if (documentos.length > MAX_DOCUMENTOS) {
      return json({ ok: false, motivo: "bad_request", mensagem: `Envie no máximo ${MAX_DOCUMENTOS} documentos por vez.` });
    }

    const auth = await autorizarUnidade(req, unidadeId);
    if (!auth.ok) return json({ ok: false, motivo: auth.motivo, mensagem: auth.mensagem }, auth.status);

    const admin = adminClient();
    const { data: unidade, error: errUnidade } = await admin
      .from("unidades").select("id, empresa_id, cnpj").eq("id", unidadeId).maybeSingle();
    if (errUnidade || !unidade) {
      return json({ ok: false, motivo: "unidade_nao_encontrada", mensagem: "Unidade não encontrada." });
    }
    const empresaId = (unidade.empresa_id as string | null) ?? null;
    const cnpjUnidade = so(unidade.cnpj);

    let novos = 0;
    let atualizados = 0;
    let ignorados = 0;
    let divergentes = 0;
    let eventos = 0;
    let maiorNsu = 0;

    for (const entrada of documentos) {
      const xml = String(entrada?.xml ?? "").trim();
      if (!xml) { ignorados++; continue; }
      const nsu = Number(entrada?.nsu ?? 0) || 0;
      if (nsu > maiorNsu) maiorNsu = nsu;

      const doc = parseDfeDocumento(xml);
      if (!doc.chave) { ignorados++; continue; }

      // Só grava documentos destinados a esta unidade.
      const destinatario = destinatarioDoXml(xml);
      if (cnpjUnidade && destinatario && destinatario !== cnpjUnidade) { divergentes++; continue; }

      const { data: existente } = await admin
        .from("dfe_documentos").select("id, tipo_documento, nsu")
        .eq("unidade_id", unidadeId).eq("chave", doc.chave).maybeSingle();

      if (doc.tipo === "evento") {
        if (existente) {
          await admin.from("dfe_eventos").insert({
            documento_id: existente.id, unidade_id: unidadeId, empresa_id: empresaId, chave: doc.chave,
            tipo_evento: doc.tipoEvento ?? "desconhecido", descricao: doc.descricaoEvento,
            sucesso: true, payload: { origem: "agente_local", nsu },
          });
          eventos++;
        } else {
          ignorados++;
        }
        continue;
      }

      if (!deveAtualizarDocumento(existente, { tipo: doc.tipo, nsu })) { ignorados++; continue; }

      let xmlPath: string | null = null;
      if (doc.tipo === "completo") {
        xmlPath = `dfe/${unidadeId}/${doc.chave}.xml`;
        const up = await admin.storage.from("contabil-xmls")
          .upload(xmlPath, new Blob([xml], { type: "application/xml" }), { upsert: true });
        if (up.error) { console.warn("[dfe-ingerir] upload xml falhou"); xmlPath = null; }
      }

      const registro = {
        empresa_id: empresaId,
        unidade_id: unidadeId,
        chave: doc.chave,
        nsu: nsu || existente?.nsu || 0,
        tipo_documento: doc.tipo,
        schema_dfe: String(entrada?.schema ?? "") || (doc.tipo === "completo" ? "procNFe" : "resNFe"),
        cnpj_emitente: doc.cnpjEmitente,
        nome_emitente: doc.nomeEmitente,
        ie_emitente: doc.ieEmitente,
        numero: doc.numero,
        serie: doc.serie,
        valor_total: doc.valorTotal,
        data_emissao: doc.dataEmissao,
        situacao_nfe: doc.situacaoNfe,
        digest_value: doc.digestValue,
        xml_completo: doc.tipo === "completo",
        ...(xmlPath ? { xml_path: xmlPath } : {}),
      };

      if (existente) {
        await admin.from("dfe_documentos").update(registro).eq("id", existente.id);
        atualizados++;
      } else {
        const ins = await admin.from("dfe_documentos").insert(registro);
        if (ins.error) { console.warn("[dfe-ingerir] insert falhou"); ignorados++; } else { novos++; }
      }
    }

    // Atualiza o controle de NSU quando o agente informou o avanço da consulta.
    const ultimoNSU = Number(body?.ultimoNSU ?? 0) || maiorNsu;
    const maxNSU = Number(body?.maxNSU ?? 0) || 0;
    if (ultimoNSU || maxNSU) {
      const { data: atual } = await admin
        .from("dfe_nsu_estado").select("ultimo_nsu, max_nsu, documentos_recebidos")
        .eq("unidade_id", unidadeId).maybeSingle();
      await admin.from("dfe_nsu_estado").upsert({
        unidade_id: unidadeId,
        empresa_id: empresaId,
        ultimo_nsu: Math.max(Number(atual?.ultimo_nsu ?? 0), ultimoNSU),
        max_nsu: Math.max(Number(atual?.max_nsu ?? 0), maxNSU),
        ultima_sincronizacao: new Date().toISOString(),
        documentos_recebidos: Number(atual?.documentos_recebidos ?? 0) + novos,
      }, { onConflict: "unidade_id" });
    }

    const partes = [`${novos} novo(s)`, `${atualizados} atualizado(s)`];
    if (eventos) partes.push(`${eventos} evento(s)`);
    if (divergentes) partes.push(`${divergentes} de outro CNPJ ignorado(s)`);

    return json({
      ok: true, novos, atualizados, eventos, ignorados, divergentes,
      ultimoNSU, maxNSU,
      mensagem: novos + atualizados + eventos === 0
        ? "Nenhum documento novo para importar."
        : partes.join(", ") + ".",
    });
  } catch (err) {
    console.error("[dfe-ingerir]", err);
    return json({ ok: false, motivo: "exception", mensagem: String((err as Error)?.message || err) });
  }
});

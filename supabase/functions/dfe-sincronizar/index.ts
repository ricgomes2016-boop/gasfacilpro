// Edge Function: dfe-sincronizar
// Consulta incremental do serviço NFeDistribuicaoDFe (Ambiente Nacional) por NSU,
// usando o certificado A1 (e-CNPJ) da unidade. Idempotente por chave + NSU.
// Sempre responde 200 com { ok: boolean, ... } tipado.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  adminClient, autorizarUnidade, carregarCertificadoUnidade, soapPost, gunzipBase64, pick,
} from "../_shared/nfe-cert.ts";
import { parseDfeDocumento, deveAtualizarDocumento } from "../_shared/dfe-parse.ts";

const URL_DIST = "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
const MAX_LOTES = 5; // cada lote traz até 50 documentos — evita consumo indevido

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface Resultado {
  ok: boolean;
  motivo?: string;
  mensagem?: string;
  novos?: number;
  atualizados?: number;
  lotes?: number;
  ultimoNSU?: number;
  maxNSU?: number;
  cStat?: string | null;
  xMotivo?: string | null;
  podeRepetir?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const unidadeId: string | undefined = body?.unidadeId;
    const reiniciar: boolean = body?.reiniciar === true;
    if (!unidadeId) return json({ ok: false, motivo: "bad_request", mensagem: "unidadeId é obrigatório." } as Resultado);

    const auth = await autorizarUnidade(req, unidadeId);
    if (!auth.ok) return json({ ok: false, motivo: auth.motivo, mensagem: auth.mensagem } as Resultado, auth.status);

    const admin = adminClient();
    const carga = await carregarCertificadoUnidade(admin, unidadeId);
    if (!carga.ok) return json({ ok: false, motivo: carga.motivo, mensagem: carga.mensagem } as Resultado);
    const { cert, cnpj, cUF, unidade } = carga;
    const empresaId = (unidade.empresa_id as string | null) ?? null;

    const { data: estado } = await admin
      .from("dfe_nsu_estado").select("*").eq("unidade_id", unidadeId).maybeSingle();
    let ultimoNSU = reiniciar ? 0 : Number(estado?.ultimo_nsu ?? 0);
    let maxNSU = Number(estado?.max_nsu ?? 0);

    let novos = 0;
    let atualizados = 0;
    let lotes = 0;
    let cStat: string | null = null;
    let xMotivo: string | null = null;

    for (let i = 0; i < MAX_LOTES; i++) {
      const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
<soap12:Body><nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg>
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
<tpAmb>1</tpAmb><cUFAutor>${cUF || "41"}</cUFAutor><CNPJ>${cnpj}</CNPJ>
<distNSU><ultNSU>${String(ultimoNSU).padStart(15, "0")}</ultNSU></distNSU>
</distDFeInt></nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>`;

      const resp = await soapPost(URL_DIST, soap, cert);
      lotes++;
      if (!resp.ok) {
        if (novos === 0 && atualizados === 0) {
          return json({
            ok: false, motivo: "sefaz_indisponivel", podeRepetir: true,
            mensagem: "Não foi possível falar com a SEFAZ agora. Tente novamente em alguns instantes.",
            lotes,
          } as Resultado);
        }
        break;
      }

      cStat = pick(resp.texto, "cStat");
      xMotivo = pick(resp.texto, "xMotivo");
      const ultNSUResp = Number(pick(resp.texto, "ultNSU") ?? 0);
      const maxNSUResp = Number(pick(resp.texto, "maxNSU") ?? 0);
      if (maxNSUResp) maxNSU = maxNSUResp;

      // 656 = consumo indevido; 137 = nenhum documento localizado
      if (cStat === "656") {
        await salvarEstado(admin, unidadeId, empresaId, ultimoNSU, maxNSU, cStat, xMotivo, novos);
        return json({
          ok: false, motivo: "consumo_indevido", podeRepetir: false, cStat, xMotivo, novos, atualizados, lotes,
          mensagem: "A SEFAZ bloqueou temporariamente novas consultas (consumo indevido). Aguarde uma hora antes de sincronizar de novo.",
        } as Resultado);
      }

      const docs = [...resp.texto.matchAll(/<docZip[^>]*NSU="(\d+)"[^>]*>([\s\S]*?)<\/docZip>/gi)];
      for (const [, nsuStr, b64] of docs) {
        const nsu = Number(nsuStr);
        let xml = "";
        try { xml = await gunzipBase64(b64); } catch (_e) { continue; }
        const doc = parseDfeDocumento(xml);
        if (!doc.chave) continue;

        const { data: existente } = await admin
          .from("dfe_documentos").select("id, tipo_documento, nsu, xml_completo, manifestacao")
          .eq("unidade_id", unidadeId).eq("chave", doc.chave).maybeSingle();

        if (doc.tipo === "evento") {
          if (existente) {
            await admin.from("dfe_eventos").insert({
              documento_id: existente.id, unidade_id: unidadeId, empresa_id: empresaId, chave: doc.chave,
              tipo_evento: doc.tipoEvento ?? "desconhecido", descricao: doc.descricaoEvento,
              sucesso: true, payload: { origem: "distribuicao_dfe", nsu },
            });
          }
          if (nsu > ultimoNSU) ultimoNSU = nsu;
          continue;
        }

        if (!deveAtualizarDocumento(existente, { tipo: doc.tipo, nsu })) {
          if (nsu > ultimoNSU) ultimoNSU = nsu;
          continue;
        }

        let xmlPath: string | null = null;
        if (doc.tipo === "completo") {
          xmlPath = `dfe/${unidadeId}/${doc.chave}.xml`;
          const up = await admin.storage.from("contabil-xmls")
            .upload(xmlPath, new Blob([xml], { type: "application/xml" }), { upsert: true });
          if (up.error) { console.warn("[dfe-sincronizar] upload xml:", up.error.message); xmlPath = null; }
        }

        const registro = {
          empresa_id: empresaId,
          unidade_id: unidadeId,
          chave: doc.chave,
          nsu,
          tipo_documento: doc.tipo,
          schema_dfe: doc.tipo === "completo" ? "procNFe" : "resNFe",
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
          if (!ins.error) novos++;
        }
        if (nsu > ultimoNSU) ultimoNSU = nsu;
      }

      if (ultNSUResp > ultimoNSU) ultimoNSU = ultNSUResp;
      // Encerra quando não há mais documentos pendentes
      if (cStat === "137" || docs.length === 0 || ultimoNSU >= maxNSU) break;
    }

    await salvarEstado(admin, unidadeId, empresaId, ultimoNSU, maxNSU, cStat, xMotivo, novos);

    return json({
      ok: true, novos, atualizados, lotes, ultimoNSU, maxNSU, cStat, xMotivo,
      mensagem: novos === 0 && atualizados === 0
        ? (xMotivo || "Nenhum documento novo na SEFAZ.")
        : `${novos} documento(s) novo(s) e ${atualizados} atualizado(s).`,
    } as Resultado);
  } catch (err) {
    console.error("[dfe-sincronizar]", err);
    return json({ ok: false, motivo: "exception", mensagem: String((err as Error)?.message || err) } as Resultado);
  }
});

async function salvarEstado(
  admin: ReturnType<typeof adminClient>,
  unidadeId: string,
  empresaId: string | null,
  ultimoNSU: number,
  maxNSU: number,
  cStat: string | null,
  xMotivo: string | null,
  novos: number,
) {
  const { data: atual } = await admin
    .from("dfe_nsu_estado").select("documentos_recebidos").eq("unidade_id", unidadeId).maybeSingle();
  await admin.from("dfe_nsu_estado").upsert({
    unidade_id: unidadeId,
    empresa_id: empresaId,
    ultimo_nsu: ultimoNSU,
    max_nsu: maxNSU,
    ultima_sincronizacao: new Date().toISOString(),
    ultimo_cstat: cStat,
    ultimo_xmotivo: xMotivo,
    documentos_recebidos: Number(atual?.documentos_recebidos ?? 0) + novos,
  }, { onConflict: "unidade_id" });
}

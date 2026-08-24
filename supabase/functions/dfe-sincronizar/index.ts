// Edge Function: dfe-sincronizar
// Consulta incremental do serviço NFeDistribuicaoDFe (Ambiente Nacional) por NSU.
// O transporte mTLS é delegado ao serviço externo `fiscal-bridge` (o runtime das
// edge functions não conclui o handshake exigido pelo IIS da SEFAZ).
// Idempotente por chave + NSU. Sempre responde 200 com { ok: boolean, ... }.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, autorizarUnidade, carregarCertificadoUnidade } from "../_shared/nfe-cert.ts";
import { parseDfeDocumento, deveAtualizarDocumento } from "../_shared/dfe-parse.ts";
import { bridgeConfigurado, chamarBridge, MENSAGEM_BRIDGE_AUSENTE } from "../_shared/fiscal-bridge.ts";

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
  detalheTecnico?: string | null;
}

interface DocBridge { nsu: number; schema: string | null; xml: string }

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
    // Valida unidade, certificado A1 e CNPJ ANTES de delegar ao bridge.
    const carga = await carregarCertificadoUnidade(admin, unidadeId);
    if (!carga.ok) return json({ ok: false, motivo: carga.motivo, mensagem: carga.mensagem } as Resultado);
    const { cnpj, unidade } = carga;
    const empresaId = (unidade.empresa_id as string | null) ?? null;

    if (!bridgeConfigurado()) {
      return json({
        ok: false, motivo: "bridge_nao_configurado", podeRepetir: false, mensagem: MENSAGEM_BRIDGE_AUSENTE,
      } as Resultado);
    }

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
      const resp = await chamarBridge<{
        cStat: string | null; xMotivo: string | null; ultNSU: number; maxNSU: number;
        documentos: DocBridge[]; detalheTecnico?: string;
      }>("/dfe/distribuicao", { unidadeId, cnpj, ultNSU: ultimoNSU });
      lotes++;

      if (!resp.ok) {
        if (novos === 0 && atualizados === 0) {
          console.error(`[dfe-sincronizar] bridge falhou motivo=${resp.motivo ?? ""}`);
          return json({
            ok: false,
            motivo: resp.motivo || "sefaz_indisponivel",
            podeRepetir: !["bridge_nao_configurado", "bridge_nao_autorizado", "cnpj_divergente", "cert_vencido"].includes(resp.motivo ?? ""),
            mensagem: resp.mensagem || "Não foi possível falar com a SEFAZ agora. Tente novamente em alguns instantes.",
            detalheTecnico: resp.dados?.detalheTecnico ?? null,
            lotes,
          } as Resultado);
        }
        break;
      }

      const dados = resp.dados!;
      cStat = dados.cStat ?? null;
      xMotivo = dados.xMotivo ?? null;
      if (dados.maxNSU) maxNSU = Number(dados.maxNSU);

      // 656 = consumo indevido; 137 = nenhum documento localizado
      if (cStat === "656") {
        await salvarEstado(admin, unidadeId, empresaId, ultimoNSU, maxNSU, cStat, xMotivo, novos);
        return json({
          ok: false, motivo: "consumo_indevido", podeRepetir: false, cStat, xMotivo, novos, atualizados, lotes,
          mensagem: "A SEFAZ bloqueou temporariamente novas consultas (consumo indevido). Aguarde uma hora antes de sincronizar de novo.",
        } as Resultado);
      }

      const docs = dados.documentos ?? [];
      for (const { nsu, xml } of docs) {
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

      if (Number(dados.ultNSU ?? 0) > ultimoNSU) ultimoNSU = Number(dados.ultNSU);
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

// TEMPORÁRIO: diagnóstico de transporte mTLS com a SEFAZ.
// Não expõe certificado, chave, senha, CNPJ ou XML — apenas categoria/erro sanitizado.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, carregarCertificadoUnidade, soapPost, classificarErroRede } from "../_shared/nfe-cert.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const token = req.headers.get("x-diag-token") || "";
  if (!token || token !== Deno.env.get("DFE_DIAG_TOKEN")) return json({ ok: false, motivo: "forbidden" }, 403);

  const { unidadeId } = await req.json().catch(() => ({ unidadeId: null }));
  if (!unidadeId) return json({ ok: false, motivo: "bad_request" });

  const runtime = {
    createHttpClient: typeof (Deno as any).createHttpClient,
    denoVersion: (Deno as any).version?.deno ?? null,
  };

  const carga = await carregarCertificadoUnidade(adminClient(), unidadeId);
  if (!carga.ok) return json({ ok: false, etapa: "certificado", motivo: carga.motivo, runtime });

  const cert = carga.cert;
  const formato = {
    certPemBlocos: (cert.certPem.match(/BEGIN CERTIFICATE/g) || []).length,
    chaveHeader: (cert.keyPem.match(/-----BEGIN ([A-Z ]+)-----/) || [, "?"])[1],
  };

  // 1) O client mTLS pode ser criado?
  const variantes: Array<[string, Record<string, unknown>]> = [
    ["cert+key+http1", { cert: cert.certPem, key: cert.keyPem, http1: true, http2: false }],
    ["cert+key", { cert: cert.certPem, key: cert.keyPem }],
    ["certChain+privateKey", { certChain: cert.certPem, privateKey: cert.keyPem }],
  ];
  const criacao: Record<string, string> = {};
  for (const [nome, opts] of variantes) {
    try {
      const c = (Deno as any).createHttpClient(opts);
      criacao[nome] = "ok";
      try { c?.close?.(); } catch (_e) { /* noop */ }
    } catch (e) {
      criacao[nome] = classificarErroRede(e).detalhe;
    }
  }

  // 2) Egress simples sem mTLS (isola DNS/firewall)
  let egress = "?";
  try {
    const r = await fetch("https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx?wsdl", {
      method: "GET",
      signal: AbortSignal.timeout(15000),
    });
    egress = `HTTP ${r.status}`;
    await r.text();
  } catch (e) {
    egress = classificarErroRede(e).detalhe;
  }

  // 3) Chamada SOAP real (1 tentativa)
  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>
<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg>
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>1</tpAmb><cUFAutor>${carga.cUF || "41"}</cUFAutor>
<CNPJ>${carga.cnpj}</CNPJ><distNSU><ultNSU>000000000000000</ultNSU></distNSU></distDFeInt>
</nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>`;
  const resp = await soapPost("https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx", soap, cert, 1);
  const cStat = resp.ok ? (resp.texto.match(/<cStat>(\d+)<\/cStat>/)?.[1] ?? null) : null;

  return json({
    ok: resp.ok,
    runtime,
    formato,
    criacao,
    egress,
    soap: resp.ok ? { status: "resposta_recebida", bytes: resp.texto.length, cStat } : { categoria: resp.categoria, erro: resp.erro },
  });
});

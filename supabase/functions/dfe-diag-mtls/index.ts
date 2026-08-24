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

  // 2) Probes de transporte
  const probes: Record<string, string> = {};
  const probe = async (nome: string, opts: Record<string, unknown> | null, url: string) => {
    let c: any = null;
    try {
      if (opts) c = (Deno as any).createHttpClient(opts);
      const r = await fetch(url, {
        method: "GET",
        ...(c ? { client: c } : {}),
        signal: AbortSignal.timeout(15000),
      } as any);
      const t = await r.text();
      probes[nome] = `HTTP ${r.status} bytes=${t.length}`;
    } catch (e) {
      probes[nome] = classificarErroRede(e).detalhe;
    } finally {
      try { c?.close?.(); } catch (_e) { /* noop */ }
    }
  };
  const WSDL = "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx?wsdl";
  await probe("sem_client", null, WSDL);
  await probe("controle_http1_example", { http1: true, http2: false }, "https://example.com/");
  await probe("so_http1_true", { http1: true }, WSDL);
  await probe("so_http2_false", { http2: false }, WSDL);
  await probe("http1_com_cert_e_http2false", { cert: cert.certPem, key: cert.keyPem, http1: true, http2: false }, WSDL);
  await probe("client_http1_sem_cert", { http1: true, http2: false }, WSDL);
  await probe("client_http1_com_cert", { cert: cert.certPem, key: cert.keyPem, http1: true, http2: false }, WSDL);
  await probe("client_com_cert_default", { cert: cert.certPem, key: cert.keyPem }, WSDL);
  const egress = probes["sem_client"];

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
    probes,
    soap: resp.ok ? { status: "resposta_recebida", bytes: resp.texto.length, cStat } : { categoria: resp.categoria, erro: resp.erro },
  });
});

// Edge Function: baixar-nfe-chave
// Baixa o XML de uma NF-e a partir da chave de acesso (44 dígitos) usando o
// certificado digital A1 cadastrado na unidade (mTLS com a SEFAZ Nacional —
// serviço NFeDistribuicaoDFe / consChNFe).
// Sempre retorna 200 OK; em erro retorna { ok: false, motivo, mensagem }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import forge from "npm:node-forge@1.3.1";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UF_CODIGO: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
  MG: "31", ES: "32", RJ: "33", SP: "35",
  PR: "41", SC: "42", RS: "43",
  MS: "50", MT: "51", GO: "52", DF: "53",
};

function abrirPfx(pfxBytes: Uint8Array, senha: string) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < pfxBytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, pfxBytes.subarray(i, i + chunk) as any);
  }
  const asn1 = forge.asn1.fromDer(bin);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  if (!certBags.length || !certBags[0].cert) throw new Error("pfx_sem_certificado");

  const keyBags =
    (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [])
      .concat(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []);
  if (!keyBags.length || !keyBags[0].key) throw new Error("pfx_sem_chave");

  // Monta a cadeia completa (certificado do titular primeiro)
  const cn = certBags[0].cert.subject.getField("CN")?.value || "";
  const pemChain = certBags.map((b: any) => forge.pki.certificateToPem(b.cert)).join("\n");
  const pemKey = forge.pki.privateKeyToPem(keyBags[0].key);

  const notAfter: Date = certBags[0].cert.validity.notAfter;
  const cnpjMatch = String(cn).match(/(\d{14})/);

  return {
    certPem: pemChain,
    keyPem: pemKey,
    titular: String(cn).replace(/:\d{14}$/, "").trim(),
    cnpj: cnpjMatch ? cnpjMatch[1] : null,
    vencido: notAfter < new Date(),
  };
}

async function gunzipBase64(b64: string): Promise<string> {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

function pick(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1].trim() : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ ok: false, motivo: "unauthorized", mensagem: "Não autenticado." }, 401);
    }
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims) {
      return json({ ok: false, motivo: "unauthorized", mensagem: "Sessão inválida." }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const unidadeId: string | undefined = body?.unidadeId;
    const chave: string = String(body?.chave || "").replace(/\D/g, "");

    if (!unidadeId) return json({ ok: false, motivo: "bad_request", mensagem: "unidadeId é obrigatório." });
    if (chave.length !== 44) {
      return json({ ok: false, motivo: "chave_invalida", mensagem: "A chave da NF-e deve ter 44 dígitos." });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: hasAcc } = await admin.rpc("user_has_unidade", {
      _user_id: userId,
      _unidade_id: unidadeId,
    });
    if (!hasAcc) return json({ ok: false, motivo: "forbidden", mensagem: "Sem acesso a esta unidade." });

    const { data: unidade } = await admin
      .from("unidades")
      .select("certificado_a1_path, certificado_a1_senha, cnpj, estado")
      .eq("id", unidadeId)
      .maybeSingle();

    if (!unidade) return json({ ok: false, motivo: "unidade_nao_encontrada", mensagem: "Unidade não encontrada." });

    const pfxPath = unidade.certificado_a1_path as string | null;
    const pfxSenha = unidade.certificado_a1_senha as string | null;
    if (!pfxPath || !pfxSenha) {
      return json({
        ok: false,
        motivo: "cert_nao_cadastrado",
        mensagem: "Certificado A1 não cadastrado nesta unidade. Configure em Configurações › Unidades.",
      });
    }

    const { data: pfxBlob, error: dlErr } = await admin.storage
      .from("certificados-fiscais")
      .download(pfxPath);
    if (dlErr || !pfxBlob) {
      return json({ ok: false, motivo: "pfx_nao_encontrado", mensagem: "Arquivo do certificado não encontrado." });
    }

    let cert;
    try {
      cert = abrirPfx(new Uint8Array(await pfxBlob.arrayBuffer()), pfxSenha);
    } catch (e: any) {
      const msg = String(e?.message || e);
      const motivo = /MAC|password|invalid|integrity/i.test(msg) ? "senha_invalida" : "pfx_invalido";
      return json({
        ok: false,
        motivo,
        mensagem: motivo === "senha_invalida"
          ? "Senha do certificado inválida. Atualize em Configurações › Unidades."
          : "Não foi possível abrir o certificado A1.",
      });
    }
    if (cert.vencido) {
      return json({ ok: false, motivo: "cert_vencido", mensagem: "Certificado A1 vencido." });
    }

    const cnpjAutor = (unidade.cnpj || "").replace(/\D/g, "") || cert.cnpj || "";
    if (cnpjAutor.length !== 14) {
      return json({
        ok: false,
        motivo: "cnpj_ausente",
        mensagem: "CNPJ da unidade não cadastrado — necessário para consultar a SEFAZ.",
      });
    }
    const cUF = UF_CODIGO[String(unidade.estado || "").toUpperCase()] || chave.slice(0, 2);

    const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
<soap12:Body>
<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
<nfeDadosMsg>
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
<tpAmb>1</tpAmb>
<cUFAutor>${cUF}</cUFAutor>
<CNPJ>${cnpjAutor}</CNPJ>
<consChNFe><chNFe>${chave}</chNFe></consChNFe>
</distDFeInt>
</nfeDadosMsg>
</nfeDistDFeInteresse>
</soap12:Body>
</soap12:Envelope>`;

    let respText = "";
    let client: any;
    try {
      // mTLS com o certificado A1 da unidade
      client = (Deno as any).createHttpClient({
        cert: cert.certPem,
        key: cert.keyPem,
      });
      const resp = await fetch(
        "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
        {
          method: "POST",
          // @ts-expect-error client é específico do Deno
          client,
          headers: { "Content-Type": "application/soap+xml; charset=utf-8" },
          body: soap,
        },
      );
      respText = await resp.text();
    } catch (e: any) {
      return json({
        ok: false,
        motivo: "sefaz_indisponivel",
        mensagem: "Não foi possível conectar à SEFAZ com o certificado: " + String(e?.message || e),
      });
    } finally {
      try { client?.close?.(); } catch (_e) { /* noop */ }
    }

    const cStat = pick(respText, "cStat");
    const xMotivo = pick(respText, "xMotivo") || "";
    const docZip = respText.match(/<docZip[^>]*>([\s\S]*?)<\/docZip>/i)?.[1];

    if (!docZip) {
      return json({
        ok: false,
        motivo: "nfe_nao_disponivel",
        cStat,
        mensagem: cStat === "137" || /nenhum documento/i.test(xMotivo)
          ? "A SEFAZ não retornou o XML desta chave. Normalmente é preciso fazer a Manifestação do Destinatário (Ciência da Operação) ou a nota não é destinada a este CNPJ."
          : `SEFAZ ${cStat || ""}: ${xMotivo || "documento indisponível"}`,
      });
    }

    let xml = "";
    try {
      xml = await gunzipBase64(docZip);
    } catch (_e) {
      return json({ ok: false, motivo: "descompactacao_falhou", mensagem: "Falha ao descompactar o XML da SEFAZ." });
    }

    if (!/<infNFe/i.test(xml)) {
      return json({
        ok: false,
        motivo: "apenas_resumo",
        mensagem: "A SEFAZ retornou apenas o resumo da nota (sem itens). Faça a Manifestação do Destinatário para liberar o XML completo.",
      });
    }

    return json({ ok: true, xml, chave, titular: cert.titular });
  } catch (err: any) {
    console.error("[baixar-nfe-chave]", err);
    return json({ ok: false, motivo: "exception", mensagem: String(err?.message || err) });
  }
});

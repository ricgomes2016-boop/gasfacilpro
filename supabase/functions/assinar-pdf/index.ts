// Edge Function: assinar-pdf
// Assina um PDF (PAdES) usando o certificado A1 (.pfx) cadastrado em `unidades`.
// Sempre retorna 200 OK; em caso de erro retorna { ok: false, motivo, mensagem }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import forge from "npm:node-forge@1.3.1";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
// @ts-ignore - sem tipos para esses pacotes
import { SignPdf } from "npm:@signpdf/signpdf@3.2.4";
// @ts-ignore
import { P12Signer } from "npm:@signpdf/signer-p12@3.2.4";
// @ts-ignore
import { pdflibAddPlaceholder } from "npm:@signpdf/placeholder-pdf-lib@3.2.4";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as any);
  }
  return btoa(s);
}

function extrairTitularDoPfx(pfxBytes: Uint8Array, senha: string): { titular: string; cnpj: string | null } | null {
  try {
    const der = forge.util.createBuffer(pfxBytes as any);
    const asn1 = forge.asn1.fromDer(der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
    if (!certBags.length) return null;
    const cert = certBags[0].cert;
    if (!cert) return null;
    const cn = cert.subject.getField("CN")?.value || "";
    // Tenta extrair CNPJ do CN (padrão ICP-Brasil: "RAZÃO SOCIAL:CNPJ")
    const m = cn.match(/(\d{14})/);
    return { titular: cn.replace(/:\d{14}$/, "").trim(), cnpj: m ? m[1] : null };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, motivo: "unauthorized", mensagem: "Sessão inválida." });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ ok: false, motivo: "unauthorized", mensagem: "Sessão inválida." });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const pdfBase64: string | undefined = body?.pdfBase64;
    const unidadeId: string | undefined = body?.unidadeId;
    const motivo: string = String(body?.motivo || "Assinatura digital").slice(0, 200);
    const local: string = String(body?.local || "Brasil").slice(0, 100);
    const contato: string = String(body?.contato || "").slice(0, 200);

    if (!pdfBase64 || !unidadeId) {
      return json({ ok: false, motivo: "bad_request", mensagem: "pdfBase64 e unidadeId são obrigatórios." });
    }

    // Service-role para acessar storage privado e ler senha
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verifica que o usuário pertence à unidade
    const { data: hasAcc } = await supabaseAdmin.rpc("user_has_unidade", {
      _user_id: userId,
      _unidade_id: unidadeId,
    });
    if (!hasAcc) {
      return json({ ok: false, motivo: "forbidden", mensagem: "Sem acesso a esta unidade." });
    }

    const { data: unidade, error: uErr } = await supabaseAdmin
      .from("unidades")
      .select("certificado_a1_path, certificado_a1_senha, certificado_a1_validade, certificado_a1_titular")
      .eq("id", unidadeId)
      .maybeSingle();
    if (uErr || !unidade) {
      return json({ ok: false, motivo: "unidade_nao_encontrada", mensagem: "Unidade não encontrada." });
    }

    const pfxPath: string | null = unidade.certificado_a1_path;
    const pfxSenha: string | null = unidade.certificado_a1_senha;
    if (!pfxPath || !pfxSenha) {
      return json({
        ok: false,
        motivo: "cert_nao_cadastrado",
        mensagem: "Certificado A1 não está cadastrado para esta unidade. Configure em Configurações › Unidades.",
      });
    }
    if (unidade.certificado_a1_validade && new Date(unidade.certificado_a1_validade) < new Date()) {
      return json({
        ok: false,
        motivo: "cert_vencido",
        mensagem: "Certificado A1 vencido. Atualize em Configurações › Unidades.",
      });
    }

    // Baixa o .pfx do bucket privado
    const { data: pfxBlob, error: dlErr } = await supabaseAdmin.storage
      .from("certificados-fiscais")
      .download(pfxPath);
    if (dlErr || !pfxBlob) {
      return json({ ok: false, motivo: "pfx_download_falhou", mensagem: dlErr?.message || "Falha ao baixar certificado." });
    }
    const pfxBytes = new Uint8Array(await pfxBlob.arrayBuffer());

    // Valida senha + extrai titular
    const info = extrairTitularDoPfx(pfxBytes, pfxSenha);
    if (!info) {
      return json({ ok: false, motivo: "pfx_invalido", mensagem: "Não foi possível abrir o certificado com a senha cadastrada." });
    }

    // Carrega PDF e adiciona placeholder
    const pdfBytes = b64ToBytes(pdfBase64);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    pdflibAddPlaceholder({
      pdfDoc,
      reason: motivo,
      contactInfo: contato || (info.cnpj ? `CNPJ ${info.cnpj}` : info.titular),
      name: info.titular,
      location: local,
      signatureLength: 16384,
    });

    const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });

    // Assina (CMS PKCS#7 detached)
    // @ts-ignore - Buffer disponível via shim do Deno para npm:
    const buf = (globalThis as any).Buffer.from(pdfWithPlaceholder);
    const signer = new P12Signer((globalThis as any).Buffer.from(pfxBytes), { passphrase: pfxSenha });
    const signedBuf = await new SignPdf().sign(buf, signer);
    const signedBytes = new Uint8Array(signedBuf.buffer, signedBuf.byteOffset, signedBuf.byteLength);

    return json({
      ok: true,
      pdfBase64Assinado: bytesToB64(signedBytes),
      titular: info.titular,
      cnpj: info.cnpj,
      assinadoEm: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[assinar-pdf] erro:", e);
    return json({ ok: false, motivo: "exception", mensagem: e?.message || "Erro inesperado." });
  }
});

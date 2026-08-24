// Utilitários compartilhados para comunicação mTLS com a SEFAZ usando o
// certificado A1 (.pfx) armazenado no bucket privado `certificados-fiscais`.
// NUNCA retorne certificado/senha em respostas ou logs.

import forge from "npm:node-forge@1.3.1";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const UF_CODIGO: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
  MG: "31", ES: "32", RJ: "33", SP: "35",
  PR: "41", SC: "42", RS: "43",
  MS: "50", MT: "51", GO: "52", DF: "53",
};

export interface CertificadoAberto {
  certPem: string;
  keyPem: string;
  /** PEM apenas do certificado do titular (para o bloco X509Certificate). */
  certBase64: string;
  privateKey: unknown;
  titular: string;
  cnpj: string | null;
  vencido: boolean;
  validade: string | null;
}

export function abrirPfx(pfxBytes: Uint8Array, senha: string): CertificadoAberto {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < pfxBytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, pfxBytes.subarray(i, i + chunk) as unknown as number[]);
  }
  const asn1 = forge.asn1.fromDer(bin);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  if (!certBags.length || !certBags[0].cert) throw new Error("pfx_sem_certificado");

  const keyBags = (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
    forge.pki.oids.pkcs8ShroudedKeyBag
  ] || []).concat(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []);
  if (!keyBags.length || !keyBags[0].key) throw new Error("pfx_sem_chave");

  const cert = certBags[0].cert;
  const cn = cert.subject.getField("CN")?.value || "";
  const pemChain = certBags.map((b: any) => forge.pki.certificateToPem(b.cert)).join("\n");
  const pemKey = forge.pki.privateKeyToPem(keyBags[0].key);
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const cnpjMatch = String(cn).match(/(\d{14})/);

  return {
    certPem: pemChain,
    keyPem: pemKey,
    certBase64: forge.util.encode64(der),
    privateKey: keyBags[0].key,
    titular: String(cn).replace(/:\d{14}$/, "").trim(),
    cnpj: cnpjMatch ? cnpjMatch[1] : null,
    vencido: cert.validity.notAfter < new Date(),
    validade: cert.validity.notAfter?.toISOString?.() ?? null,
  };
}

export type CarregarCertificadoResultado =
  | { ok: true; cert: CertificadoAberto; cnpj: string; cUF: string; unidade: Record<string, unknown> }
  | { ok: false; motivo: string; mensagem: string };

export async function carregarCertificadoUnidade(
  admin: SupabaseClient,
  unidadeId: string,
): Promise<CarregarCertificadoResultado> {
  const { data: unidade } = await admin
    .from("unidades")
    .select("id, empresa_id, nome, certificado_a1_path, certificado_a1_senha, cnpj, estado")
    .eq("id", unidadeId)
    .maybeSingle();

  if (!unidade) return { ok: false, motivo: "unidade_nao_encontrada", mensagem: "Unidade não encontrada." };

  const pfxPath = unidade.certificado_a1_path as string | null;
  const pfxSenha = unidade.certificado_a1_senha as string | null;
  if (!pfxPath || !pfxSenha) {
    return {
      ok: false,
      motivo: "cert_nao_cadastrado",
      mensagem: "Certificado A1 (e-CNPJ) não cadastrado nesta unidade. Configure em Configurações › Unidades.",
    };
  }

  const { data: pfxBlob, error: dlErr } = await admin.storage.from("certificados-fiscais").download(pfxPath);
  if (dlErr || !pfxBlob) {
    return { ok: false, motivo: "pfx_nao_encontrado", mensagem: "Arquivo do certificado não encontrado no cofre." };
  }

  let cert: CertificadoAberto;
  try {
    cert = abrirPfx(new Uint8Array(await pfxBlob.arrayBuffer()), pfxSenha);
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    const senhaRuim = /MAC|password|invalid|integrity/i.test(msg);
    return {
      ok: false,
      motivo: senhaRuim ? "senha_invalida" : "pfx_invalido",
      mensagem: senhaRuim
        ? "Senha do certificado inválida. Atualize em Configurações › Unidades."
        : "Não foi possível abrir o certificado A1.",
    };
  }
  if (cert.vencido) {
    return { ok: false, motivo: "cert_vencido", mensagem: "Certificado A1 vencido. Cadastre um certificado válido." };
  }

  const cnpj = String(unidade.cnpj || "").replace(/\D/g, "") || cert.cnpj || "";
  if (cnpj.length !== 14) {
    return {
      ok: false,
      motivo: "cnpj_ausente",
      mensagem: "CNPJ da unidade não cadastrado — obrigatório para consultar a SEFAZ.",
    };
  }
  if (cert.cnpj && cert.cnpj !== cnpj) {
    return {
      ok: false,
      motivo: "cnpj_divergente",
      mensagem: "O CNPJ do certificado digital não corresponde ao CNPJ da unidade selecionada.",
    };
  }

  const cUF = UF_CODIGO[String(unidade.estado || "").toUpperCase()] || "";
  return { ok: true, cert, cnpj, cUF, unidade: unidade as Record<string, unknown> };
}

/** POST SOAP com mTLS, HTTP/1.1 e retentativas (a SEFAZ derruba HTTP/2). */
export async function soapPost(
  url: string,
  soap: string,
  cert: CertificadoAberto,
  tentativas = 3,
): Promise<{ ok: boolean; texto: string; erro?: string }> {
  let ultimoErro = "";
  for (let t = 1; t <= tentativas; t++) {
    let client: unknown;
    try {
      try {
        client = (Deno as any).createHttpClient({ cert: cert.certPem, key: cert.keyPem, http1: true, http2: false });
      } catch (_e) {
        client = (Deno as any).createHttpClient({ cert: cert.certPem, key: cert.keyPem });
      }
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 25000);
      const resp = await fetch(url, {
        method: "POST",
        // @ts-expect-error client é específico do Deno
        client,
        headers: {
          "Content-Type": "application/soap+xml; charset=utf-8",
          "Connection": "close",
          "Accept": "application/soap+xml, text/xml",
        },
        body: soap,
        signal: ac.signal,
      });
      clearTimeout(timer);
      const texto = await resp.text();
      if (!texto) {
        ultimoErro = `HTTP ${resp.status}`;
        throw new Error(ultimoErro);
      }
      return { ok: true, texto };
    } catch (e) {
      const err = e as Error;
      ultimoErro = err?.name === "AbortError" ? "Tempo esgotado (25s) aguardando a SEFAZ" : String(err?.message || e);
      if (t < tentativas) await new Promise((r) => setTimeout(r, t * 1200));
    } finally {
      try { (client as any)?.close?.(); } catch (_e) { /* noop */ }
    }
  }
  return { ok: false, texto: "", erro: ultimoErro };
}

export async function gunzipBase64(b64: string): Promise<string> {
  const bin = atob(String(b64).replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

export function pick(xml: string, tagName: string): string | null {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tagName}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tagName}>`, "i"));
  return m ? m[1].trim() : null;
}

export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** Valida sessão e acesso do usuário à unidade. */
export async function autorizarUnidade(
  req: Request,
  unidadeId: string,
): Promise<{ ok: true; userId: string } | { ok: false; motivo: string; mensagem: string; status: number }> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, motivo: "unauthorized", mensagem: "Não autenticado.", status: 401 };
  }
  const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error } = await supabaseUser.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (error || !claimsData?.claims) {
    return { ok: false, motivo: "unauthorized", mensagem: "Sessão inválida.", status: 401 };
  }
  const userId = claimsData.claims.sub as string;
  const admin = adminClient();
  const { data: hasAcc } = await admin.rpc("user_has_unidade", { _user_id: userId, _unidade_id: unidadeId });
  if (!hasAcc) {
    return { ok: false, motivo: "forbidden", mensagem: "Sem acesso a esta unidade.", status: 403 };
  }
  return { ok: true, userId };
}

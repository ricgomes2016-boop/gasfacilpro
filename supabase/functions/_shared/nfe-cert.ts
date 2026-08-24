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

  // O bag do titular é o certificado folha (não-CA). Rustls (Deno) exige a
  // cadeia com a folha PRIMEIRO; a ordem dos bags do PKCS#12 não é garantida.
  const isCa = (c: any) => {
    try {
      const bc = c.getExtension("basicConstraints");
      return !!(bc && bc.cA);
    } catch (_e) { return false; }
  };
  const folhaBag = certBags.find((b: any) => b.cert && !isCa(b.cert)) || certBags[0];
  const cert = folhaBag.cert;
  const cn = cert.subject.getField("CN")?.value || "";
  const ordenados = [folhaBag, ...certBags.filter((b: any) => b !== folhaBag && b.cert)];
  const pemChain = ordenados.map((b: any) => forge.pki.certificateToPem(b.cert).trim()).join("\n") + "\n";
  // Rustls só aceita chave em PKCS#8 ("BEGIN PRIVATE KEY"); node-forge emite
  // PKCS#1 ("BEGIN RSA PRIVATE KEY") por padrão, o que o Deno rejeita.
  const rsaKey = keyBags[0].key;
  const pemKey = forge.pki.privateKeyInfoToPem(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(rsaKey)));
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const cnpjMatch = String(cn).match(/(\d{14})/);

  return {
    certPem: pemChain,
    keyPem: pemKey,
    certBase64: forge.util.encode64(der),
    privateKey: rsaKey,
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

/** Categoriza um erro de rede/TLS sem jamais expor segredos. */
export function classificarErroRede(e: unknown): { categoria: string; detalhe: string } {
  const err = e as Error;
  const nome = err?.name || "Error";
  const bruto = String(err?.message || e || "");
  // Sanitiza: remove qualquer bloco PEM, base64 longo ou sequência de 14 dígitos (CNPJ)
  const detalhe = bruto
    .replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, "[pem]")
    .replace(/[A-Za-z0-9+/=]{60,}/g, "[base64]")
    .replace(/\d{11,}/g, "[num]")
    .slice(0, 300);
  const m = detalhe.toLowerCase();
  let categoria = "rede_desconhecida";
  if (nome === "AbortError" || /timed out|timeout/.test(m)) categoria = "timeout_sefaz";
  else if (/dns|name resolution|lookup|nodename/.test(m)) categoria = "dns_falhou";
  else if (/certificate required|bad certificate|certificate unknown|access denied|unknown ca|cert.*reject|handshakefailure|alert/.test(m)) categoria = "tls_certificado_rejeitado";
  else if (/invalid|decode|pkcs|private key|no keys|malformed/.test(m) && /key|cert/.test(m)) categoria = "cert_formato_invalido";
  else if (/handshake|tls|ssl|protocol/.test(m)) categoria = "tls_handshake_falhou";
  else if (/not supported|unsupported|is not a function|unstable/.test(m)) categoria = "runtime_sem_mtls";
  else if (/connection|refused|reset|closed|broken pipe|os error/.test(m)) categoria = "conexao_interrompida";
  else if (/^http \d{3}/.test(m)) categoria = "http_erro";
  return { categoria, detalhe: `${nome}: ${detalhe}` };
}

/** Cria o cliente mTLS testando as variantes de API suportadas pelo runtime. */
function criarClienteMtls(cert: CertificadoAberto): { client: unknown; variante: string } {
  const criar = (Deno as any).createHttpClient;
  if (typeof criar !== "function") throw new Error("Deno.createHttpClient não disponível neste runtime");
  const variantes: Array<[string, Record<string, unknown>]> = [
    ["cert+key+http1", { cert: cert.certPem, key: cert.keyPem, http1: true, http2: false }],
    ["cert+key", { cert: cert.certPem, key: cert.keyPem }],
    ["certChain+privateKey", { certChain: cert.certPem, privateKey: cert.keyPem }],
  ];
  let ultimo: unknown;
  for (const [variante, opts] of variantes) {
    try {
      return { client: criar(opts), variante };
    } catch (e) { ultimo = e; }
  }
  throw ultimo instanceof Error ? ultimo : new Error(String(ultimo));
}

/** POST SOAP com mTLS, HTTP/1.1 e retentativas (a SEFAZ derruba HTTP/2). */
export async function soapPost(
  url: string,
  soap: string,
  cert: CertificadoAberto,
  tentativas = 3,
): Promise<{ ok: boolean; texto: string; erro?: string; categoria?: string }> {
  let ultimoErro = "";
  let ultimaCategoria = "rede_desconhecida";
  const host = (() => { try { return new URL(url).host; } catch { return "?"; } })();

  for (let t = 1; t <= tentativas; t++) {
    let client: unknown;
    try {
      const criado = criarClienteMtls(cert);
      client = criado.client;
      console.log(`[soapPost] tentativa=${t} host=${host} clienteMtls=${criado.variante}`);
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 25000);
      let resp: Response;
      try {
        resp = await fetch(url, {
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
      } finally {
        clearTimeout(timer);
      }
      const texto = await resp.text();
      if (!resp.ok && !texto) {
        ultimaCategoria = "http_erro";
        throw new Error(`HTTP ${resp.status}`);
      }
      if (!texto) {
        ultimaCategoria = "resposta_vazia";
        throw new Error(`HTTP ${resp.status} sem corpo`);
      }
      console.log(`[soapPost] ok status=${resp.status} bytes=${texto.length} tentativa=${t}`);
      return { ok: true, texto };
    } catch (e) {
      const { categoria, detalhe } = classificarErroRede(e);
      ultimaCategoria = categoria === "rede_desconhecida" ? ultimaCategoria : categoria;
      ultimoErro = detalhe;
      console.error(`[soapPost] falha tentativa=${t} host=${host} categoria=${ultimaCategoria} erro=${detalhe}`);
      if (t < tentativas) await new Promise((r) => setTimeout(r, t * 1200));
    } finally {
      try { (client as any)?.close?.(); } catch (_e) { /* noop */ }
    }
  }
  // Fallback: fala HTTP/1.1 direto sobre TLS (o fetch do runtime negocia HTTP/2,
  // que a SEFAZ recusa, e ao forçar http1 o hyper é resetado pelo servidor).
  try {
    console.log(`[soapPost] fallback http1-tls host=${host}`);
    const r = await postHttp1Tls(url, soap, {
      "Content-Type": "application/soap+xml; charset=utf-8",
      "Accept": "application/soap+xml, text/xml",
    }, cert);
    if (r.body) {
      console.log(`[soapPost] fallback ok status=${r.status} bytes=${r.body.length}`);
      return { ok: true, texto: r.body };
    }
    ultimoErro = `HTTP ${r.status} sem corpo (fallback)`;
    ultimaCategoria = "resposta_vazia";
  } catch (e) {
    const { categoria, detalhe } = classificarErroRede(e);
    console.error(`[soapPost] fallback falhou host=${host} categoria=${categoria} erro=${detalhe}`);
    // Reset imediato no caminho do webservice = o servidor exige renegociação
    // TLS 1.2 para autenticação por certificado, não suportada pelo runtime.
    ultimaCategoria = categoria === "conexao_interrompida" ? "tls_mtls_nao_suportado" : categoria;
    ultimoErro = detalhe;
  }

  return { ok: false, texto: "", erro: ultimoErro, categoria: ultimaCategoria };

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

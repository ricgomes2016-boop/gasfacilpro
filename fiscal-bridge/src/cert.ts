import { createClient } from "@supabase/supabase-js";
import forge from "node-forge";
import { carregarConfig } from "./config.js";

/**
 * O PFX é buscado sob demanda no storage privado e mantido APENAS em memória
 * durante a chamada. Nunca é gravado em disco nem devolvido ao chamador.
 */
export interface CertificadoUnidade {
  pfx: Buffer;
  senha: string;
  cnpjUnidade: string;
  cnpjCertificado: string | null;
  estado: string | null;
  empresaId: string | null;
  titular: string;
  validade: Date;
  /** PEM da chave privada e DER base64 do certificado — usados só na assinatura XMLDSig. */
  privateKey: forge.pki.rsa.PrivateKey;
  certBase64: string;
}

export type CargaCertificado =
  | { ok: true; cert: CertificadoUnidade }
  | { ok: false; motivo: string; mensagem: string };

function admin() {
  const cfg = carregarConfig();
  return createClient(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, { auth: { persistSession: false } });
}

function abrirPfx(pfx: Buffer, senha: string) {
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString("binary")));
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  if (!certBags.length || !certBags[0].cert) throw new Error("pfx_sem_certificado");
  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ];
  if (!keyBags.length || !keyBags[0].key) throw new Error("pfx_sem_chave");

  const isCa = (c: forge.pki.Certificate) => {
    try {
      const bc = c.getExtension("basicConstraints") as { cA?: boolean } | undefined;
      return !!bc?.cA;
    } catch {
      return false;
    }
  };
  const folha = certBags.find((b) => b.cert && !isCa(b.cert))?.cert ?? certBags[0].cert!;
  const cn = String(folha.subject.getField("CN")?.value ?? "");
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(folha)).getBytes();

  return {
    titular: cn.replace(/:\d{14}$/, "").trim(),
    cnpjCertificado: cn.match(/(\d{14})/)?.[1] ?? null,
    validade: folha.validity.notAfter,
    privateKey: keyBags[0].key as forge.pki.rsa.PrivateKey,
    certBase64: forge.util.encode64(der),
  };
}

/** Carrega e valida o certificado A1 da unidade a partir do storage privado. */
export async function carregarCertificado(unidadeId: string): Promise<CargaCertificado> {
  const cfg = carregarConfig();
  const db = admin();

  const { data: unidade, error } = await db
    .from("unidades")
    .select("id, empresa_id, certificado_a1_path, certificado_a1_senha, cnpj, estado")
    .eq("id", unidadeId)
    .maybeSingle();

  if (error) return { ok: false, motivo: "banco_indisponivel", mensagem: "Falha ao consultar a unidade." };
  if (!unidade) return { ok: false, motivo: "unidade_nao_encontrada", mensagem: "Unidade não encontrada." };

  const caminho = unidade.certificado_a1_path as string | null;
  const senha = unidade.certificado_a1_senha as string | null;
  if (!caminho || !senha) {
    return { ok: false, motivo: "cert_nao_cadastrado", mensagem: "Certificado A1 não cadastrado nesta unidade." };
  }

  const { data: blob, error: dlErr } = await db.storage.from(cfg.bucketCertificados).download(caminho);
  if (dlErr || !blob) {
    return { ok: false, motivo: "pfx_nao_encontrado", mensagem: "Arquivo do certificado não encontrado no cofre." };
  }
  const pfx = Buffer.from(await blob.arrayBuffer());

  let aberto: ReturnType<typeof abrirPfx>;
  try {
    aberto = abrirPfx(pfx, senha);
  } catch (e) {
    const msg = String((e as Error)?.message ?? "");
    const senhaRuim = /MAC|password|invalid|integrity/i.test(msg);
    return {
      ok: false,
      motivo: senhaRuim ? "senha_invalida" : "pfx_invalido",
      mensagem: senhaRuim ? "Senha do certificado inválida." : "Não foi possível abrir o certificado A1.",
    };
  }

  if (aberto.validade < new Date()) {
    return { ok: false, motivo: "cert_vencido", mensagem: "Certificado A1 vencido." };
  }

  const cnpjUnidade = String(unidade.cnpj ?? "").replace(/\D/g, "");
  if (cnpjUnidade.length !== 14) {
    return { ok: false, motivo: "cnpj_ausente", mensagem: "CNPJ da unidade não cadastrado." };
  }
  if (aberto.cnpjCertificado && aberto.cnpjCertificado !== cnpjUnidade) {
    return {
      ok: false,
      motivo: "cnpj_divergente",
      mensagem: "O CNPJ do certificado não corresponde ao CNPJ da unidade.",
    };
  }

  return {
    ok: true,
    cert: {
      pfx,
      senha,
      cnpjUnidade,
      cnpjCertificado: aberto.cnpjCertificado,
      estado: (unidade.estado as string | null) ?? null,
      empresaId: (unidade.empresa_id as string | null) ?? null,
      titular: aberto.titular,
      validade: aberto.validade,
      privateKey: aberto.privateKey,
      certBase64: aberto.certBase64,
    },
  };
}

/** Zera as referências sensíveis assim que a chamada termina. */
export function descartarCertificado(cert: CertificadoUnidade | null | undefined) {
  if (!cert) return;
  try {
    cert.pfx.fill(0);
  } catch {
    /* noop */
  }
  (cert as { senha: string }).senha = "";
}

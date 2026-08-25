// Verificação criptográfica do evento de manifestação assinado (XMLDSig da NF-e).
//
// Por que isso existe: quando a manifestação é enviada pelo AGENTE LOCAL (PC do
// escritório), quem fala com a SEFAZ é o navegador → agente. O navegador NÃO pode
// simplesmente declarar "deu certo": ele conhece o token do agente e poderia
// forjar qualquer comprovante HMAC. O que ele não consegue forjar é a assinatura
// XMLDSig do <infEvento>, feita com a chave privada do certificado A1 — que só
// existe no PC e nunca sai de lá.
//
// Portanto a Edge valida:
//   1. a assinatura RSA-SHA1 sobre o <SignedInfo>;
//   2. o DigestValue SHA-1 sobre o <infEvento> exatamente como assinado;
//   3. a coerência de chave/tipo/CNPJ dentro do XML assinado;
//   4. que a chave pública do certificado que assinou é a MESMA do certificado A1
//      da unidade guardado no cofre (impede assinatura por certificado arbitrário).
//
// Sem o item 4 não há prova de identidade (qualquer certificado autoassinado
// passaria nos itens 1-3), por isso, na ausência do certificado de referência, a
// verificação falha explicitamente em vez de fingir segurança.

import forge from "npm:node-forge@1.3.1";

export interface EntradaVerificacao {
  eventoXml: string;
  chave: string;
  codigoEvento: string;
  cnpjUnidade: string;
  /** DER base64 do certificado A1 da unidade (do cofre). Obrigatório. */
  certBase64Referencia: string | null;
}

export type ResultadoVerificacao =
  | { ok: true; idEvento: string; sequencia: number; titular: string }
  | { ok: false; motivo: string; mensagem: string };

function extrair(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/(?:\\w+:)?${tag}>`, "i");
  return xml.match(re)?.[0] ?? null;
}

function conteudo(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, "i");
  return xml.match(re)?.[1]?.trim() ?? null;
}

function chavePublicaIgual(a: forge.pki.Certificate, b: forge.pki.Certificate): boolean {
  try {
    const pa = a.publicKey as forge.pki.rsa.PublicKey;
    const pb = b.publicKey as forge.pki.rsa.PublicKey;
    return pa.n.toString(16) === pb.n.toString(16) && pa.e.toString(16) === pb.e.toString(16);
  } catch {
    return false;
  }
}

function certDeBase64(b64: string): forge.pki.Certificate {
  return forge.pki.certificateFromAsn1(forge.asn1.fromDer(forge.util.decode64(b64.replace(/\s+/g, ""))));
}

export function verificarEventoAssinado(e: EntradaVerificacao): ResultadoVerificacao {
  const xml = String(e.eventoXml ?? "");
  if (!xml || xml.length > 400_000) {
    return { ok: false, motivo: "evento_xml_invalido", mensagem: "XML do evento ausente ou grande demais." };
  }
  if (!e.certBase64Referencia) {
    return {
      ok: false,
      motivo: "sem_referencia_certificado",
      mensagem:
        "Não há certificado A1 da unidade no cofre para conferir a assinatura do evento. " +
        "Sem essa referência não é possível provar quem assinou — a manifestação não foi registrada como válida.",
    };
  }

  const infEvento = extrair(xml, "infEvento");
  const signature = extrair(xml, "Signature");
  if (!infEvento || !signature) {
    return { ok: false, motivo: "evento_sem_assinatura", mensagem: "O XML do evento não contém assinatura digital." };
  }
  const signedInfo = extrair(signature, "SignedInfo");
  const signatureValue = conteudo(signature, "SignatureValue");
  const x509 = conteudo(signature, "X509Certificate");
  const digestValue = conteudo(signature, "DigestValue");
  if (!signedInfo || !signatureValue || !x509 || !digestValue) {
    return { ok: false, motivo: "assinatura_incompleta", mensagem: "Assinatura digital incompleta no XML do evento." };
  }

  let cert: forge.pki.Certificate;
  let referencia: forge.pki.Certificate;
  try {
    cert = certDeBase64(x509);
    referencia = certDeBase64(e.certBase64Referencia);
  } catch {
    return { ok: false, motivo: "certificado_ilegivel", mensagem: "Não foi possível ler o certificado da assinatura." };
  }

  // 1) Digest do conteúdo assinado
  const mdConteudo = forge.md.sha1.create();
  mdConteudo.update(infEvento, "utf8");
  if (forge.util.encode64(mdConteudo.digest().getBytes()) !== digestValue.replace(/\s+/g, "")) {
    return { ok: false, motivo: "digest_divergente", mensagem: "O conteúdo do evento não corresponde à assinatura." };
  }

  // 2) Assinatura RSA sobre o SignedInfo
  const mdSig = forge.md.sha1.create();
  mdSig.update(signedInfo, "utf8");
  let assinaturaOk = false;
  try {
    assinaturaOk = (cert.publicKey as forge.pki.rsa.PublicKey).verify(
      mdSig.digest().getBytes(),
      forge.util.decode64(signatureValue.replace(/\s+/g, "")),
    );
  } catch {
    assinaturaOk = false;
  }
  if (!assinaturaOk) {
    return { ok: false, motivo: "assinatura_invalida", mensagem: "A assinatura digital do evento não confere." };
  }

  // 3) Identidade: mesma chave pública do A1 da unidade
  if (!chavePublicaIgual(cert, referencia)) {
    return {
      ok: false,
      motivo: "certificado_divergente",
      mensagem: "O evento foi assinado por um certificado diferente do certificado A1 da unidade.",
    };
  }
  if (cert.validity.notAfter < new Date()) {
    return { ok: false, motivo: "certificado_vencido", mensagem: "O certificado que assinou o evento está vencido." };
  }

  // 4) Coerência do conteúdo assinado com o que se pretende registrar
  const idEvento = infEvento.match(/Id="([^"]+)"/)?.[1] ?? "";
  const chaveXml = (conteudo(infEvento, "chNFe") ?? "").replace(/\D/g, "");
  const tpEvento = (conteudo(infEvento, "tpEvento") ?? "").trim();
  const cnpjXml = (conteudo(infEvento, "CNPJ") ?? "").replace(/\D/g, "");
  const sequencia = Number((conteudo(infEvento, "nSeqEvento") ?? "1").trim()) || 1;

  if (chaveXml !== String(e.chave).replace(/\D/g, "")) {
    return { ok: false, motivo: "chave_divergente", mensagem: "A chave do evento assinado não é a da nota informada." };
  }
  if (tpEvento !== e.codigoEvento) {
    return { ok: false, motivo: "tipo_divergente", mensagem: "O tipo de manifestação assinado é diferente do informado." };
  }
  if (cnpjXml !== String(e.cnpjUnidade).replace(/\D/g, "")) {
    return { ok: false, motivo: "cnpj_divergente", mensagem: "O CNPJ do evento assinado não é o da unidade." };
  }
  if (!idEvento.includes(chaveXml)) {
    return { ok: false, motivo: "id_divergente", mensagem: "O identificador do evento não corresponde à chave." };
  }

  const cn = String(cert.subject.getField("CN")?.value ?? "");
  return { ok: true, idEvento, sequencia, titular: cn.replace(/:\d{14}$/, "").trim() };
}

/** Extrai cStat/xMotivo/nProt do retorno da SEFAZ (não assinado — apenas informativo). */
export function lerRetEvento(retornoXml: string | null | undefined) {
  const xml = String(retornoXml ?? "");
  return {
    cStat: conteudo(xml, "cStat"),
    xMotivo: conteudo(xml, "xMotivo"),
    protocolo: conteudo(xml, "nProt"),
  };
}

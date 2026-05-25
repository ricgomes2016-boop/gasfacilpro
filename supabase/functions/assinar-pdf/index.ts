// Edge Function: assinar-pdf
// Suporta 3 ações:
//  - "assinar"      (default): assina o PDF enviado em pdfBase64
//  - "diagnostico"  : valida o .pfx + senha cadastrados, retorna metadados (não assina nada)
//  - "amostra"      : gera um PDF de teste de 1 página e devolve assinado
// Sempre retorna 200 OK; em erro retorna { ok: false, motivo, mensagem }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import forge from "npm:node-forge@1.3.1";
import { Buffer } from "node:buffer";
import { PDFDocument, StandardFonts, rgb, degrees } from "npm:pdf-lib@1.17.1";
// @ts-ignore - sem tipos
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

interface CertInfo {
  titular: string;
  cnpj: string | null;
  emissor: string;
  validade_inicio: string;
  validade_fim: string;
  serial: string;
  algoritmo: string;
  tamanho_chave: number | null;
  cadeia_icp_brasil: boolean;
}

function abrirPfx(pfxBytes: Uint8Array, senha: string): { p12: any; cert: any } | { erro: string } {
  try {
    // node-forge espera string binária no buffer
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < pfxBytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, pfxBytes.subarray(i, i + chunk) as any);
    }
    const asn1 = forge.asn1.fromDer(bin);
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
    if (!certBags.length || !certBags[0].cert) return { erro: "pfx_sem_certificado" };
    return { p12, cert: certBags[0].cert };
  } catch (e: any) {
    const msg = String(e?.message || e || "");
    if (/MAC|password|invalid|integrity/i.test(msg)) return { erro: "senha_invalida" };
    return { erro: "pfx_corrompido" };
  }
}

function extrairInfoCert(cert: any): CertInfo {
  const cn = cert.subject.getField("CN")?.value || "";
  const issuerCn = cert.issuer.getField("CN")?.value || "";
  const issuerO = cert.issuer.getField("O")?.value || "";
  const m = cn.match(/(\d{14})/);
  const titular = cn.replace(/:\d{14}$/, "").trim();
  const cnpj = m ? m[1] : null;

  let tamanhoChave: number | null = null;
  try {
    tamanhoChave = cert.publicKey?.n?.bitLength?.() ?? null;
  } catch {}

  const icp =
    /ICP[- ]?Brasil/i.test(issuerCn) ||
    /ICP[- ]?Brasil/i.test(issuerO) ||
    /AC\s/i.test(issuerCn);

  return {
    titular,
    cnpj,
    emissor: issuerCn || issuerO || "(desconhecido)",
    validade_inicio: cert.validity.notBefore.toISOString(),
    validade_fim: cert.validity.notAfter.toISOString(),
    serial: cert.serialNumber || "",
    algoritmo: cert.signatureOid ? forge.pki.oids[cert.signatureOid] || cert.signatureOid : "RSA-SHA256",
    tamanho_chave: tamanhoChave,
    cadeia_icp_brasil: icp,
  };
}

function fmtDataAssinatura(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  // Adobe-style: 2026.05.14 20:38:03 -03'00'
  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const tzh = p(Math.floor(Math.abs(tz) / 60));
  const tzm = p(Math.abs(tz) % 60);
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${sign}${tzh}'${tzm}'`;
}

interface VisivelOpts {
  pagina?: number; // 1-based; default = última
  x: number; // pontos, origem inferior-esquerda
  y: number;
  largura: number;
  altura: number;
}

async function desenharAparenciaAssinatura(
  pdfDoc: any,
  fonts: { regular: any; bold: any; italic: any },
  info: { titular: string; cnpj: string | null },
  visivel: VisivelOpts,
) {
  const pages = pdfDoc.getPages();
  const idx = visivel.pagina ? Math.min(Math.max(visivel.pagina - 1, 0), pages.length - 1) : pages.length - 1;
  const page = pages[idx];
  const { x, y, largura: w, altura: h } = visivel;

  const titularLinha = info.cnpj ? `${info.titular}:${info.cnpj}` : info.titular;
  const dataAss = fmtDataAssinatura();
  const leftW = w * 0.5 - 4;
  const rightX = x + w * 0.5 + 4;
  const rightW = w * 0.5 - 4;

  // Borda discreta
  page.drawRectangle({
    x, y, width: w, height: h,
    borderColor: rgb(0.55, 0.55, 0.55),
    borderWidth: 0.4,
  });

  // ---- Lado esquerdo: nome estilizado (quebra automática) ----
  const wrap = (txt: string, font: any, size: number, maxW: number): string[] => {
    const words = txt.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const wd of words) {
      const test = cur ? cur + " " + wd : wd;
      if (font.widthOfTextAtSize(test, size) <= maxW) cur = test;
      else { if (cur) lines.push(cur); cur = wd; }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  let leftSize = 13;
  let leftLines = wrap(titularLinha, fonts.bold, leftSize, leftW);
  while ((leftLines.length * (leftSize + 2)) > h - 6 && leftSize > 7) {
    leftSize -= 1;
    leftLines = wrap(titularLinha, fonts.bold, leftSize, leftW);
  }
  const leftBlockH = leftLines.length * (leftSize + 2);
  let ly = y + (h - leftBlockH) / 2 + leftBlockH - leftSize;
  for (const ln of leftLines) {
    page.drawText(ln, { x: x + 4, y: ly, size: leftSize, font: fonts.bold, color: rgb(0, 0, 0) });
    ly -= leftSize + 2;
  }

  // ---- Lado direito: bloco "Assinado de forma digital por..." ----
  const rightSize = 7.5;
  const rightLines: string[] = [];
  rightLines.push("Assinado de forma digital");
  rightLines.push("por " + titularLinha);
  rightLines.push("Dados: " + dataAss);
  // wrap se necessário
  const wrapped: string[] = [];
  for (const ln of rightLines) {
    const ws = wrap(ln, fonts.regular, rightSize, rightW);
    for (const w2 of ws) wrapped.push(w2);
  }
  const rightBlockH = wrapped.length * (rightSize + 1.5);
  let ry = y + (h - rightBlockH) / 2 + rightBlockH - rightSize;
  for (const ln of wrapped) {
    page.drawText(ln, { x: rightX, y: ry, size: rightSize, font: fonts.regular, color: rgb(0, 0, 0) });
    ry -= rightSize + 1.5;
  }
}

async function aplicarMarcaDagua(pdfDoc: any, texto: string) {
  if (!texto) return;
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  const fontSize = 42;
  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(texto, fontSize);
    // Posiciona centralizado e desenha em diagonal (~30°)
    const cx = width / 2;
    const cy = height / 2;
    page.drawText(texto, {
      x: cx - textWidth / 2,
      y: cy,
      size: fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity: 0.12,
      rotate: degrees(30),
    });
  }
}

async function assinarBytes(
  pdfBytes: Uint8Array,
  pfxBytes: Uint8Array,
  pfxSenha: string,
  meta: { titular: string; cnpj: string | null; motivo: string; local: string; contato: string; visivel?: VisivelOpts; empresaNome?: string },
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // Marca d'água com o nome da empresa em todas as páginas
  const watermarkText = meta.empresaNome
    ? `Assinado digitalmente por ${meta.empresaNome}`
    : `Assinado digitalmente por ${meta.titular}`;
  await aplicarMarcaDagua(pdfDoc, watermarkText);

  if (meta.visivel) {
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    await desenharAparenciaAssinatura(
      pdfDoc,
      { regular, bold, italic },
      { titular: meta.titular, cnpj: meta.cnpj },
      meta.visivel,
    );
  }

  pdflibAddPlaceholder({
    pdfDoc,
    reason: meta.motivo,
    contactInfo: meta.contato || (meta.cnpj ? `CNPJ ${meta.cnpj}` : meta.titular),
    name: meta.titular,
    location: meta.local,
    signatureLength: 16384,
  });
  const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });
  const buf = Buffer.from(pdfWithPlaceholder);
  const signer = new P12Signer(Buffer.from(pfxBytes), { passphrase: pfxSenha });
  const signedBuf = await new SignPdf().sign(buf, signer);
  return new Uint8Array(signedBuf.buffer, signedBuf.byteOffset, signedBuf.byteLength);
}

async function gerarPdfAmostra(info: CertInfo): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 780;
  const draw = (t: string, f = font, size = 11) => {
    page.drawText(t, { x: 50, y, size, font: f, color: rgb(0, 0, 0) });
    y -= size + 6;
  };
  draw("DOCUMENTO DE TESTE — ASSINATURA DIGITAL", bold, 16);
  y -= 4;
  draw(`Gerado em: ${new Date().toLocaleString("pt-BR")}`);
  y -= 8;
  draw("Este PDF foi gerado pelo sistema apenas para validar o certificado A1 (e-CNPJ)", font, 10);
  draw("cadastrado nesta unidade. Abra-o no Adobe Acrobat Reader e confira o painel", font, 10);
  draw("\"Assinaturas\" para conferir os dados do signatário.", font, 10);
  y -= 12;
  draw("Dados do certificado:", bold, 12);
  draw(`Titular: ${info.titular}`);
  draw(`CNPJ: ${info.cnpj || "(não detectado)"}`);
  draw(`Emissor: ${info.emissor}`);
  draw(`Validade: ${new Date(info.validade_inicio).toLocaleDateString("pt-BR")} até ${new Date(info.validade_fim).toLocaleDateString("pt-BR")}`);
  draw(`Serial: ${info.serial}`);
  draw(`Tamanho da chave: ${info.tamanho_chave || "?"} bits`);
  draw(`ICP-Brasil: ${info.cadeia_icp_brasil ? "Sim" : "Não detectado"}`);
  return new Uint8Array(await doc.save());
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
    const acao: "assinar" | "diagnostico" | "amostra" = body?.acao || "assinar";
    const unidadeId: string | undefined = body?.unidadeId;
    const motivo = String(body?.motivo || "Assinatura digital").slice(0, 200);
    const local = String(body?.local || "Brasil").slice(0, 100);
    const contato = String(body?.contato || "").slice(0, 200);

    if (!unidadeId) {
      return json({ ok: false, motivo: "bad_request", mensagem: "unidadeId é obrigatório." });
    }
    if (acao === "assinar" && !body?.pdfBase64) {
      return json({ ok: false, motivo: "bad_request", mensagem: "pdfBase64 é obrigatório para assinar." });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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
        mensagem: "Certificado A1 não cadastrado para esta unidade. Configure em Configurações › Unidades.",
      });
    }

    const { data: pfxBlob, error: dlErr } = await supabaseAdmin.storage
      .from("certificados-fiscais")
      .download(pfxPath);
    if (dlErr || !pfxBlob) {
      return json({
        ok: false,
        motivo: "pfx_nao_encontrado",
        mensagem: dlErr?.message || "Arquivo do certificado não encontrado no storage.",
      });
    }
    const pfxBytes = new Uint8Array(await pfxBlob.arrayBuffer());

    const aberto = abrirPfx(pfxBytes, pfxSenha);
    if ("erro" in aberto) {
      const map: Record<string, string> = {
        senha_invalida: "Senha do certificado inválida. Atualize em Configurações › Unidades.",
        pfx_corrompido: "Não foi possível abrir o certificado (arquivo inválido ou corrompido).",
        pfx_sem_certificado: "O .pfx não contém um certificado válido.",
      };
      return json({ ok: false, motivo: aberto.erro, mensagem: map[aberto.erro] || "Falha ao abrir certificado." });
    }

    const info = extrairInfoCert(aberto.cert);
    const agora = new Date();
    const fim = new Date(info.validade_fim);
    const diasParaVencer = Math.floor((fim.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));
    const vencido = fim < agora;

    if (acao === "diagnostico") {
      return json({
        ok: !vencido,
        motivo: vencido ? "cert_vencido" : undefined,
        mensagem: vencido ? "Certificado vencido." : undefined,
        diagnostico: { ...info, dias_para_vencer: diasParaVencer, vencido },
      });
    }

    if (vencido) {
      return json({ ok: false, motivo: "cert_vencido", mensagem: "Certificado A1 vencido." });
    }

    let pdfParaAssinar: Uint8Array;
    let visivel: VisivelOpts | undefined = body?.visivel;
    if (acao === "amostra") {
      pdfParaAssinar = await gerarPdfAmostra(info);
      visivel = visivel || { x: 50, y: 60, largura: 495, altura: 60 };
    } else {
      pdfParaAssinar = b64ToBytes(body.pdfBase64);
      if (!visivel || typeof visivel.x !== "number" || typeof visivel.y !== "number") {
        visivel = undefined;
      }
    }

    const signedBytes = await assinarBytes(pdfParaAssinar, pfxBytes, pfxSenha, {
      titular: info.titular,
      cnpj: info.cnpj,
      motivo: acao === "amostra" ? "Teste de assinatura digital" : motivo,
      local,
      contato,
      visivel,
    });

    return json({
      ok: true,
      pdfBase64Assinado: bytesToB64(signedBytes),
      titular: info.titular,
      cnpj: info.cnpj,
      diagnostico: { ...info, dias_para_vencer: diasParaVencer, vencido: false },
      assinadoEm: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[assinar-pdf] erro:", e);
    return json({ ok: false, motivo: "exception", mensagem: e?.message || "Erro inesperado." });
  }
});

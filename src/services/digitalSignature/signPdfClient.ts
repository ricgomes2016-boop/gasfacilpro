import { supabase } from "@/integrations/supabase/client";

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(s);
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface AssinarOpts {
  unidadeId: string;
  motivo?: string;
  local?: string;
  contato?: string;
}

export interface AssinarResultado {
  ok: boolean;
  pdf: Uint8Array;
  titular?: string;
  cnpj?: string | null;
  motivo?: string;
  mensagem?: string;
}

/**
 * Envia o PDF para a edge function `assinar-pdf` que aplica PAdES com o
 * certificado A1 cadastrado na unidade. Em caso de falha, retorna o PDF
 * original com `ok: false` e o motivo.
 */
export async function assinarPdfRemoto(pdfBytes: Uint8Array, opts: AssinarOpts): Promise<AssinarResultado> {
  try {
    const { data, error } = await supabase.functions.invoke("assinar-pdf", {
      body: {
        pdfBase64: bytesToB64(pdfBytes),
        unidadeId: opts.unidadeId,
        motivo: opts.motivo,
        local: opts.local,
        contato: opts.contato,
      },
    });
    if (error) {
      return { ok: false, pdf: pdfBytes, motivo: "network", mensagem: error.message };
    }
    if (!data?.ok || !data?.pdfBase64Assinado) {
      return { ok: false, pdf: pdfBytes, motivo: data?.motivo, mensagem: data?.mensagem };
    }
    return {
      ok: true,
      pdf: b64ToBytes(data.pdfBase64Assinado),
      titular: data.titular,
      cnpj: data.cnpj,
    };
  } catch (e: any) {
    return { ok: false, pdf: pdfBytes, motivo: "exception", mensagem: e?.message };
  }
}

import JSZip from "jszip";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

export interface CertidaoArquivo {
  tipo: string;
  arquivo_url: string; // path in 'certidoes-empresa' bucket
  arquivo_nome?: string | null;
}

const TIPO_LABEL: Record<string, string> = {
  cnd_federal: "CND_Federal",
  cnd_estadual: "CND_Estadual",
  cnd_municipal: "CND_Municipal",
  cndt: "CNDT_Trabalhista",
  fgts: "CRF_FGTS",
  anp: "ANP_Revenda",
  sintegra: "Sintegra",
};

export async function montarZipLicitacao(
  numeroPregao: string,
  foraEnvelope: { name: string; doc: jsPDF }[],
  envelope1: { name: string; doc: jsPDF }[],
  envelope2Etiqueta: jsPDF,
  envelope1Etiqueta: jsPDF,
  certidoes: CertidaoArquivo[]
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder(`Pregao_${numeroPregao.replace(/\//g, "-")}`)!;

  const fora = folder.folder("Fora do Envelope")!;
  for (const { name, doc } of foraEnvelope) {
    fora.file(`${name}.pdf`, doc.output("blob"));
  }

  const env1 = folder.folder("Envelope 1 - Proposta")!;
  env1.file("ETIQUETA_Envelope_1.pdf", envelope1Etiqueta.output("blob"));
  for (const { name, doc } of envelope1) {
    env1.file(`${name}.pdf`, doc.output("blob"));
  }

  const env2 = folder.folder("Envelope 2 - Habilitacao")!;
  env2.file("ETIQUETA_Envelope_2.pdf", envelope2Etiqueta.output("blob"));
  for (const c of certidoes) {
    try {
      const { data } = await supabase.storage
        .from("certidoes-empresa")
        .download(c.arquivo_url);
      if (data) {
        const label = TIPO_LABEL[c.tipo] || c.tipo;
        env2.file(`${label}.pdf`, data);
      }
    } catch (e) {
      console.error("Erro ao baixar certidão", c.tipo, e);
    }
  }

  return await zip.generateAsync({ type: "blob" });
}

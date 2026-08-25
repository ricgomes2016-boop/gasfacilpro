/**
 * Orquestra o caminho "resumo (resNFe) -> XML completo (nfeProc)" usando o agente
 * local autenticado. Lógica pura (injeção de dependências) para poder ser testada
 * sem rede: a UI fornece as funções de manifestação, ingestão e consulta.
 *
 * Regra fiscal: o resumo não contém itens (det/prod). A SEFAZ só libera o XML
 * completo ao destinatário após um evento de manifestação — a Ciência da Emissão
 * é o evento NÃO conclusivo usado aqui, e só pode ser disparado por clique
 * explícito do usuário.
 */

import { parseDfeDocumento } from "./dfeXml";

export interface RespostaManifestacaoAgenteMin {
  eventoXml: string;
  retornoXml: string;
  cStat: string | null;
  xMotivo: string | null;
  protocolo: string | null;
}

export type ResultadoXmlCompleto =
  | { status: "completo"; xml: string; schema: string | null; cienciaRegistrada: boolean }
  | { status: "aguardando_liberacao"; cienciaRegistrada: boolean; mensagem: string }
  | { status: "erro"; motivo: string; mensagem: string; cienciaRegistrada: boolean };

export interface OpcoesObterXmlCompleto {
  /** Quando true, registra Ciência da Emissão antes de consultar a chave. */
  registrarCiencia: boolean;
  manifestar?: () => Promise<
    { ok: true; dados: RespostaManifestacaoAgenteMin } | { ok: false; motivo: string; mensagem: string }
  >;
  ingerirEvento?: (dados: RespostaManifestacaoAgenteMin) => Promise<{ ok: boolean; mensagem?: string }>;
  consultarChave: () => Promise<
    { ok: true; dados: { xml: string; schema: string | null } } | { ok: false; motivo: string; mensagem: string }
  >;
  ingerirXml: (xml: string, schema: string | null) => Promise<{ ok: boolean; mensagem?: string }>;
  progresso?: (mensagem: string) => void;
}

const MSG_AGUARDANDO =
  "Ciência registrada na SEFAZ. O XML completo ainda não foi liberado — aguarde alguns minutos e use “Buscar XML completo”.";

const MSG_SEM_CIENCIA =
  "A SEFAZ ainda não liberou o XML completo desta nota. Aguarde alguns minutos e use “Buscar XML completo” novamente.";

export async function obterXmlCompletoDfe(opcoes: OpcoesObterXmlCompleto): Promise<ResultadoXmlCompleto> {
  let cienciaRegistrada = false;

  if (opcoes.registrarCiencia) {
    if (!opcoes.manifestar || !opcoes.ingerirEvento) {
      return { status: "erro", motivo: "manifestacao_indisponivel", cienciaRegistrada, mensagem: "Manifestação indisponível." };
    }
    opcoes.progresso?.("Registrando Ciência da Emissão na SEFAZ...");
    const resp = await opcoes.manifestar();
    if (resp.ok !== true) {
      return { status: "erro", motivo: resp.motivo, mensagem: resp.mensagem, cienciaRegistrada };
    }
    opcoes.progresso?.("Registrando o evento no ERP...");
    const ingest = await opcoes.ingerirEvento(resp.dados);
    if (!ingest?.ok) {
      return {
        status: "erro",
        motivo: "evento_nao_registrado",
        mensagem: ingest?.mensagem || "A ciência não pôde ser registrada no ERP.",
        cienciaRegistrada,
      };
    }
    cienciaRegistrada = true;
  }

  opcoes.progresso?.("Consultando o XML completo na SEFAZ...");
  const consulta = await opcoes.consultarChave();
  if (consulta.ok !== true) {
    return { status: "erro", motivo: consulta.motivo, mensagem: consulta.mensagem, cienciaRegistrada };
  }

  const xml = consulta.dados?.xml ?? "";
  const parsed = parseDfeDocumento(xml);
  if (!xml || parsed.tipo !== "completo") {
    return {
      status: "aguardando_liberacao",
      cienciaRegistrada,
      mensagem: cienciaRegistrada ? MSG_AGUARDANDO : MSG_SEM_CIENCIA,
    };
  }

  opcoes.progresso?.("Guardando o XML completo no repositório DF-e...");
  const ing = await opcoes.ingerirXml(xml, consulta.dados.schema ?? null);
  if (!ing?.ok) {
    return {
      status: "erro",
      motivo: "ingestao_falhou",
      mensagem: ing?.mensagem || "O XML foi baixado, mas não pôde ser gravado no repositório DF-e.",
      cienciaRegistrada,
    };
  }

  return { status: "completo", xml, schema: consulta.dados.schema ?? null, cienciaRegistrada };
}

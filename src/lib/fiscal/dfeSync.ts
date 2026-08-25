import type { DocumentoAgente } from "./agenteLocal";

interface DistribuicaoOk {
  ok: true;
  dados: {
    cStat: string | null;
    xMotivo: string | null;
    ultNSU: number;
    maxNSU: number;
    documentos: DocumentoAgente[];
  };
}

interface DistribuicaoErro {
  ok: false;
  motivo: string;
  mensagem: string;
}

export class ErroSincronizacaoAgente extends Error {
  constructor(public readonly motivo: string, mensagem: string) {
    super(mensagem);
    this.name = "ErroSincronizacaoAgente";
  }
}

interface OpcoesSincronizacao {
  ultimoNSU: number;
  maxNSU: number;
  distribuir: (ultimoNSU: number) => Promise<DistribuicaoOk | DistribuicaoErro>;
  ingerir: (documentos: DocumentoAgente[], ultimoNSU: number, maxNSU: number, cStat: string) => Promise<{
    ok: boolean;
    novos?: number;
    atualizados?: number;
    mensagem?: string;
  }>;
  progresso?: (mensagem: string) => void;
}

/** Coordena a consulta sem permitir que uma falha seja convertida em sucesso visual. */
export async function sincronizarDfeComAgente(opcoes: OpcoesSincronizacao) {
  let ultimoNSU = opcoes.ultimoNSU;
  let maxNSU = opcoes.maxNSU;
  let novos = 0;
  let atualizados = 0;

  for (let lote = 1; lote <= 5; lote++) {
    opcoes.progresso?.(`Consultando a SEFAZ pelo agente local (lote ${lote})...`);
    const resposta = await opcoes.distribuir(ultimoNSU);
    if (!resposta.ok) {
      const mensagem = resposta.motivo === "token_invalido"
        ? "Token de pareamento inválido. Abra Configurar agente e informe o token atual."
        : resposta.mensagem;
      throw new ErroSincronizacaoAgente(resposta.motivo, mensagem);
    }

    const dados = resposta.dados;
    const cStat = String(dados.cStat ?? "");
    if (!cStat) throw new ErroSincronizacaoAgente("resposta_sefaz_invalida", "O agente não recebeu uma resposta válida da SEFAZ.");
    if (cStat === "656") {
      throw new ErroSincronizacaoAgente(
        "consumo_indevido",
        "A SEFAZ bloqueou temporariamente novas consultas. Aguarde uma hora antes de sincronizar novamente.",
      );
    }

    maxNSU = Math.max(maxNSU, Number(dados.maxNSU ?? 0));
    ultimoNSU = Math.max(ultimoNSU, Number(dados.ultNSU ?? 0));
    const documentos = dados.documentos ?? [];

    if (documentos.length || cStat === "137") {
      opcoes.progresso?.(documentos.length
        ? `Importando ${documentos.length} documento(s)...`
        : "Registrando a sincronização...");
      const ingestao = await opcoes.ingerir(documentos, ultimoNSU, maxNSU, cStat);
      if (!ingestao?.ok) {
        throw new ErroSincronizacaoAgente("falha_ingestao", ingestao?.mensagem || "Não foi possível registrar a sincronização.");
      }
      novos += Number(ingestao.novos ?? 0);
      atualizados += Number(ingestao.atualizados ?? 0);
    }

    if (cStat === "137" || documentos.length === 0 || (maxNSU > 0 && ultimoNSU >= maxNSU)) break;
  }

  return { novos, atualizados, ultimoNSU, maxNSU };
}
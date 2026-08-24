/**
 * Máquina de estados da Manifestação do Destinatário (NF-e).
 *
 * Eventos oficiais (Portal Nacional da NF-e):
 *  210200 — Confirmação da Operação
 *  210210 — Ciência da Emissão (não conclusiva)
 *  210220 — Desconhecimento da Operação
 *  210240 — Operação não Realizada
 */

export type ManifestacaoTipo = "ciencia" | "confirmada" | "desconhecida" | "nao_realizada";

export const CODIGO_EVENTO: Record<ManifestacaoTipo, string> = {
  confirmada: "210200",
  ciencia: "210210",
  desconhecida: "210220",
  nao_realizada: "210240",
};

export const DESCRICAO_EVENTO: Record<ManifestacaoTipo, string> = {
  confirmada: "Confirmacao da Operacao",
  ciencia: "Ciencia da Emissao",
  desconhecida: "Desconhecimento da Operacao",
  nao_realizada: "Operacao nao Realizada",
};

export const ROTULO_MANIFESTACAO: Record<ManifestacaoTipo, string> = {
  confirmada: "Confirmação da Operação",
  ciencia: "Ciência da Emissão",
  desconhecida: "Desconhecimento da Operação",
  nao_realizada: "Operação não Realizada",
};

/** Manifestações conclusivas — depois delas não se oferece mais Ciência. */
export const MANIFESTACOES_CONCLUSIVAS: ManifestacaoTipo[] = [
  "confirmada",
  "desconhecida",
  "nao_realizada",
];

export function isConclusiva(m: ManifestacaoTipo | null | undefined): boolean {
  return !!m && MANIFESTACOES_CONCLUSIVAS.includes(m);
}

/** Eventos que exigem justificativa (mín. 15 / máx. 255 caracteres). */
export function exigeJustificativa(tipo: ManifestacaoTipo): boolean {
  return tipo === "desconhecida" || tipo === "nao_realizada";
}

export const JUSTIFICATIVA_MIN = 15;
export const JUSTIFICATIVA_MAX = 255;

export function validarJustificativa(
  tipo: ManifestacaoTipo,
  justificativa?: string | null,
): { valido: boolean; erro?: string } {
  if (!exigeJustificativa(tipo)) return { valido: true };
  const texto = String(justificativa ?? "").trim();
  if (texto.length < JUSTIFICATIVA_MIN) {
    return { valido: false, erro: `A justificativa deve ter ao menos ${JUSTIFICATIVA_MIN} caracteres.` };
  }
  if (texto.length > JUSTIFICATIVA_MAX) {
    return { valido: false, erro: `A justificativa deve ter no máximo ${JUSTIFICATIVA_MAX} caracteres.` };
  }
  return { valido: true };
}

/**
 * Transições permitidas a partir do estado atual.
 * - Sem manifestação: todas as quatro.
 * - Com Ciência: apenas as conclusivas (Ciência já foi registrada).
 * - Com manifestação conclusiva: nenhuma nova manifestação é oferecida.
 */
export function manifestacoesPermitidas(
  atual: ManifestacaoTipo | null | undefined,
): ManifestacaoTipo[] {
  if (!atual) return ["ciencia", "confirmada", "desconhecida", "nao_realizada"];
  if (atual === "ciencia") return [...MANIFESTACOES_CONCLUSIVAS];
  return [];
}

export function podeManifestar(
  atual: ManifestacaoTipo | null | undefined,
  desejada: ManifestacaoTipo,
): { permitido: boolean; motivo?: string } {
  const permitidas = manifestacoesPermitidas(atual);
  if (permitidas.includes(desejada)) return { permitido: true };
  if (atual === desejada) {
    return { permitido: false, motivo: `A nota já possui ${ROTULO_MANIFESTACAO[desejada]} registrada.` };
  }
  if (isConclusiva(atual)) {
    return {
      permitido: false,
      motivo: `A nota já possui manifestação conclusiva (${ROTULO_MANIFESTACAO[atual!]}).`,
    };
  }
  return { permitido: false, motivo: "Manifestação não permitida para o estado atual da nota." };
}

/** Converte o código do evento retornado pela SEFAZ no tipo interno. */
export function tipoPorCodigo(codigo: string | null | undefined): ManifestacaoTipo | null {
  const c = String(codigo ?? "").trim();
  const par = (Object.keys(CODIGO_EVENTO) as ManifestacaoTipo[]).find((k) => CODIGO_EVENTO[k] === c);
  return par ?? null;
}

/** cStat de sucesso para registro de evento (135 = registrado, 136 = registrado vinculação n/a). */
export function eventoRegistradoComSucesso(cStat: string | null | undefined): boolean {
  return ["135", "136", "573"].includes(String(cStat ?? "").trim());
}

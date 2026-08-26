// Endpoints do Ambiente Nacional (Portal oficial da NF-e).
// Atenção: Distribuição DF-e usa "www1"; RecepcaoEvento4 usa "www" (sem o 1).
// Módulo sem dependências para poder ser testado isoladamente.

export const URL_DISTRIBUICAO = "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
export const URL_EVENTO = "https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx";
export const URL_DISTRIBUICAO_HOM = "https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
export const URL_EVENTO_HOM = "https://hom.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx";

/** tpAmb "1" = produção, "2" = homologação. */
export function urlDistribuicao(tpAmb: string): string {
  return tpAmb === "2" ? URL_DISTRIBUICAO_HOM : URL_DISTRIBUICAO;
}

export function urlEvento(tpAmb: string): string {
  return tpAmb === "2" ? URL_EVENTO_HOM : URL_EVENTO;
}

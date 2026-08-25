/**
 * Helpers puros para a chave de acesso da NF-e (44 dígitos).
 * Nenhum acesso a rede/estado — seguro para uso em testes e no frontend.
 */

export const UF_POR_CODIGO: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL",
  "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
  "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

/** Remove qualquer caractere não numérico e limita a 44 dígitos. */
export function normalizarChave(valor: string | null | undefined): string {
  return String(valor ?? "").replace(/\D/g, "").slice(0, 44);
}

/** Calcula o dígito verificador (módulo 11, pesos 2..9) dos 43 primeiros dígitos. */
export function calcularDvChave(chave43: string): number | null {
  const base = String(chave43 ?? "").replace(/\D/g, "");
  if (base.length !== 43) return null;
  let peso = 2;
  let soma = 0;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += Number(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto === 0 || resto === 1 ? 0 : 11 - resto;
}

/** Valida os 44 dígitos e o dígito verificador. */
export function validarChaveNfe(valor: string | null | undefined): boolean {
  const chave = normalizarChave(valor);
  if (chave.length !== 44) return false;
  const dv = calcularDvChave(chave.slice(0, 43));
  return dv !== null && dv === Number(chave[43]);
}

export interface ChaveNfeInfo {
  chave: string;
  cUF: string;
  uf: string | null;
  ano: string;
  mes: string;
  cnpjEmitente: string;
  modelo: string;
  serie: string;
  numero: string;
  tpEmis: string;
  codigoNumerico: string;
  dv: string;
  dvValido: boolean;
}

/** Explode a chave em seus campos. Retorna null se não tiver 44 dígitos. */
export function extrairInfoChave(valor: string | null | undefined): ChaveNfeInfo | null {
  const chave = normalizarChave(valor);
  if (chave.length !== 44) return null;
  return {
    chave,
    cUF: chave.slice(0, 2),
    uf: UF_POR_CODIGO[chave.slice(0, 2)] ?? null,
    ano: chave.slice(2, 4),
    mes: chave.slice(4, 6),
    cnpjEmitente: chave.slice(6, 20),
    modelo: chave.slice(20, 22),
    serie: chave.slice(22, 25),
    numero: chave.slice(25, 34),
    tpEmis: chave.slice(34, 35),
    codigoNumerico: chave.slice(35, 43),
    dv: chave.slice(43, 44),
    dvValido: validarChaveNfe(chave),
  };
}

/** Formata a chave em blocos de 4 para leitura. */
export function formatarChave(valor: string | null | undefined): string {
  const chave = normalizarChave(valor);
  return chave.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

/** Identificador legível de um pedido/compra sem depender de colunas inexistentes. */
export function formatarNumeroSerie(numero?: string | null, serie?: string | null): string {
  const n = String(numero ?? "").replace(/^0+/, "") || "S/N";
  const s = String(serie ?? "").replace(/^0+/, "");
  return s ? `${n}/${s}` : n;
}

/** Série embutida na chave (posições 23-25). Null se a chave não tiver 44 dígitos. */
export function serieDaChave(valor: string | null | undefined): string | null {
  const chave = normalizarChave(valor);
  if (chave.length !== 44) return null;
  return chave.slice(22, 25);
}

/** Número da NF-e embutido na chave (posições 26-34). Null se a chave for inválida. */
export function numeroDaChave(valor: string | null | undefined): string | null {
  const chave = normalizarChave(valor);
  if (chave.length !== 44) return null;
  return chave.slice(25, 34);
}

/**
 * Exibição de número/série usando a chave apenas como fallback quando o resumo
 * não trouxe os campos — nunca inventa valores.
 */
export function formatarNumeroSerieComChave(
  numero: string | null | undefined,
  serie: string | null | undefined,
  chave: string | null | undefined,
): string {
  const n = numero ?? numeroDaChave(chave);
  const s = serie ?? serieDaChave(chave);
  return formatarNumeroSerie(n, s);
}


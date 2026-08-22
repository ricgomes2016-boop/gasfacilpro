/**
 * Helpers puros de período/status usados pela consulta de receita da DRE.
 * Ficam separados de `dreCalculo.ts` para poderem ser testados sem o client Supabase.
 */

/** Status de pedido que representam receita realizada. Cancelados/pendentes nunca entram. */
export const STATUS_RECEITA_DRE = [
  "entregue",
  "finalizado",
  "pago",
  "pago_cartao",
] as const;

export interface DreMesRange {
  /** Primeiro dia do mês (yyyy-MM-dd), inclusivo. */
  inicioDate: string;
  /** Último dia do mês (yyyy-MM-dd), inclusivo — usado por tabelas com coluna `date`. */
  fimDate: string;
  /** Primeiro dia do mês seguinte (yyyy-MM-dd), EXCLUSIVO. */
  proximoInicioDate: string;
  /** Início do mês em ISO, inclusivo. */
  inicioISO: string;
  /** Início do mês seguinte em ISO, EXCLUSIVO — evita perder o último dia por causa da hora. */
  proximoInicioISO: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Intervalo completo do mês da referência.
 * Sempre `[início, próximo mês)` para timestamps, evitando o bug do `lte` no último
 * dia à meia-noite (que descarta tudo que ocorreu depois de 00:00 do dia 31).
 */
export function mesRangeDre(referencia: Date): DreMesRange {
  const inicio = new Date(referencia.getFullYear(), referencia.getMonth(), 1, 0, 0, 0, 0);
  const proximo = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 1, 0, 0, 0, 0);
  const fim = new Date(proximo.getTime() - 24 * 60 * 60 * 1000);
  return {
    inicioDate: ymd(inicio),
    fimDate: ymd(fim),
    proximoInicioDate: ymd(proximo),
    inicioISO: inicio.toISOString(),
    proximoInicioISO: proximo.toISOString(),
  };
}

/**
 * Filtro PostgREST de competência da receita:
 * usa `data_entrega` quando existe; quando é nula, cai para `created_at`.
 * Ambos no intervalo `[início, próximo mês)`.
 */
export function filtroPeriodoPedidos(range: DreMesRange): string {
  return [
    `and(data_entrega.gte.${range.inicioDate},data_entrega.lt.${range.proximoInicioDate})`,
    `and(data_entrega.is.null,created_at.gte.${range.inicioISO},created_at.lt.${range.proximoInicioISO})`,
  ].join(",");
}

const normalizar = (valor?: string | null) =>
  (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const TERMOS_AGUA = /\b(agua|galao|garrafao)\b/;
const TERMOS_GAS = /\b(gas|glp|botijao|p13|p20|p45)\b/;
const TITULO_GENERICO = /^vale (agua|gas|produto)$/;

export type TipoApresentacaoVale = "agua" | "gas" | "produto";

export function identificarTipoVale(
  produtoNome?: string | null,
  descricao?: string | null,
): TipoApresentacaoVale {
  const produto = normalizar(produtoNome);
  const texto = `${produto} ${normalizar(descricao)}`;

  if (TERMOS_AGUA.test(texto)) return "agua";
  if (TERMOS_GAS.test(texto)) return "gas";
  return "produto";
}

export function obterApresentacaoVale(
  produtoNome?: string | null,
  descricao?: string | null,
) {
  const tipo = identificarTipoVale(produtoNome, descricao);
  const titulo = tipo === "agua" ? "VALE ÁGUA" : tipo === "gas" ? "VALE GÁS" : "VALE PRODUTO";
  const descricaoLimpa = descricao?.trim() ?? "";
  const descricaoNormalizada = normalizar(descricaoLimpa);
  const descricaoEhTituloGenerico = TITULO_GENERICO.test(descricaoNormalizada);
  const subtitulo = descricaoEhTituloGenerico || descricaoNormalizada === normalizar(titulo) ? "" : descricaoLimpa;

  return {
    tipo,
    titulo,
    subtitulo,
    nomeArquivo: tipo === "agua" ? "vale-agua" : tipo === "gas" ? "vale-gas" : "vale-produto",
  };
}

export type GrupoHist = "P13" | "P20" | "P45" | "Agua";
export interface LinhaHist { data_contagem?: string | null; data_conferencia: string; momento?: string | null; unidade_id: string; produto_grupo: string; tipo_estoque: string; quantidade: number | string | null }
export interface ConferenciaHist {
  chave: string;
  dataContagem: string;
  momento: "inicio" | "fim";
  lojas: string[];
  totais: Record<GrupoHist, { cheio: number; vazio: number }>;
}

const zero = (): Record<GrupoHist, { cheio: number; vazio: number }> => ({ P13: { cheio: 0, vazio: 0 }, P20: { cheio: 0, vazio: 0 }, P45: { cheio: 0, vazio: 0 }, Agua: { cheio: 0, vazio: 0 } });

/** Agrupa contagens por data física + momento. Contagens antigas valem como início do dia; novas substituem antigas da mesma loja/produto. */
export function agruparHistorico(fechamentos: LinhaHist[], legado: LinhaHist[]): ConferenciaHist[] {
  const cells = new Map<string, { data: string; momento: "inicio" | "fim"; loja: string; grupo: string; tipo: string; qtd: number }>();
  const add = (r: LinhaHist, data: string, momento: "inicio" | "fim") => {
    cells.set(`${data}|${momento}|${r.unidade_id}|${r.produto_grupo}|${r.tipo_estoque}`, { data, momento, loja: r.unidade_id, grupo: r.produto_grupo, tipo: r.tipo_estoque, qtd: Number(r.quantidade || 0) });
  };
  legado.forEach((r) => add(r, r.data_conferencia, "inicio"));
  fechamentos.forEach((r) => add(r, r.data_contagem || r.data_conferencia, r.momento === "fim" ? "fim" : "inicio"));
  const grupos = new Map<string, ConferenciaHist>();
  for (const c of cells.values()) {
    const chave = `${c.data}|${c.momento}`;
    const g = grupos.get(chave) || { chave, dataContagem: c.data, momento: c.momento, lojas: [], totais: zero() };
    if (!g.lojas.includes(c.loja)) g.lojas.push(c.loja);
    const t = g.totais[c.grupo as GrupoHist];
    if (t && (c.tipo === "cheio" || c.tipo === "vazio")) t[c.tipo] += c.qtd;
    grupos.set(chave, g);
  }
  return [...grupos.values()].sort((a, b) => b.dataContagem.localeCompare(a.dataContagem) || (a.momento === "fim" ? -1 : 1));
}

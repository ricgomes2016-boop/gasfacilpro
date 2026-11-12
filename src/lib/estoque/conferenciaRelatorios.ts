import { addDays, format } from "date-fns";
import { LinhaHist } from "./conferenciaHistorico";

export type Grupo = "P13" | "P20" | "P45" | "Agua";
export const GRUPOS_REL: Grupo[] = ["P13", "P20", "P45", "Agua"];
export const nomeGrupo = (g: string) => (g === "Agua" ? "Água" : g);
export interface MovRel { tipo: string; unidade_id: string; unidade_destino_id?: string | null; produto_grupo: string; quantidade: number | string; data_conferencia: string }
export interface AjusteRel { data_conferencia: string; unidade_id: string; produto_grupo: string; cheio: number | string }
export interface LinhaRel { data: string; unidadeId: string; origemId?: string; grupo: Grupo; quantidade: number | null }

const dia = (d: string, n: number) => format(addDays(new Date(`${d}T12:00:00`), n), "yyyy-MM-dd");
const dentro = (d: string, de: string, ate: string) => d >= de && d <= ate;
const ordem = (a: LinhaRel, b: LinhaRel) => a.data.localeCompare(b.data) || a.unidadeId.localeCompare(b.unidadeId) || GRUPOS_REL.indexOf(a.grupo) - GRUPOS_REL.indexOf(b.grupo);

export function relatorioEntradas(movs: MovRel[], lojas: string[], de: string, ate: string): LinhaRel[] {
  const m = new Map<string, LinhaRel>();
  movs.filter((x) => x.tipo === "entrada_manual" && lojas.includes(x.unidade_id) && dentro(x.data_conferencia, de, ate)).forEach((x) => {
    const k = `${x.data_conferencia}|${x.unidade_id}|${x.produto_grupo}`;
    const r = m.get(k) || { data: x.data_conferencia, unidadeId: x.unidade_id, grupo: x.produto_grupo as Grupo, quantidade: 0 };
    r.quantidade = (r.quantidade || 0) + Number(x.quantidade || 0); m.set(k, r);
  });
  return [...m.values()].filter((r) => r.quantidade).sort(ordem);
}

export function relatorioRecebidas(movs: MovRel[], lojas: string[], de: string, ate: string): LinhaRel[] {
  return movs.filter((x) => x.tipo === "transferencia" && x.unidade_destino_id && lojas.includes(x.unidade_destino_id) && dentro(x.data_conferencia, de, ate))
    .map((x) => ({ data: x.data_conferencia, unidadeId: x.unidade_destino_id!, origemId: x.unidade_id, grupo: x.produto_grupo as Grupo, quantidade: Number(x.quantidade || 0) }))
    .filter((r) => r.quantidade).sort(ordem);
}

/** Venda do dia D = abertura(D) + entradas(D) + recebidas(D) − enviadas(D) − fechamento(D).
 *  Abertura: ajuste Master, contagem início de D ou final de D−1. Fechamento: final de D ou início de D+1. */
export function relatorioVendas(contagens: LinhaHist[], legado: LinhaHist[], movs: MovRel[], ajustes: AjusteRel[], lojas: string[], de: string, ate: string): LinhaRel[] {
  const cheio = new Map<string, number>();
  const put = (r: LinhaHist, data: string, mom: string) => { if (r.tipo_estoque === "cheio") cheio.set(`${data}|${mom}|${r.unidade_id}|${r.produto_grupo}`, Number(r.quantidade || 0)); };
  legado.forEach((r) => put(r, r.data_conferencia, "inicio"));
  contagens.forEach((r) => put(r, r.data_contagem || r.data_conferencia, r.momento === "fim" ? "fim" : "inicio"));
  const aj = new Map(ajustes.map((a) => [`${a.data_conferencia}|${a.unidade_id}|${a.produto_grupo}`, Number(a.cheio || 0)]));
  const get = (k: string) => cheio.get(k);
  const out: LinhaRel[] = [];
  for (let d = de; d <= ate; d = dia(d, 1)) for (const u of lojas) for (const g of GRUPOS_REL) {
    const abre = aj.get(`${d}|${u}|${g}`) ?? get(`${d}|inicio|${u}|${g}`) ?? get(`${dia(d, -1)}|fim|${u}|${g}`);
    const fecha = get(`${d}|fim|${u}|${g}`) ?? get(`${dia(d, 1)}|inicio|${u}|${g}`);
    if (abre === undefined && fecha === undefined) continue;
    let mov = 0;
    movs.filter((x) => x.data_conferencia === d && x.produto_grupo === g).forEach((x) => {
      const q = Number(x.quantidade || 0);
      if (x.tipo === "entrada_manual" && x.unidade_id === u) mov += q;
      if (x.tipo === "transferencia" && x.unidade_id === u) mov -= q;
      if (x.tipo === "transferencia" && x.unidade_destino_id === u) mov += q;
    });
    out.push({ data: d, unidadeId: u, grupo: g, quantidade: abre === undefined || fecha === undefined ? null : abre + mov - fecha });
  }
  return out;
}

export function totaisPorGrupo(linhas: LinhaRel[]) {
  const t: Record<Grupo, number> = { P13: 0, P20: 0, P45: 0, Agua: 0 };
  linhas.forEach((l) => { if (l.quantidade !== null) t[l.grupo] += l.quantidade; });
  return t;
}

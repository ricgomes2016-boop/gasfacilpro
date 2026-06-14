// Projeção da chave do mata-mata a partir dos palpites do entregador.
// Calcula classificação dos grupos, monta R32 e propaga vencedores até a Final.
// Tudo em memória — não grava nada no banco. Times reais (preenchidos pelo admin)
// sempre prevalecem sobre a projeção.

import type { BolaoJogo, BolaoPalpite } from "@/hooks/useBolao";
import { GRUPOS_2026 } from "./fixture2026";

export interface TimePos {
  codigo: string;
  nome: string;
  pts: number;
  sg: number;
  gp: number;
  grupo: string;
}

export interface ProjecaoSlot {
  time_casa: string;
  time_fora: string;
  codigo_casa: string | null;
  codigo_fora: string | null;
  projetado: boolean;
}

// Heurística para detectar placeholders da fixture (Classif. R32 J1, Vencedor R32-1, etc.)
function ehPlaceholder(nome: string): boolean {
  if (!nome) return true;
  return /^(Classif\.|Vencedor|Perdedor)/i.test(nome);
}

function timeDoGrupo(nome: string): { codigo: string; grupo: string } | null {
  for (const [letra, times] of Object.entries(GRUPOS_2026)) {
    const t = times.find((x) => x.nome === nome);
    if (t) return { codigo: t.codigo, grupo: letra };
  }
  return null;
}

function ordenarTimes(a: TimePos, b: TimePos): number {
  if (b.pts !== a.pts) return b.pts - a.pts;
  if (b.sg !== a.sg) return b.sg - a.sg;
  if (b.gp !== a.gp) return b.gp - a.gp;
  return a.nome.localeCompare(b.nome);
}

function calcularTabelas(
  jogos: BolaoJogo[],
  palpites: Map<string, BolaoPalpite>
): Map<string, TimePos[]> {
  const tabelas = new Map<string, TimePos[]>();
  // Inicializa todos os times de cada grupo (mesmo sem palpite ainda)
  for (const [letra, times] of Object.entries(GRUPOS_2026)) {
    tabelas.set(
      letra,
      times.map((t) => ({ codigo: t.codigo, nome: t.nome, pts: 0, sg: 0, gp: 0, grupo: letra }))
    );
  }

  const jogosGrupos = jogos.filter((j) => j.fase === "grupos" && j.grupo);
  for (const j of jogosGrupos) {
    // Usa resultado real se finalizado, senão palpite do entregador
    let gc: number | null = null;
    let gf: number | null = null;
    if (j.finalizado && j.gols_casa_real !== null && j.gols_fora_real !== null) {
      gc = j.gols_casa_real;
      gf = j.gols_fora_real;
    } else {
      const p = palpites.get(j.id);
      if (p) {
        gc = p.gols_casa_palpite;
        gf = p.gols_fora_palpite;
      }
    }
    if (gc === null || gf === null) continue;

    const tabela = tabelas.get(j.grupo!);
    if (!tabela) continue;
    const casa = tabela.find((t) => t.nome === j.time_casa || t.codigo === j.codigo_casa);
    const fora = tabela.find((t) => t.nome === j.time_fora || t.codigo === j.codigo_fora);
    if (!casa || !fora) continue;

    casa.gp += gc;
    casa.sg += gc - gf;
    fora.gp += gf;
    fora.sg += gf - gc;
    if (gc > gf) casa.pts += 3;
    else if (gf > gc) fora.pts += 3;
    else {
      casa.pts += 1;
      fora.pts += 1;
    }
  }

  for (const tabela of tabelas.values()) tabela.sort(ordenarTimes);
  return tabelas;
}

function ranquearTerceiros(tabelas: Map<string, TimePos[]>): TimePos[] {
  const terceiros: TimePos[] = [];
  for (const tabela of tabelas.values()) {
    if (tabela[2]) terceiros.push(tabela[2]);
  }
  return terceiros.sort(ordenarTimes).slice(0, 8);
}

// Chaveamento simplificado dos 16 confrontos de R32 (FIFA 2026 – formato 48 seleções).
// Seeds: "1A" = 1º do grupo A, "2B" = 2º do grupo B, "T1".."T8" = 8 melhores 3ºs.
// Obs: a tabela oficial da FIFA pode divergir; se for o caso, ajustar aqui.
const CHAVE_R32: Array<[string, string]> = [
  ["1A", "2B"], ["1C", "2D"], ["1E", "2F"], ["1G", "2H"],
  ["1I", "2J"], ["1K", "2L"], ["2A", "1B"], ["2C", "1D"],
  ["2E", "1F"], ["2G", "1H"], ["2I", "1J"], ["2K", "1L"],
  ["T1", "T2"], ["T3", "T4"], ["T5", "T6"], ["T7", "T8"],
];

function resolverSeed(
  seed: string,
  tabelas: Map<string, TimePos[]>,
  terceiros: TimePos[]
): TimePos | null {
  if (seed.startsWith("T")) {
    const idx = parseInt(seed.slice(1), 10) - 1;
    return terceiros[idx] || null;
  }
  const pos = parseInt(seed[0], 10) - 1;
  const grupo = seed.slice(1);
  const tabela = tabelas.get(grupo);
  return tabela?.[pos] || null;
}

function decidirVencedor(
  jogo: BolaoJogo,
  palpites: Map<string, BolaoPalpite>,
  timeCasa: { nome: string; codigo: string } | null,
  timeFora: { nome: string; codigo: string } | null
): { nome: string; codigo: string } | null {
  if (!timeCasa || !timeFora) return null;
  let gc: number | null = null;
  let gf: number | null = null;
  if (jogo.finalizado && jogo.gols_casa_real !== null && jogo.gols_fora_real !== null) {
    gc = jogo.gols_casa_real;
    gf = jogo.gols_fora_real;
  } else {
    const p = palpites.get(jogo.id);
    if (p) {
      gc = p.gols_casa_palpite;
      gf = p.gols_fora_palpite;
    }
  }
  if (gc === null || gf === null) return null;
  if (gc >= gf) return timeCasa; // empate: casa avança (simplificação)
  return timeFora;
}

export function projetarChaveCompleta(
  jogos: BolaoJogo[],
  palpitesArr: BolaoPalpite[]
): Map<string, ProjecaoSlot> {
  const out = new Map<string, ProjecaoSlot>();
  const palpites = new Map<string, BolaoPalpite>();
  palpitesArr.forEach((p) => palpites.set(p.jogo_id, p));

  const tabelas = calcularTabelas(jogos, palpites);
  const terceiros = ranquearTerceiros(tabelas);

  // ---- R32 ----
  const jogosR32 = jogos
    .filter((j) => j.fase === "oitavas_32")
    .sort((a, b) => a.numero_jogo - b.numero_jogo);
  // mapa: numero_jogo R32 -> vencedor projetado
  const vencedoresR32 = new Map<number, { nome: string; codigo: string }>();

  jogosR32.forEach((j, idx) => {
    const par = CHAVE_R32[idx];
    if (!par) return;
    const casaPos = resolverSeed(par[0], tabelas, terceiros);
    const foraPos = resolverSeed(par[1], tabelas, terceiros);
    const usarProjecao = ehPlaceholder(j.time_casa) || ehPlaceholder(j.time_fora);
    if (usarProjecao && (casaPos || foraPos)) {
      out.set(j.id, {
        time_casa: casaPos?.nome || j.time_casa,
        time_fora: foraPos?.nome || j.time_fora,
        codigo_casa: casaPos?.codigo || j.codigo_casa,
        codigo_fora: foraPos?.codigo || j.codigo_fora,
        projetado: true,
      });
    }
    // vencedor para próxima fase (usa times reais se houver, senão projeção)
    const timeCasa = !ehPlaceholder(j.time_casa) && j.codigo_casa
      ? { nome: j.time_casa, codigo: j.codigo_casa }
      : casaPos
      ? { nome: casaPos.nome, codigo: casaPos.codigo }
      : null;
    const timeFora = !ehPlaceholder(j.time_fora) && j.codigo_fora
      ? { nome: j.time_fora, codigo: j.codigo_fora }
      : foraPos
      ? { nome: foraPos.nome, codigo: foraPos.codigo }
      : null;
    const vencedor = decidirVencedor(j, palpites, timeCasa, timeFora);
    if (vencedor) vencedoresR32.set(j.numero_jogo, vencedor);
  });

  // ---- Oitavas (8 jogos): R32 J1 vs J2, J3 vs J4 ... ----
  const jogosOit = jogos
    .filter((j) => j.fase === "oitavas")
    .sort((a, b) => a.numero_jogo - b.numero_jogo);
  const baseR32 = jogosR32[0]?.numero_jogo ?? 0;
  const vencedoresOit = new Map<number, { nome: string; codigo: string }>();

  jogosOit.forEach((j, idx) => {
    const numCasa = baseR32 + idx * 2;
    const numFora = baseR32 + idx * 2 + 1;
    const vCasa = vencedoresR32.get(numCasa);
    const vFora = vencedoresR32.get(numFora);
    if ((vCasa || vFora) && (ehPlaceholder(j.time_casa) || ehPlaceholder(j.time_fora))) {
      out.set(j.id, {
        time_casa: vCasa?.nome || j.time_casa,
        time_fora: vFora?.nome || j.time_fora,
        codigo_casa: vCasa?.codigo || j.codigo_casa,
        codigo_fora: vFora?.codigo || j.codigo_fora,
        projetado: true,
      });
    }
    const timeCasa = !ehPlaceholder(j.time_casa) && j.codigo_casa
      ? { nome: j.time_casa, codigo: j.codigo_casa }
      : vCasa || null;
    const timeFora = !ehPlaceholder(j.time_fora) && j.codigo_fora
      ? { nome: j.time_fora, codigo: j.codigo_fora }
      : vFora || null;
    const vencedor = decidirVencedor(j, palpites, timeCasa, timeFora);
    if (vencedor) vencedoresOit.set(j.numero_jogo, vencedor);
  });

  // ---- Quartas (4 jogos) ----
  const jogosQua = jogos
    .filter((j) => j.fase === "quartas")
    .sort((a, b) => a.numero_jogo - b.numero_jogo);
  const baseOit = jogosOit[0]?.numero_jogo ?? 0;
  const vencedoresQua = new Map<number, { nome: string; codigo: string }>();

  jogosQua.forEach((j, idx) => {
    const numCasa = baseOit + idx * 2;
    const numFora = baseOit + idx * 2 + 1;
    const vCasa = vencedoresOit.get(numCasa);
    const vFora = vencedoresOit.get(numFora);
    if ((vCasa || vFora) && (ehPlaceholder(j.time_casa) || ehPlaceholder(j.time_fora))) {
      out.set(j.id, {
        time_casa: vCasa?.nome || j.time_casa,
        time_fora: vFora?.nome || j.time_fora,
        codigo_casa: vCasa?.codigo || j.codigo_casa,
        codigo_fora: vFora?.codigo || j.codigo_fora,
        projetado: true,
      });
    }
    const timeCasa = !ehPlaceholder(j.time_casa) && j.codigo_casa
      ? { nome: j.time_casa, codigo: j.codigo_casa }
      : vCasa || null;
    const timeFora = !ehPlaceholder(j.time_fora) && j.codigo_fora
      ? { nome: j.time_fora, codigo: j.codigo_fora }
      : vFora || null;
    const vencedor = decidirVencedor(j, palpites, timeCasa, timeFora);
    if (vencedor) vencedoresQua.set(j.numero_jogo, vencedor);
  });

  // ---- Semifinais (2 jogos): Q1 vs Q2, Q3 vs Q4 ----
  const jogosSemi = jogos
    .filter((j) => j.fase === "semi")
    .sort((a, b) => a.numero_jogo - b.numero_jogo);
  const baseQua = jogosQua[0]?.numero_jogo ?? 0;
  const vencedoresSemi = new Map<number, { nome: string; codigo: string }>();
  const perdedoresSemi = new Map<number, { nome: string; codigo: string }>();

  jogosSemi.forEach((j, idx) => {
    const numCasa = baseQua + idx * 2;
    const numFora = baseQua + idx * 2 + 1;
    const vCasa = vencedoresQua.get(numCasa);
    const vFora = vencedoresQua.get(numFora);
    if ((vCasa || vFora) && (ehPlaceholder(j.time_casa) || ehPlaceholder(j.time_fora))) {
      out.set(j.id, {
        time_casa: vCasa?.nome || j.time_casa,
        time_fora: vFora?.nome || j.time_fora,
        codigo_casa: vCasa?.codigo || j.codigo_casa,
        codigo_fora: vFora?.codigo || j.codigo_fora,
        projetado: true,
      });
    }
    const timeCasa = !ehPlaceholder(j.time_casa) && j.codigo_casa
      ? { nome: j.time_casa, codigo: j.codigo_casa }
      : vCasa || null;
    const timeFora = !ehPlaceholder(j.time_fora) && j.codigo_fora
      ? { nome: j.time_fora, codigo: j.codigo_fora }
      : vFora || null;
    const vencedor = decidirVencedor(j, palpites, timeCasa, timeFora);
    if (vencedor && timeCasa && timeFora) {
      vencedoresSemi.set(j.numero_jogo, vencedor);
      const perdedor = vencedor.codigo === timeCasa.codigo ? timeFora : timeCasa;
      perdedoresSemi.set(j.numero_jogo, perdedor);
    }
  });

  // ---- 3º lugar ----
  const jogoTerc = jogos.find((j) => j.fase === "terceiro");
  const baseSemi = jogosSemi[0]?.numero_jogo ?? 0;
  if (jogoTerc) {
    const pCasa = perdedoresSemi.get(baseSemi);
    const pFora = perdedoresSemi.get(baseSemi + 1);
    if ((pCasa || pFora) && (ehPlaceholder(jogoTerc.time_casa) || ehPlaceholder(jogoTerc.time_fora))) {
      out.set(jogoTerc.id, {
        time_casa: pCasa?.nome || jogoTerc.time_casa,
        time_fora: pFora?.nome || jogoTerc.time_fora,
        codigo_casa: pCasa?.codigo || jogoTerc.codigo_casa,
        codigo_fora: pFora?.codigo || jogoTerc.codigo_fora,
        projetado: true,
      });
    }
  }

  // ---- Final ----
  const jogoFinal = jogos.find((j) => j.fase === "final");
  if (jogoFinal) {
    const vCasa = vencedoresSemi.get(baseSemi);
    const vFora = vencedoresSemi.get(baseSemi + 1);
    if ((vCasa || vFora) && (ehPlaceholder(jogoFinal.time_casa) || ehPlaceholder(jogoFinal.time_fora))) {
      out.set(jogoFinal.id, {
        time_casa: vCasa?.nome || jogoFinal.time_casa,
        time_fora: vFora?.nome || jogoFinal.time_fora,
        codigo_casa: vCasa?.codigo || jogoFinal.codigo_casa,
        codigo_fora: vFora?.codigo || jogoFinal.codigo_fora,
        projetado: true,
      });
    }
  }

  return out;
}

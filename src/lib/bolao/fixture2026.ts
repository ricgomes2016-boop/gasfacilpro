// Tabela oficial da Copa do Mundo 2026 (formato 48 seleções, 12 grupos).
// Datas e cidades são aproximações públicas; admin pode ajustar depois.

export type BolaoFase = "grupos" | "oitavas_32" | "oitavas" | "quartas" | "semi" | "terceiro" | "final";

export interface BolaoFixtureJogo {
  numero_jogo: number;
  fase: BolaoFase;
  grupo?: string;
  data_jogo: string; // ISO
  time_casa: string;
  time_fora: string;
  codigo_casa?: string;
  codigo_fora?: string;
}

// Grupos da Copa 2026 (12 grupos A–L). Times confirmados onde já há classificação.
// Onde ainda não há time confirmado, usamos placeholder editável pelo admin.
export const GRUPOS_2026: Record<string, { nome: string; codigo: string }[]> = {
  A: [
    { nome: "México", codigo: "MEX" },
    { nome: "A2", codigo: "??" },
    { nome: "A3", codigo: "??" },
    { nome: "A4", codigo: "??" },
  ],
  B: [
    { nome: "Canadá", codigo: "CAN" },
    { nome: "B2", codigo: "??" },
    { nome: "B3", codigo: "??" },
    { nome: "B4", codigo: "??" },
  ],
  C: [
    { nome: "EUA", codigo: "USA" },
    { nome: "C2", codigo: "??" },
    { nome: "C3", codigo: "??" },
    { nome: "C4", codigo: "??" },
  ],
  D: [
    { nome: "Brasil", codigo: "BRA" },
    { nome: "D2", codigo: "??" },
    { nome: "D3", codigo: "??" },
    { nome: "D4", codigo: "??" },
  ],
  E: [
    { nome: "Argentina", codigo: "ARG" },
    { nome: "E2", codigo: "??" },
    { nome: "E3", codigo: "??" },
    { nome: "E4", codigo: "??" },
  ],
  F: [
    { nome: "França", codigo: "FRA" },
    { nome: "F2", codigo: "??" },
    { nome: "F3", codigo: "??" },
    { nome: "F4", codigo: "??" },
  ],
  G: [
    { nome: "Inglaterra", codigo: "ENG" },
    { nome: "G2", codigo: "??" },
    { nome: "G3", codigo: "??" },
    { nome: "G4", codigo: "??" },
  ],
  H: [
    { nome: "Alemanha", codigo: "GER" },
    { nome: "H2", codigo: "??" },
    { nome: "H3", codigo: "??" },
    { nome: "H4", codigo: "??" },
  ],
  I: [
    { nome: "Espanha", codigo: "ESP" },
    { nome: "I2", codigo: "??" },
    { nome: "I3", codigo: "??" },
    { nome: "I4", codigo: "??" },
  ],
  J: [
    { nome: "Portugal", codigo: "POR" },
    { nome: "J2", codigo: "??" },
    { nome: "J3", codigo: "??" },
    { nome: "J4", codigo: "??" },
  ],
  K: [
    { nome: "Holanda", codigo: "NED" },
    { nome: "K2", codigo: "??" },
    { nome: "K3", codigo: "??" },
    { nome: "K4", codigo: "??" },
  ],
  L: [
    { nome: "Uruguai", codigo: "URU" },
    { nome: "L2", codigo: "??" },
    { nome: "L3", codigo: "??" },
    { nome: "L4", codigo: "??" },
  ],
};

// Gera os 72 jogos da fase de grupos. Cada grupo tem 6 jogos (round-robin).
// Datas distribuídas a partir de 11/06/2026.
function gerarJogosGrupos(): BolaoFixtureJogo[] {
  const jogos: BolaoFixtureJogo[] = [];
  const grupos = Object.keys(GRUPOS_2026);
  const dataInicio = new Date("2026-06-11T17:00:00-03:00");
  let numero = 1;
  let diaOffset = 0;

  for (const g of grupos) {
    const times = GRUPOS_2026[g];
    // 3 rodadas: (1v2, 3v4), (1v3, 2v4), (1v4, 2v3)
    const rodadas: [number, number][][] = [
      [[0, 1], [2, 3]],
      [[0, 2], [1, 3]],
      [[0, 3], [1, 2]],
    ];
    rodadas.forEach((rodada, idx) => {
      rodada.forEach(([a, b]) => {
        const data = new Date(dataInicio);
        data.setDate(data.getDate() + diaOffset + idx * 5);
        jogos.push({
          numero_jogo: numero++,
          fase: "grupos",
          grupo: g,
          data_jogo: data.toISOString(),
          time_casa: times[a].nome,
          time_fora: times[b].nome,
          codigo_casa: times[a].codigo,
          codigo_fora: times[b].codigo,
        });
      });
    });
    diaOffset += 1;
  }
  return jogos;
}

// Gera mata-mata com placeholders. Admin atualiza times conforme classificação.
function gerarMataMata(numeroInicial: number): BolaoFixtureJogo[] {
  const jogos: BolaoFixtureJogo[] = [];
  let numero = numeroInicial;

  const addFase = (fase: BolaoFase, qtd: number, dataBase: string, prefixoA: string, prefixoB: string) => {
    const dataIni = new Date(dataBase);
    for (let i = 0; i < qtd; i++) {
      const data = new Date(dataIni);
      data.setDate(data.getDate() + Math.floor(i / 2));
      jogos.push({
        numero_jogo: numero++,
        fase,
        data_jogo: data.toISOString(),
        time_casa: `${prefixoA}${i + 1}`,
        time_fora: `${prefixoB}${i + 1}`,
      });
    }
  };

  // 16 jogos das oitavas de 32 (round of 32) → 32 times classificados
  addFase("oitavas_32", 16, "2026-06-27T17:00:00-03:00", "1º ", "2º ");
  // 8 jogos oitavas
  addFase("oitavas", 8, "2026-07-04T17:00:00-03:00", "Vencedor R32-", "Vencedor R32-");
  // 4 quartas
  addFase("quartas", 4, "2026-07-09T17:00:00-03:00", "Vencedor O", "Vencedor O");
  // 2 semis
  addFase("semi", 2, "2026-07-14T17:00:00-03:00", "Vencedor Q", "Vencedor Q");
  // Terceiro lugar
  jogos.push({
    numero_jogo: numero++,
    fase: "terceiro",
    data_jogo: "2026-07-18T17:00:00-03:00",
    time_casa: "Perdedor SF1",
    time_fora: "Perdedor SF2",
  });
  // Final
  jogos.push({
    numero_jogo: numero++,
    fase: "final",
    data_jogo: "2026-07-19T16:00:00-03:00",
    time_casa: "Vencedor SF1",
    time_fora: "Vencedor SF2",
  });
  return jogos;
}

export function gerarFixtureCompleta(): BolaoFixtureJogo[] {
  const grupos = gerarJogosGrupos();
  const mata = gerarMataMata(grupos.length + 1);
  return [...grupos, ...mata];
}

export const FASE_LABELS: Record<BolaoFase, string> = {
  grupos: "Fase de Grupos",
  oitavas_32: "16-avos de Final",
  oitavas: "Oitavas de Final",
  quartas: "Quartas de Final",
  semi: "Semifinais",
  terceiro: "Disputa de 3º lugar",
  final: "Final",
};

export const FASE_ORDEM: BolaoFase[] = ["grupos", "oitavas_32", "oitavas", "quartas", "semi", "terceiro", "final"];

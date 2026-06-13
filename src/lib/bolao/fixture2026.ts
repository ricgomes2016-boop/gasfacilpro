// Tabela oficial da Copa do Mundo 2026 (formato 48 seleções, 12 grupos).
// Times conforme tabela impressa das farmácias parceiras.
// Datas são aproximações — admin pode finalizar com placar real a qualquer momento.

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

// Grupos oficiais da Copa 2026 (A–L) conforme tabela impressa.
export const GRUPOS_2026: Record<string, { nome: string; codigo: string }[]> = {
  A: [
    { nome: "México", codigo: "MEX" },
    { nome: "África do Sul", codigo: "RSA" },
    { nome: "República Tcheca", codigo: "CZE" },
    { nome: "Coreia do Sul", codigo: "KOR" },
  ],
  B: [
    { nome: "Canadá", codigo: "CAN" },
    { nome: "Suíça", codigo: "SUI" },
    { nome: "Catar", codigo: "QAT" },
    { nome: "Bósnia e Herzegovina", codigo: "BIH" },
  ],
  C: [
    { nome: "Brasil", codigo: "BRA" },
    { nome: "Escócia", codigo: "SCO" },
    { nome: "Haiti", codigo: "HAI" },
    { nome: "Marrocos", codigo: "MAR" },
  ],
  D: [
    { nome: "Estados Unidos", codigo: "USA" },
    { nome: "Austrália", codigo: "AUS" },
    { nome: "Turquia", codigo: "TUR" },
    { nome: "Paraguai", codigo: "PAR" },
  ],
  E: [
    { nome: "Alemanha", codigo: "GER" },
    { nome: "Costa do Marfim", codigo: "CIV" },
    { nome: "Equador", codigo: "ECU" },
    { nome: "Curaçao", codigo: "CUW" },
  ],
  F: [
    { nome: "Japão", codigo: "JPN" },
    { nome: "Suécia", codigo: "SWE" },
    { nome: "Tunísia", codigo: "TUN" },
    { nome: "Holanda", codigo: "NED" },
  ],
  G: [
    { nome: "Bélgica", codigo: "BEL" },
    { nome: "Irã", codigo: "IRN" },
    { nome: "Egito", codigo: "EGY" },
    { nome: "Nova Zelândia", codigo: "NZL" },
  ],
  H: [
    { nome: "Espanha", codigo: "ESP" },
    { nome: "Arábia Saudita", codigo: "KSA" },
    { nome: "Cabo Verde", codigo: "CPV" },
    { nome: "Uruguai", codigo: "URU" },
  ],
  I: [
    { nome: "França", codigo: "FRA" },
    { nome: "Senegal", codigo: "SEN" },
    { nome: "Iraque", codigo: "IRQ" },
    { nome: "Noruega", codigo: "NOR" },
  ],
  J: [
    { nome: "Áustria", codigo: "AUT" },
    { nome: "Argentina", codigo: "ARG" },
    { nome: "Argélia", codigo: "ALG" },
    { nome: "Jordânia", codigo: "JOR" },
  ],
  K: [
    { nome: "Portugal", codigo: "POR" },
    { nome: "Colômbia", codigo: "COL" },
    { nome: "Uzbequistão", codigo: "UZB" },
    { nome: "RD do Congo", codigo: "CGO" },
  ],
  L: [
    { nome: "Inglaterra", codigo: "ENG" },
    { nome: "Gana", codigo: "GHA" },
    { nome: "Panamá", codigo: "PAN" },
    { nome: "Croácia", codigo: "CRO" },
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

  // Fase de 32 — 16 jogos: 28/06 a 03/07/2026
  const datasR32 = [
    "2026-06-28T16:00:00-03:00", "2026-06-28T20:00:00-03:00",
    "2026-06-29T16:00:00-03:00", "2026-06-29T20:00:00-03:00",
    "2026-06-30T16:00:00-03:00", "2026-06-30T20:00:00-03:00",
    "2026-07-01T16:00:00-03:00", "2026-07-01T20:00:00-03:00",
    "2026-07-02T16:00:00-03:00", "2026-07-02T20:00:00-03:00",
    "2026-07-03T16:00:00-03:00", "2026-07-03T20:00:00-03:00",
    "2026-06-29T13:00:00-03:00", "2026-06-30T13:00:00-03:00",
    "2026-07-02T13:00:00-03:00", "2026-07-03T13:00:00-03:00",
  ];
  for (let i = 0; i < 16; i++) {
    jogos.push({
      numero_jogo: numero++,
      fase: "oitavas_32",
      data_jogo: datasR32[i],
      time_casa: `Classif. R32 J${i * 2 + 1}`,
      time_fora: `Classif. R32 J${i * 2 + 2}`,
    });
  }

  // Oitavas (16 → 8) — 04/07 a 07/07
  const datasOit = [
    "2026-07-04T13:00:00-03:00", "2026-07-04T17:00:00-03:00",
    "2026-07-05T13:00:00-03:00", "2026-07-05T17:00:00-03:00",
    "2026-07-06T13:00:00-03:00", "2026-07-06T17:00:00-03:00",
    "2026-07-07T13:00:00-03:00", "2026-07-07T17:00:00-03:00",
  ];
  for (let i = 0; i < 8; i++) {
    jogos.push({
      numero_jogo: numero++,
      fase: "oitavas",
      data_jogo: datasOit[i],
      time_casa: `Vencedor R32-${i * 2 + 1}`,
      time_fora: `Vencedor R32-${i * 2 + 2}`,
    });
  }

  // Quartas — 09/07 a 11/07
  const datasQuartas = [
    "2026-07-09T17:00:00-03:00", "2026-07-09T21:00:00-03:00",
    "2026-07-11T13:00:00-03:00", "2026-07-11T17:00:00-03:00",
  ];
  for (let i = 0; i < 4; i++) {
    jogos.push({
      numero_jogo: numero++,
      fase: "quartas",
      data_jogo: datasQuartas[i],
      time_casa: `Vencedor O${i * 2 + 1}`,
      time_fora: `Vencedor O${i * 2 + 2}`,
    });
  }

  // Semi — 14/07 e 15/07
  jogos.push({
    numero_jogo: numero++,
    fase: "semi",
    data_jogo: "2026-07-14T17:00:00-03:00",
    time_casa: "Vencedor Q1",
    time_fora: "Vencedor Q2",
  });
  jogos.push({
    numero_jogo: numero++,
    fase: "semi",
    data_jogo: "2026-07-15T17:00:00-03:00",
    time_casa: "Vencedor Q3",
    time_fora: "Vencedor Q4",
  });

  // Terceiro lugar — 18/07
  jogos.push({
    numero_jogo: numero++,
    fase: "terceiro",
    data_jogo: "2026-07-18T17:00:00-03:00",
    time_casa: "Perdedor SF1",
    time_fora: "Perdedor SF2",
  });

  // Final — 19/07
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
  oitavas_32: "Fase de 32 (16-avos)",
  oitavas: "Oitavas de Final",
  quartas: "Quartas de Final",
  semi: "Semifinais",
  terceiro: "Disputa de 3º lugar",
  final: "Final",
};

export const FASE_ORDEM: BolaoFase[] = ["grupos", "oitavas_32", "oitavas", "quartas", "semi", "terceiro", "final"];

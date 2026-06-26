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

// Tabela oficial impressa (12 grupos × 6 jogos = 72 jogos). Horário de Brasília.
// Formato: [grupo, dataISO, mandante, visitante]
const TABELA_OFICIAL: Array<[string, string, string, string]> = [
  // Grupo A
  ["A", "2026-06-11T16:00:00-03:00", "México", "África do Sul"],
  ["A", "2026-06-11T23:00:00-03:00", "Coreia do Sul", "República Tcheca"],
  ["A", "2026-06-18T13:00:00-03:00", "República Tcheca", "África do Sul"],
  ["A", "2026-06-18T22:00:00-03:00", "México", "Coreia do Sul"],
  ["A", "2026-06-24T22:00:00-03:00", "República Tcheca", "México"],
  ["A", "2026-06-24T22:00:00-03:00", "África do Sul", "Coreia do Sul"],
  // Grupo B
  ["B", "2026-06-12T16:00:00-03:00", "Canadá", "Bósnia e Herzegovina"],
  ["B", "2026-06-13T16:00:00-03:00", "Catar", "Suíça"],
  ["B", "2026-06-18T16:00:00-03:00", "Suíça", "Bósnia e Herzegovina"],
  ["B", "2026-06-18T19:00:00-03:00", "Canadá", "Catar"],
  ["B", "2026-06-24T16:00:00-03:00", "Suíça", "Canadá"],
  ["B", "2026-06-24T16:00:00-03:00", "Bósnia e Herzegovina", "Catar"],
  // Grupo C
  ["C", "2026-06-13T19:00:00-03:00", "Brasil", "Marrocos"],
  ["C", "2026-06-13T22:00:00-03:00", "Haiti", "Escócia"],
  ["C", "2026-06-19T19:00:00-03:00", "Escócia", "Marrocos"],
  ["C", "2026-06-19T21:30:00-03:00", "Brasil", "Haiti"],
  ["C", "2026-06-24T19:00:00-03:00", "Escócia", "Brasil"],
  ["C", "2026-06-24T19:00:00-03:00", "Marrocos", "Haiti"],
  // Grupo D
  ["D", "2026-06-12T22:00:00-03:00", "Estados Unidos", "Paraguai"],
  ["D", "2026-06-14T01:00:00-03:00", "Austrália", "Turquia"],
  ["D", "2026-06-19T16:00:00-03:00", "Estados Unidos", "Austrália"],
  ["D", "2026-06-20T01:00:00-03:00", "Turquia", "Paraguai"],
  ["D", "2026-06-25T23:00:00-03:00", "Turquia", "Estados Unidos"],
  ["D", "2026-06-25T23:00:00-03:00", "Paraguai", "Austrália"],
  // Grupo E
  ["E", "2026-06-14T14:00:00-03:00", "Alemanha", "Curaçao"],
  ["E", "2026-06-14T20:00:00-03:00", "Costa do Marfim", "Equador"],
  ["E", "2026-06-20T17:00:00-03:00", "Alemanha", "Costa do Marfim"],
  ["E", "2026-06-20T21:00:00-03:00", "Equador", "Curaçao"],
  ["E", "2026-06-25T17:00:00-03:00", "Equador", "Alemanha"],
  ["E", "2026-06-25T17:00:00-03:00", "Curaçao", "Costa do Marfim"],
  // Grupo F
  ["F", "2026-06-14T17:00:00-03:00", "Holanda", "Japão"],
  ["F", "2026-06-14T23:00:00-03:00", "Suécia", "Tunísia"],
  ["F", "2026-06-20T14:00:00-03:00", "Holanda", "Suécia"],
  ["F", "2026-06-20T23:00:00-03:00", "Tunísia", "Japão"],
  ["F", "2026-06-25T20:00:00-03:00", "Japão", "Suécia"],
  ["F", "2026-06-25T20:00:00-03:00", "Tunísia", "Holanda"],
  // Grupo G
  ["G", "2026-06-15T16:00:00-03:00", "Bélgica", "Egito"],
  ["G", "2026-06-15T22:00:00-03:00", "Irã", "Nova Zelândia"],
  ["G", "2026-06-21T16:00:00-03:00", "Bélgica", "Irã"],
  ["G", "2026-06-21T22:00:00-03:00", "Nova Zelândia", "Egito"],
  ["G", "2026-06-27T00:00:00-03:00", "Egito", "Irã"],
  ["G", "2026-06-27T00:00:00-03:00", "Nova Zelândia", "Bélgica"],
  // Grupo H
  ["H", "2026-06-15T13:00:00-03:00", "Espanha", "Cabo Verde"],
  ["H", "2026-06-15T19:00:00-03:00", "Arábia Saudita", "Uruguai"],
  ["H", "2026-06-21T13:00:00-03:00", "Espanha", "Arábia Saudita"],
  ["H", "2026-06-21T19:00:00-03:00", "Uruguai", "Cabo Verde"],
  ["H", "2026-06-26T21:00:00-03:00", "Cabo Verde", "Arábia Saudita"],
  ["H", "2026-06-26T21:00:00-03:00", "Uruguai", "Espanha"],
  // Grupo I
  ["I", "2026-06-16T16:00:00-03:00", "França", "Senegal"],
  ["I", "2026-06-16T19:00:00-03:00", "Iraque", "Noruega"],
  ["I", "2026-06-22T18:00:00-03:00", "França", "Iraque"],
  ["I", "2026-06-22T21:00:00-03:00", "Noruega", "Senegal"],
  ["I", "2026-06-26T16:00:00-03:00", "Noruega", "França"],
  ["I", "2026-06-26T16:00:00-03:00", "Senegal", "Iraque"],
  // Grupo J
  ["J", "2026-06-16T22:00:00-03:00", "Argentina", "Argélia"],
  ["J", "2026-06-17T01:00:00-03:00", "Áustria", "Jordânia"],
  ["J", "2026-06-22T14:00:00-03:00", "Argentina", "Áustria"],
  ["J", "2026-06-23T00:00:00-03:00", "Jordânia", "Argélia"],
  ["J", "2026-06-27T23:00:00-03:00", "Argélia", "Áustria"],
  ["J", "2026-06-27T23:00:00-03:00", "Jordânia", "Argentina"],
  // Grupo K
  ["K", "2026-06-17T14:00:00-03:00", "Portugal", "RD do Congo"],
  ["K", "2026-06-17T21:00:00-03:00", "Uzbequistão", "Colômbia"],
  ["K", "2026-06-23T14:00:00-03:00", "Portugal", "Uzbequistão"],
  ["K", "2026-06-23T23:00:00-03:00", "Colômbia", "RD do Congo"],
  ["K", "2026-06-27T20:30:00-03:00", "Colômbia", "Portugal"],
  ["K", "2026-06-27T20:30:00-03:00", "RD do Congo", "Uzbequistão"],
  // Grupo L
  ["L", "2026-06-17T17:00:00-03:00", "Inglaterra", "Croácia"],
  ["L", "2026-06-17T20:00:00-03:00", "Gana", "Panamá"],
  ["L", "2026-06-23T17:00:00-03:00", "Inglaterra", "Gana"],
  ["L", "2026-06-23T20:00:00-03:00", "Panamá", "Croácia"],
  ["L", "2026-06-27T18:00:00-03:00", "Panamá", "Inglaterra"],
  ["L", "2026-06-27T18:00:00-03:00", "Croácia", "Gana"],
];

function codigoDoTime(nome: string): string | undefined {
  for (const grupo of Object.values(GRUPOS_2026)) {
    const t = grupo.find((x) => x.nome === nome);
    if (t) return t.codigo;
  }
  return undefined;
}

function gerarJogosGrupos(): BolaoFixtureJogo[] {
  return TABELA_OFICIAL.map(([grupo, data, casa, fora], idx) => ({
    numero_jogo: idx + 1,
    fase: "grupos" as const,
    grupo,
    data_jogo: new Date(data).toISOString(),
    time_casa: casa,
    time_fora: fora,
    codigo_casa: codigoDoTime(casa),
    codigo_fora: codigoDoTime(fora),
  }));
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

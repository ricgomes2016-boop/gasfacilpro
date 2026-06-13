## Objetivo

Substituir a tabela placeholder do bolão pela tabela oficial mostrada nas fotos (mesma usada nas farmácias parceiras), com seleções reais, datas e horários corretos em todas as fases.

## O que vai mudar

### 1. `src/lib/bolao/fixture2026.ts` — tabela oficial completa

**Fase de Grupos (jogos 1–72)** — substituir os placeholders "A2/A3/B2..." pelas seleções reais conforme as fotos:

- **A** — México, África do Sul, República Tcheca, Coreia do Sul
- **B** — Canadá, Suíça, Catar, Bósnia e Herzegovina
- **C** — Brasil, Escócia, Haiti, Marrocos
- **D** — Estados Unidos, Austrália, Turquia, Paraguai
- **E** — Alemanha, Costa do Marfim, Equador, Curaçao
- **F** — Japão, Suécia, Tunísia, Holanda
- **G** — Bélgica, Irã, Egito, Nova Zelândia
- **H** — Espanha, Arábia Saudita, Cabo Verde, Uruguai
- **I** — França, Senegal, Iraque, Noruega
- **J** — Áustria, Argentina, Argélia, Jordânia
- **K** — Portugal, Colômbia, Uzbequistão, RD do Congo
- **L** — Inglaterra, Gana, Panamá, Croácia

Cada grupo tem 6 confrontos com datas/horários extraídos das fotos (ex.: GRUPO A — 11/06 16:00 México×África do Sul, 11/06 23:00 Coreia do Sul×Rep. Tcheca, 18/06 13:00 Rep. Tcheca×África do Sul, 18/06 22:00 México×Coreia do Sul, 24/06 22:00 Rep. Tcheca×México, 24/06 22:00 África do Sul×Coreia do Sul). Aplicar o mesmo para B–L.

**Mata-mata (jogos 73–104)** — manter placeholders de classificação (ex.: "1º A × 2º B"), mas atualizar datas:

- Fase de 32 (jogos 73–88): 28/06 a 03/07/2026
- Oitavas de Final (jogos 89–96): 04/07 a 07/07/2026
- Quartas de Final (jogos 97–100): 09/07 a 11/07/2026
- Semifinal (jogos 101 e 102): 14/07 e 15/07/2026
- 3º e 4º lugar (jogo 103): 18/07/2026
- Final (jogo 104): 19/07/2026

Adicionar/atualizar códigos FIFA dos países (BRA, ARG, FRA, ENG, GER, ESP, POR, NED, USA, MEX, CAN, JPN, KOR, AUS, MAR, SEN, CIV, GHA, EGY, IRN, KSA, QAT, TUN, RSA, CHI, COL, PER, ECU, PAR, URU, CRC, JAM, CRO, SUI, BIH, SCO, HAI, SWE, BEL, NZL, CPV, IRQ, NOR, AUT, ALG, JOR, CGO, UZB, PAN, CUW) para que as bandeiras `bandeiraEmoji()` (já criada) renderizem corretamente. Faltam alguns no map atual — vou ampliar `src/lib/bolao/flags.ts`.

### 2. `src/pages/operacional/BolaoAdmin.tsx` — permitir reimportar

Hoje o botão "Importar tabela" fica desabilitado quando já há jogos. Como a unidade já importou a versão antiga com placeholders, vou:

- Trocar o botão por **"Reimportar tabela oficial"** quando já houver jogos.
- Pedir confirmação (`window.confirm`) antes de reimportar.
- Acionar um novo modo do hook `useImportarTabela` que apaga os jogos atuais (e palpites em cascade — já existe o FK) da unidade antes de inserir os novos. Os palpites zerados serão refeitos pelos entregadores.

### 3. `src/hooks/useBolao.ts` — modo de reimportação

Adicionar um parâmetro `reimportar?: boolean` em `useImportarTabela`:
- Se `true`: `DELETE FROM bolao_jogos WHERE unidade_id = ?` antes do insert (palpites caem em cascade via FK).
- Se `false` (default): comportamento atual.

## Validação

- Abrir `/operacional/bolao-admin` → clicar "Reimportar tabela oficial" → confirmar → ver os 104 jogos com seleções reais, datas corretas e bandeiras nos cards.
- Filtrar por Grupo A e conferir os 6 jogos com nomes/horários iguais à foto.
- Abrir `/entregador/bolao` no app do entregador → confirmar que aparecem os mesmos jogos para palpitar.

## O que NÃO vai mudar

- Estrutura do banco (`bolao_jogos`, `bolao_palpites`) e RLS — já estão corretas.
- Trigger de cálculo de pontos (10 placar exato / 5 vencedor / 0 errado).
- Layout da tela admin (cards, filtros, agrupamento por grupo) feito na rodada anterior.
- Rotas, `App.tsx`, providers.

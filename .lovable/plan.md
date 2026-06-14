## Auto-preenchimento do mata-mata no app do entregador

Projeção visual (sem gravar no banco) que, a partir dos palpites do entregador na fase de grupos e no mata-mata, calcula os classificados e auto-preenche os times de R32 → Oitavas → Quartas → Semi → 3º → Final, em tempo real.

### Arquivos novos

**`src/lib/bolao/projecao.ts`** — biblioteca pura, sem side-effects, com:

1. `calcularTabelaGrupo(jogos, palpites)` — para cada grupo (A–L), aplica os palpites como se fossem o resultado oficial:
   - 3 pts vitória, 1 empate, 0 derrota
   - desempate: pontos → saldo de gols → gols pró → ordem alfabética (estável)
   - retorna `{ grupo, posicoes: [{codigo, nome, pts, sg, gp}, ...] }`
2. `ranquearTerceiros(tabelas)` — pega o 3º colocado de cada grupo, ordena pelos mesmos critérios e devolve os **8 melhores** (com a letra do grupo).
3. `montarChaveR32(tabelas, terceiros)` — aplica o **chaveamento oficial FIFA 2026** (cruzamento por posição de grupo divulgado pela FIFA). Como existem 16 confrontos × 2 slots, hard-coded como matriz `[ [seedCasa, seedFora], ... ]` onde cada seed é `"1A"`, `"2B"` ou `"3rank-N"` (N = 1..8). Saída: array de 16 confrontos `{ jogoIdx, casa: TeamRef, fora: TeamRef }`.
4. `avancarMataMata(jogosR32, palpitesR32)` — para cada confronto de R32 com palpite, decide o vencedor (placar maior; empate ⇒ casa por simplicidade, com flag visual de "empate, defina manualmente"). Devolve mapa `numero_jogo → codigo vencedor`.
5. `projetarChaveCompleta(jogos, palpites)` — orquestra tudo e devolve `Map<jogoId, { time_casa, time_fora, codigo_casa, codigo_fora }>` cobrindo R32 (sempre, se grupos estão completos), oitavas, quartas, semi, 3º, final — cada fase só preenche se a anterior estiver toda palpitada para aquele ramo.

> **Nota técnica do chaveamento FIFA 2026**: a tabela exata de 16-avos depende do regulamento publicado em 2025. Vou usar o cruzamento divulgado pela FIFA em mar/2024 (top-2 + 8 melhores 3ºs, com bracket fixo). Se aparecer divergência com a tabela impressa da farmácia, reportar antes de mudar dados.

### Arquivos editados

**`src/pages/entregador/EntregadorBolao.tsx`**
- Importar `projetarChaveCompleta`.
- `const projecao = useMemo(() => projetarChaveCompleta(jogos, meusPalpites), [jogos, meusPalpites])`.
- No `JogoCard`, ao renderizar, se `jogo.fase !== "grupos"` e os times atuais são placeholders (começam com `"Classif."`, `"Vencedor"` ou `"Perdedor"`), substituir `time_casa/codigo_casa/time_fora/codigo_fora` pelos valores de `projecao.get(jogo.id)` quando existirem. Times reais (já preenchidos pelo admin) **sempre prevalecem**.
- Badge sutil "projetado" quando o nome veio da projeção, para diferenciar do oficial.
- Passar a projeção como prop para `JogoCard`.

### Fora de escopo
- Não grava nada em `bolao_jogos` nem em `bolao_palpites`.
- Não altera `BolaoAdmin.tsx` (admin continua dono dos times oficiais).
- Sem mudanças em hooks, schema ou RLS.
- Sem mexer em `fixture2026.ts` (a menos que apareça divergência de chaveamento — reportar antes).

### Validação
Após implementar, abrir a aba Jogos no app, conferir que:
1. Com todos os jogos de grupos palpitados, R32 mostra 32 times reais.
2. Palpitando um jogo de R32, o slot correspondente nas Oitavas atualiza imediatamente.
3. Times já finalizados pelo admin não são sobrescritos pela projeção.

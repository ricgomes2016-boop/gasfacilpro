# Bolão Copa do Mundo 2026 — App Entregador

Página temporária no app do entregador para palpitar jogos da Copa 2026 (grupos + mata-mata), com pontuação automática quando o admin/gestor cadastra o resultado real.

## Banco de dados (Lovable Cloud)

3 tabelas novas em `public`, todas com `unidade_id` + `empresa_id` para respeitar o isolamento multi-tenant.

### `bolao_jogos`
Jogos oficiais cadastrados pelo admin (uma vez para a unidade).
- `fase` (`grupos` | `oitavas` | `quartas` | `semi` | `terceiro` | `final`)
- `grupo` (A–L, opcional)
- `numero_jogo` (sequência da FIFA)
- `data_jogo` (timestamptz)
- `time_casa`, `time_fora` (texto + código país p/ bandeira)
- `gols_casa_real`, `gols_fora_real` (nullable até admin lançar)
- `finalizado` (bool)
- `unidade_id`, `empresa_id`

RLS: leitura para todos autenticados da unidade; insert/update só admin ou gestor.

### `bolao_palpites`
Palpite do entregador para cada jogo.
- `jogo_id` → `bolao_jogos`
- `user_id` (auth.uid())
- `gols_casa_palpite`, `gols_fora_palpite`
- `pontos` (calculado por trigger quando jogo é finalizado: 10 placar exato, 5 vencedor/empate correto, 0 errou)
- `unidade_id`, `empresa_id`
- UNIQUE (`jogo_id`, `user_id`)

RLS: cada entregador vê/edita só seus palpites; admin/gestor vê todos da unidade. Palpite bloqueado após `data_jogo` ou `finalizado=true`.

### Trigger `recalcular_pontos_palpites`
Quando `bolao_jogos.finalizado` vira `true` (ou os gols reais mudam), recalcula `pontos` em todos os `bolao_palpites` daquele jogo.

### Seed inicial
Após a migration, popular `bolao_jogos` com a tabela oficial da Copa 2026: 12 grupos × 6 jogos = 72 jogos de grupos + 32 oitavas + 16 oitavas-de-final + 8 quartas + 4 semis + 1 terceiro lugar + 1 final = ~104 jogos. Times reais nos grupos; mata-mata com placeholders (`1º Grupo A`, `2º Grupo B`, etc.) atualizáveis pelo admin conforme classificação.

## Frontend

### Rota do entregador: `/entregador/bolao`
Página `EntregadorBolao.tsx` com 3 abas (Tabs do shadcn):

1. **Jogos** — lista por fase (Grupos → Oitavas → … → Final). Em cada card:
   - Bandeiras + nomes das seleções, data/hora local.
   - 2 inputs numéricos pequenos (palpite casa × palpite fora). Auto-save com debounce.
   - Se já finalizado: mostra placar real ao lado, badge "Acertou X pts" (verde 10, azul 5, cinza 0).
   - Inputs ficam disabled quando `data_jogo` já passou ou `finalizado=true`.

2. **Meu desempenho** — total de pontos, nº de placares exatos, nº de vencedores acertados, % aproveitamento, posição no ranking da unidade.

3. **Ranking** — top entregadores da unidade por pontos.

Adicionar item no menu lateral do entregador (`EntregadorLayout.tsx`) com ícone `Trophy` → "Bolão Copa".

### Rota admin/gestor: `/operacional/bolao-admin`
Página `BolaoAdmin.tsx` (dentro do MainLayout do ERP) listando jogos da unidade. Para cada jogo:
- 2 inputs (placar real casa × fora) + botão **Finalizar jogo** (seta `finalizado=true`, dispara trigger que recalcula pontos).
- Botão "Reabrir" para corrigir erro.
- Botão "Importar tabela oficial" no topo (executa o seed caso a unidade ainda não tenha jogos).

Acesso restrito por role `admin`/`gestor` no `routeConfig` existente.

### Hooks
`src/hooks/useBolao.ts` com queries React Query:
- `useBolaoJogos(unidadeId)` — lista de jogos + palpite do usuário (join).
- `useSalvarPalpite()` — mutation upsert.
- `useRankingBolao(unidadeId)`, `useMeuDesempenho(userId, unidadeId)`.
- `useFinalizarJogo()` (admin) — update placar real + finalizado.

## Pontuação (regra)
Trigger SQL no insert/update de `bolao_jogos.finalizado`:
- Placar exato: **10 pontos**
- Acertou vencedor (ou empate) mas placar errado: **5 pontos**
- Errou: **0 pontos**
- Sem palpite registrado: 0 (não conta).

## Escopo
**Novos arquivos:**
- migration SQL (3 tabelas + grants + RLS + trigger + função recalcular)
- `src/pages/entregador/EntregadorBolao.tsx`
- `src/pages/operacional/BolaoAdmin.tsx`
- `src/hooks/useBolao.ts`
- `src/components/bolao/JogoCard.tsx`, `RankingList.tsx`, `BandeiraPais.tsx`

**Arquivos alterados (mínimo):**
- `src/routes/entregadorRoutes.ts` — adicionar `/entregador/bolao`.
- `src/routes/operacionalRoutes.ts` — adicionar `/operacional/bolao-admin`.
- `src/components/entregador/EntregadorLayout.tsx` — item no menu.

Nada em `App.tsx`, providers, ou rotas existentes é alterado.

## Validação
- Migration cria tabelas + RLS + trigger.
- Seed popula 104 jogos da Copa 2026.
- Entregador entra em `/entregador/bolao`, palpita placar, vê auto-save.
- Admin lança placar real em `/operacional/bolao-admin` → marca finalizado → palpite do entregador ganha 0/5/10 pts automaticamente.
- Ranking atualiza em tempo real (React Query invalidate).

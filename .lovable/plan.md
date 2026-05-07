## Contexto

A aba **Chamadas** em `src/pages/atendimento/CentralAtendimento.tsx` já lê da tabela `chamadas_recebidas` (mesma tabela alimentada pelo `twilio-voice-webhook` quando alguém liga para o DID Twilio/Vonage e fala com a Bia), mas hoje:

- Mostra **apenas chamadas do dia atual** (`gte inicioHoje`).
- Não exibe **DID** (número que recebeu a ligação), **duração** nem **observações** (ex.: "Encaminhada via 0800/operadora").
- Não tem filtro de **período**.

O usuário quer ver o registro das ligações na aba Chamadas — hoje quem queria histórico precisava ir em `/admin/chamadas-recebidas` (página admin já existente).

## Mudanças (apenas em `CentralAtendimento.tsx`)

1. **Filtro de período** (Select novo ao lado do filtro Status): `Hoje | 7 dias | 30 dias`. Default: `Hoje`. A query passa a usar `gte("created_at", inicio)` calculado dinamicamente.
2. **Ampliar a interface `Chamada**` para incluir `did`, `duracao_segundos`, `observacoes`, `unidade_id`, `empresa_id`. Selecionar todos no `select("*")` (já é `*`, só tipar).
3. **Filtrar por unidade atual** quando `unidadeAtual?.id` existir (`.eq("unidade_id", unidadeAtual.id)`), para alinhar com o resto do dashboard.
4. **Aumentar o limit** de 200 → 500 quando período > hoje.
5. **Linha de chamada** — adicionar metadados visíveis ao lado do tempo relativo:
  - **DID** formatado (ex.: `+55 (43) 3771-7463`) com ícone `PhoneIncoming`.
  - **Duração** (ex.: `42s` ou `1m 12s`) quando `duracao_segundos > 0`.
  - **Observações** truncadas em uma segunda linha discreta (`text-xs text-muted-foreground italic`) quando existirem — útil para identificar chamadas via 0800.
6. **Stat "Tempo Médio"** continua usando `duracao_segundos`, mas agora com base no período selecionado.
7. **Realtime**: o canal já escuta `chamadas_recebidas` (INSERT/UPDATE/DELETE) — apenas garantir que o `fetchChamadas` re-execute respeitando o novo período. Adicionar `periodo` ao array de dependências do `useEffect`.

## Detalhes técnicos

- Helper local `getInicioPeriodo(p: "hoje" | "7d" | "30d")` retornando ISO string.
- Helper `formatDid(d: string | null)` reaproveitando a lógica de `AdminChamadasRecebidas.tsx` (formato `+55 (DD) XXXX-XXXX`).
- Helper `formatDuracao(s: number | null)`.
- Sem mudanças de schema, sem migrações. Sem alteração em rotas, providers ou `App.tsx`.

## Fora de escopo

- Não duplicar a página admin de chamadas — a aba continua sendo a versão "operacional" simplificada.
- Sem mudanças no `twilio-voice-webhook`, `goto-webhook` ou na Bia.
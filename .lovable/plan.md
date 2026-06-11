## Diagnóstico

A mensagem de teste enviada agora **chegou** no banco (conversa "Janaina" 4399692765, mensagem "Ola" às 19:18 UTC), mas:

- A mensagem foi gravada com `empresa_id = NULL` e `unidade_id = NULL`.
- A política RLS de SELECT em `ai_mensagens` exige `empresa_id = empresa do usuário` (ou super_admin). Mensagens com `empresa_id NULL` ficam **invisíveis** para o usuário.
- Como Realtime do Supabase respeita RLS, o evento INSERT nunca é entregue ao listener → **não toca som, não mostra toast, não mostra notificação do navegador, e o conteúdo não aparece no inbox**.

Padrão se repete: nos últimos 7 dias, 11 de 23 mensagens entraram com `empresa_id NULL`. O trigger `fn_ai_mensagens_set_tenant` (BEFORE INSERT) deveria preencher esses campos a partir de `ai_conversas`, mas em vários casos ele não está aplicando (mesmo quando a conversa já tem `empresa_id` correto). O webhook (`bia-core.saveMessage`) também não envia `empresa_id`/`unidade_id` no payload — confia 100% no trigger.

## Correção

### 1. Webhook passa a gravar tenant explicitamente
- `supabase/functions/_shared/bia-core.ts`
  - `saveMessage(...)` recebe `empresaId` e `unidadeId` (opcionais) e adiciona ao `row` antes do `insert`.
  - Atualizar todos os callers de `saveMessage` (procurar usos no diretório `supabase/functions/`) para repassar a unidade/empresa que já é conhecida no contexto da chamada (via `unidade_id` passado pelo webhook ou via `ai_conversas.empresa_id`).
  - Quando só houver `unidadeId`, derivar `empresaId` de `unidades.empresa_id` ou da conversa.

### 2. Migração SQL
- **Backfill**: `UPDATE ai_mensagens m SET empresa_id = c.empresa_id, unidade_id = c.unidade_id FROM ai_conversas c WHERE c.id = m.conversa_id AND (m.empresa_id IS NULL OR m.unidade_id IS NULL);`
- **Hardening do trigger** `fn_ai_mensagens_set_tenant`: só sobrescrever quando o valor estiver NULL (`COALESCE(NEW.empresa_id, v_emp)`), e logar via `RAISE NOTICE` se a conversa não for encontrada para facilitar debug futuro.
- **RLS defense‑in‑depth**: substituir a política SELECT de `ai_mensagens` para também aceitar mensagens cuja `conversa_id` pertence a uma `ai_conversas` da mesma empresa do usuário (`EXISTS (SELECT 1 FROM ai_conversas c WHERE c.id = ai_mensagens.conversa_id AND c.empresa_id = get_user_empresa_id())`). Assim, mesmo que o trigger falhe no futuro, a mensagem continua visível e o Realtime entrega.

### 3. Verificação
- Após o deploy: reenviar a mensagem de teste; confirmar que aparece no inbox da Central Gas e dispara toast + som + notificação do navegador.
- Conferir no banco que `ai_mensagens.empresa_id` da nova mensagem está preenchido.

## Detalhes técnicos

- Empresa Central Gas: `f27e158e-7ab5-4617-9f66-c6b4a084d293`; unidade matriz: `aa5b7c93-4fe6-4dba-a0b5-2af43cd20614`.
- Mensagem de teste atual com bug: `ai_mensagens.id = 47a772a8-330a-4861-ab98-20356f4b566f`, `conversa_id = 6e8cbb45-…` (conversa tem `empresa_id` correto, mensagem está NULL).
- A política RLS de SELECT atual exige `empresa_id IS NOT NULL AND empresa_id = get_user_empresa_id()` — origem do bloqueio do Realtime.
- Nenhuma alteração em `App.tsx`, providers, rotas ou no `WhatsAppFloatingChat`. Mudanças confinadas a: 1 edge‑function compartilhada + 1 migração SQL.

## Fora de escopo
- Redesenho do inbox, sons, UI.
- Refatorar contexto de notificação (já está correto).

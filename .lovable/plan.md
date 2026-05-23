# Plano: Auditoria e correção de segurança Gas Facil Pro

Escopo grande — divido em 6 fases sequenciais. Cada fase é uma migration + código relacionado, validável antes da próxima. **Vou pedir aprovação de cada migration via tool de migração** conforme avançamos.

## Fase 1 — Diagnóstico (sem mudanças)

Antes de qualquer alteração, vou:

1. Rodar `supabase--linter` para pegar problemas óbvios de RLS já flagados.
2. Listar policies atuais de: `profiles`, `user_roles`, `empresas`, `unidades`, `clientes`, `pedidos`, `ai_conversas`, `ai_mensagens`, `integracoes_whatsapp`, `whatsapp_web_sessions`.
3. Verificar colunas de `ai_mensagens` (se já tem `empresa_id`/`unidade_id` ou só `conversa_id`).
4. Listar policies do bucket `chat-anexos`.
5. Buscar usos de `service_role` no frontend (`rg "service_role|SERVICE_ROLE" src/`).
6. Confirmar que `.env` só tem `VITE_*` + anon key.

Entrego um relatório curto no chat com os achados antes de seguir.

## Fase 2 — Realtime filtrado por empresa (alto impacto, baixo risco)

Problema atual em `whatsappRealtimeService.ts` + `useWhatsAppInboxRealtime`: `subscribeToAllConversations()` escuta **todas** as conversas globalmente — qualquer usuário logado recebe payloads de outras empresas via WebSocket (RLS no Realtime filtra somente quando há filtro server-side aplicado corretamente).

Mudanças:

- `ai_mensagens`: se não tiver `empresa_id`, adicionar a coluna + backfill via `conversa_id → ai_conversas.empresa_id` + trigger `BEFORE INSERT` para preencher.
- Mesma coisa para `unidade_id` se ausente.
- Forçar `NOT NULL` após backfill.
- `whatsappRealtimeService.subscribe*`: exigir `empresaId` como parâmetro obrigatório e aplicar `filter: empresa_id=eq.<id>` em todos os canais.
- `useWhatsAppInboxRealtime` passa a receber `empresaId` (do `useAuth`/`EmpresaContext`); sem isso não inscreve.
- RLS de Realtime: garantir policy `SELECT` em `ai_mensagens` e `ai_conversas` exigindo `empresa_id = get_user_empresa_id()` OR super_admin.

## Fase 3 — RLS hardening (migration grande)

Para cada tabela abaixo, garantir RLS ON + policies estritas usando funções `SECURITY DEFINER` já existentes (`has_role`, `get_user_empresa_id`, `unidade_belongs_to_user_empresa`):

| Tabela | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `profiles` | próprio user OR mesma empresa OR super_admin | só próprio user (campo `email`/`phone`); `empresa_id` imutável exceto super_admin |
| `user_roles` | mesma empresa | **bloqueado** para usuário comum; só super_admin/admin via `WITH CHECK has_role(auth.uid(),'admin')` |
| `empresas` | só a própria | só super_admin |
| `unidades` | empresa do user | admin/gestor da empresa |
| `clientes` | empresa do user | empresa do user, com `WITH CHECK empresa_id = get_user_empresa_id()` |
| `pedidos` | empresa do user (via unidade) | idem |
| `ai_conversas` | empresa do user | empresa do user |
| `ai_mensagens` | via empresa_id direta (após Fase 2) | idem |
| `integracoes_whatsapp` | admin/gestor da empresa | admin/gestor da empresa |
| `whatsapp_web_sessions` | admin/gestor da empresa | admin/gestor da empresa |

Triggers `BEFORE INSERT/UPDATE` preenchem `empresa_id` a partir de `auth.uid()` se vier nulo (defesa em profundidade — frontend não decide tenant).

## Fase 4 — Edge Functions

Padronizar com helper `requireAuth` já existente em `_shared/auth.ts` + nova função `assertUserOwnsConversa(supabase, userId, conversaId)`.

- `whatsapp-send`: hoje já usa `requireAuth`, mas aceita `unidade_id` do body. Substituir por: buscar `conversa.empresa_id`, comparar com `profile.empresa_id` do `auth.uid()`, exigir role `admin|gestor|operacional|atendente`. Ignorar `unidade_id` do payload.
- `whatsapp-refresh-profile`: aplicar `requireAuth` + validação `unidade ∈ empresa do user` + `conversa ∈ empresa do user`.
- Outras funções WhatsApp/Bia: passar `requireAuth` (exceto webhooks externos que validam via assinatura).

## Fase 5 — Storage `chat-anexos` + soft delete

- Bucket `chat-anexos` → `public = false`.
- Policies storage: path deve começar com `<empresa_id>/...`; SELECT/INSERT/DELETE exigem `(storage.foldername(name))[1] = get_user_empresa_id()::text`.
- Frontend (`WhatsAppInbox` upload): força prefixo `${empresaId}/conversas/${conversaId}/...`.
- URLs públicas → trocar por `createSignedUrl` (60s) sob demanda.
- Soft delete em `ai_conversas`: adicionar `archived_at`, `deleted_at`, `deleted_by`; nunca usar `.delete()` no frontend — usar `update`. Policies de SELECT filtram `deleted_at IS NULL` por padrão; admin pode ver lixeira.

## Fase 6 — Auditoria

Reutilizar `audit_log` + `fn_audit_trigger` já existentes. Anexar trigger nas tabelas: `ai_conversas`, `ai_mensagens` (apenas INSERT human/system + UPDATE de status archived/deleted), `clientes` (UPDATE/DELETE), `user_roles` (qualquer op), `integracoes_whatsapp` (qualquer op).

Para envios de mensagem, gravação extra em `whatsapp_eventos` (já existe) — confirmar que `whatsapp-send` está logando `text_sent`/`media_sent` (já está, ok).

## Detalhes técnicos relevantes

- Nenhuma mudança em `App.tsx`, providers ou rotas (memória Core).
- Selects com valor "nenhum" (memória Core).
- Migrations divididas para minimizar bloqueio; backfills em batch quando tabela for grande.
- `ai_mensagens.empresa_id` indexado (`(empresa_id, created_at desc)`).
- Confirmação prévia: vou rodar Fase 1 (diagnóstico) **antes** de pedir aprovação de qualquer migration, e listar exatamente as policies e gaps encontrados.

## Fora de escopo

- Refatorar UX do WhatsAppInbox além das chamadas críticas (envio/upload/exclusão/cliente).
- Rate limiting (assunto separado).
- 2FA admin (assunto separado).

## Aprovação

Confirma que devo seguir nessa ordem? Se sim, começo pela Fase 1 (somente leitura, sem mudanças) e volto com o relatório de gaps + as migrations específicas para você aprovar uma a uma.

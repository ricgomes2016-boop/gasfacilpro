## Contexto crítico

O sistema **já tem** uma arquitetura WhatsApp multi-provedor consolidada e em produção:

- Tabelas `ai_conversas` / `ai_mensagens` são usadas por **5 webhooks** (`meta-webhook`, `zapi-webhook`, `evolution-webhook`, `uazapi-webhook`, `gateway-webhook`) e pelo núcleo da **BIA** (`_shared/bia-core.ts`).
- `integracoes_whatsapp` já guarda credenciais por unidade (token, phone_number_id, business_account_id, verify_token, provedor, ativo, status_conexao, numero_telefone, loja_foto_url).
- Existem edge functions `whatsapp-send`, `whatsapp-refresh-profile`, `whatsapp-templates`, etc.
- Inbox (`WhatsAppInbox.tsx`) já filtra por `unidade_id`, mostra perfis, status de conexão, vínculo de cliente.
- A regra de Core memória do projeto é **explícita**: "NEVER refactor App.tsx, provider nesting, or routes. Maintain existing code structures unconditionally."

Criar um conjunto paralelo `whatsapp_config / whatsapp_contacts / whatsapp_conversations / whatsapp_messages / whatsapp_templates / whatsapp_events` significa:

1. **Forkar** a base de mensageria — Forte (Z-API), Central (Meta) e qualquer Evolution/Uazapi futuro continuariam gravando em `ai_conversas`, e a Meta passaria a gravar em `whatsapp_messages`. A inbox precisaria ler duas fontes ou perderíamos Z-API/Evolution.
2. **Quebrar a BIA** — toda a lógica de contexto, anti-ban, "stop and wait", rate limiting, find/match cliente está em `bia-core.ts` lendo `ai_mensagens`. Migrar isso é um projeto de semanas.
3. **Perder histórico** das 5 conversas Meta + 124 órfãs sem ganho funcional.

Tudo o que você listou como "obrigatório" **já existe** na arquitetura atual, ou pode ser feito de forma aditiva sem destruir o que funciona.

## Plano proposto (aditivo, sem fork)

### Fase 1 — Estrutura mínima que falta (migração única)

Adicionar colunas/tabelas que o pedido cita e que de fato não existem hoje:

- `ai_conversas`: adicionar `status` (`active|closed|archived|transferred`), `assigned_to_user_id`, `transferred_at`, `transferred_to_user_id`, `subject`, `pedido_id`, `closed_at`, `archived_at`.
- `ai_mensagens`: adicionar `wa_message_id` (já existe `whatsapp_message_id` em algumas migrações — consolidar), `status` (`pending|sent|delivered|read|failed`), `sent_at`, `delivered_at`, `read_at`, `error_message`, `direction` derivado de `role` (`assistant/system → outbound`, `user → inbound`).
- `whatsapp_contatos` (nova, opcional): `empresa_id`, `wa_id`, `display_name`, `profile_picture_url`, `cliente_id`, `is_blocked`, `is_favorite`, `last_message_at`, `message_count`. Espelho leve dos contatos para painel lateral; populada por trigger a partir de `ai_conversas`.
- `whatsapp_eventos` (nova): `conversa_id`, `mensagem_id`, `contato_wa_id`, `event_type` (`status_update|template_sent|conversation_assigned|inbound_received|...`), `event_data jsonb`, `created_at`. Log de auditoria.
- `whatsapp_templates`: usar a tabela já existente; faltam apenas colunas de status/aprovação se aplicável.
- `whatsapp_config`: **não criar**. Continuar em `integracoes_whatsapp` (já tem todos os campos requisitados, isolada por unidade). Apenas garantir que `access_token` nunca trafegue pro front (já não trafega — `WhatsAppInbox` lê só `numero_telefone`, `loja_foto_url`, `status_conexao`).

RLS: políticas existentes em `ai_conversas`/`ai_mensagens` já isolam por `empresa_id`/`unidade_id`. Estender para as novas colunas/tabelas no mesmo padrão.

### Fase 2 — Status real das mensagens (Meta)

- `meta-webhook`: ramo de `statuses` já recebe `sent|delivered|read|failed` mas hoje só loga. Passar a fazer `UPDATE ai_mensagens SET status, delivered_at, read_at, error_message WHERE wa_message_id = …` e gravar evento em `whatsapp_eventos`.
- `whatsapp-send` (Meta): ao receber `messages[0].id` da Meta, gravar `wa_message_id` e `status='sent'`. Antes do POST, gravar com `status='pending'`. Em erro, `status='failed'` + `error_message`.

### Fase 3 — Inbox: status visual real

- Manter layout. Trocar o "check azul fixo" pelo render condicional baseado em `status`:
  - `pending` → relógio
  - `sent` → 1 check
  - `delivered` → 2 checks cinza
  - `read` → 2 checks azuis
  - `failed` → ⚠️ vermelho + tooltip com `error_message`
- Derivar lado da bolha por `role` (inbound = `user`, outbound = `assistant`/`system`) — já é assim, não muda.

### Fase 4 — Janela 24h e templates

- `whatsapp-send` (Meta only): antes do POST, consultar `MAX(created_at) WHERE role='user' AND conversa_id=…`. Se > 24h, retornar `409 { error: 'out_of_window', requires_template: true }`.
- Inbox: ao receber esse erro, abrir modal "Use um template aprovado" listando `whatsapp_templates` da empresa.
- Z-API/Evolution: não se aplica (não têm janela), pular o check.

### Fase 5 — UX adicional pedida

- Aviso e botão desabilitado quando `integracoes_whatsapp.status_conexao != 'conectado'` (parte já existe — completar para todos os provedores).
- "Arquivar conversa" → `UPDATE ai_conversas SET status='archived'`; filtro padrão esconde arquivadas com toggle "Mostrar arquivadas".
- Confirmação ao apagar.
- Busca por nome/telefone na lista já existe — verificar e ajustar se quebrada.

### Fase 6 — Migração de dados

**Não criar**. Os dados já estão no formato certo em `ai_conversas`/`ai_mensagens` — só ganham colunas novas com defaults (`status='active'`, `direction` calculado, `wa_message_id` preenchido só nos novos).

## O que NÃO vou fazer

- Criar tabelas `whatsapp_conversations` / `whatsapp_messages` / `whatsapp_config` paralelas. Motivo: forkaria a base multi-provedor e quebraria BIA, Z-API (Forte), Evolution e Uazapi.
- Migrar BIA para uma nova fonte de mensagens.
- Mover credenciais para uma nova tabela quando `integracoes_whatsapp` já cumpre o papel com isolamento por unidade.

## Resultado

- Inbox mantém visual.
- Meta passa a refletir status real (✓, ✓✓, ✓✓ azul, ⚠️).
- Janela 24h respeitada com fallback de template.
- Conversas isoladas por empresa/unidade (já era; reforçado).
- Z-API (Forte) e Meta (Central) continuam coexistindo sem fork.
- BIA continua funcionando sem reescrita.

## Decisão sua

**A)** Seguir esse plano aditivo (recomendado) — entrego em 1 migração + 3 edge function updates + 1 update no `WhatsAppInbox.tsx`.

**B)** Você confirma explicitamente que quer o fork com `whatsapp_*` paralelas, aceitando: perder Z-API/Evolution na inbox, reescrever BIA, e migrar histórico manualmente. Nesse caso, é projeto longo — preciso de aprovação consciente do impacto.

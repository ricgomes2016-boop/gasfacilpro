

## Plano: Chat entre Entregadores (estilo WhatsApp) + manter Chat IA

### Contexto
Atualmente o `ChatBase.tsx` funciona apenas como assistente IA. A tabela `chat_mensagens` ja existe com campos `remetente_id`, `remetente_tipo`, `destinatario_tipo`, `destinatario_id`, `mensagem`, `lida` -- perfeita para mensagens humanas. O pedido e transformar o chat do entregador numa experiencia completa com duas abas: **IA** e **Conversas** (entregador-entregador).

### Alteracoes

**1. Reescrever `src/components/entregador/ChatBase.tsx`**
- Adicionar sistema de abas no Sheet: **"Assistente IA"** (funcionalidade atual) e **"Conversas"** (mensagens humanas)
- Aba Conversas:
  - Lista de entregadores da mesma unidade (query `entregadores` filtrada por `unidade_id`)
  - Ao selecionar um entregador, abre conversa 1:1
  - Mensagens persistidas na tabela `chat_mensagens` com `remetente_tipo = 'entregador'` e `destinatario_tipo = 'entregador'`
  - Realtime via canal Supabase (`postgres_changes` na tabela `chat_mensagens`)
  - Indicador de mensagens nao lidas (badge no botao flutuante)
  - Marcar como lida ao abrir conversa
  - Input com voz (`VoiceInputButton`) e texto
- Aba IA: manter funcionalidade atual (streaming SSE com edge function)

**2. Nenhuma alteracao no banco de dados**
- A tabela `chat_mensagens` ja suporta `remetente_tipo = 'entregador'` e `destinatario_tipo = 'entregador'` com `destinatario_id`
- RLS ja esta habilitada

**3. Nenhuma alteracao na edge function**
- `entregador-chat-ia` permanece inalterada

### Estrutura da UI (aba Conversas)

```text
+----------------------------+
| [Assistente IA] [Conversas]|
+----------------------------+
| Lista de entregadores      |
| > Joao (2 nao lidas)       |
| > Maria                    |
| > Pedro (1 nao lida)       |
+----------------------------+

Ao clicar num entregador:
+----------------------------+
| < Voltar    Joao           |
+----------------------------+
| [mensagens em bolhas]      |
| Estilo WhatsApp            |
| Baloes verdes (eu)         |
| Baloes cinza (outro)       |
+----------------------------+
| [input] [mic] [enviar]     |
+----------------------------+
```

### Escopo
- 1 arquivo modificado (`ChatBase.tsx`)
- 0 mudancas de banco
- 0 edge functions novas

### Detalhes Tecnicos
- Realtime: `supabase.channel('chat-entregador-{id}').on('postgres_changes', ...)` filtrando INSERT na `chat_mensagens`
- Query conversas: `chat_mensagens` onde `(remetente_id = meu_id AND destinatario_id = outro_id) OR (remetente_id = outro_id AND destinatario_id = meu_id)` ordenado por `created_at`
- Badge nao lidas: count de `chat_mensagens` onde `destinatario_id = meu_entregador_id AND lida = false AND remetente_tipo = 'entregador'`


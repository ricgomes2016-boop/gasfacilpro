## Objetivo
Sempre que a Bia confirmar um pedido via WhatsApp (qualquer unidade — Central Gás, Forte Gás, etc.), o sistema envia uma mensagem WhatsApp para um número de notificação configurável por unidade. Default: `+5543999692765`.

## Mudanças

### 1) Banco — campo configurável por unidade
Migration adicionando coluna em `unidades`:
- `whatsapp_notificacao_pedido text` (nullable) — número E.164 (ex: `5543999692765`) para receber alertas.
- Backfill: definir `5543999692765` nas unidades de Central Gás e Forte Gás.

### 2) UI — campo na configuração da unidade
No formulário de edição de Unidade (Configurações → Unidades), adicionar um input "WhatsApp para notificação de pedidos confirmados" com placeholder `5543999692765`, validação simples (somente dígitos, 12-13 chars). Persistir em `unidades.whatsapp_notificacao_pedido`.

### 3) Edge Function — disparo da notificação
Em `supabase/functions/_shared/bia-core.ts`, logo após o `insert` bem-sucedido em `pedidos` (linha ~1638) e o registro dos itens, chamar uma nova função `notifyOrderConfirmed(supabase, ped.id, unidadeId, config)`:

- Lê `unidades.whatsapp_notificacao_pedido` da unidade do pedido. Se vazio, usa fallback `5543999692765`.
- Monta texto:
  ```
  ✅ Novo pedido confirmado #<id>
  🏢 Unidade: <nome>
  👤 Cliente: <nome> (<telefone>)
  📦 <qtd>x <produto>
  💰 R$ <total> — <forma_pagamento>
  📍 <endereço>
  ```
- Envia via Z-API usando a mesma `config` (instance/token) já usada pela conversa (mesma helper `sendText` existente nas linhas 1858/1878/1911), apenas alterando o destinatário.
- Erros de envio são apenas logados (não quebram o fluxo do pedido).

### 4) Sem mudanças em outros fluxos
Não altera webhook, autenticação, layout do app, ou outras rotinas. Apenas adiciona o disparo extra após criação do pedido.

## Detalhes técnicos
- Reaproveita o `sendText` interno do `bia-core.ts` — não cria nova edge function.
- Número é normalizado para dígitos (`replace(/\D/g,'')`); aceita formatos `+55 43 99969-2765`, `5543999692765`, etc.
- Sem alteração em RLS (campo lido via service role na edge function; UI usa políticas existentes de `unidades`).

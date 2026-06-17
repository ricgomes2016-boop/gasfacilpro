## Problema
Hoje o listener `useNovoPedidoNotifier` dispara toast + push + som para **todo** INSERT em `pedidos` (exceto `canal_venda = telefone_ia`). Isso inclui pedidos lançados manualmente pelo atendente em Nova Venda, gerando notificação desnecessária.

## Comportamento desejado
- **NÃO notificar** quando o pedido é lançado pelo atendente (qualquer um dos 3 inserts de `NovaVenda.tsx`).
- **Continuar notificando** para todas as outras origens já tratadas pelo sistema:
  - Pedidos da Bia (whatsapp / site_ia / telefone_ia já é tratado pelo CallerIdPopup)
  - Mensagens do entregador (chat) — já trata via `useChatNotification`
  - Bina notificando entrega — já trata via `CallerIdPopup`
  - Mensagens novas do WhatsApp — já trata via `WhatsAppNotificationContext`

## Correção (mínima, apenas frontend)
Em `src/pages/vendas/NovaVenda.tsx`, após cada `insert` em `pedidos` que retorna o `pedido.id` (linhas ~682, ~927 e ~1081), chamar imediatamente:

```ts
markOrderNotified(pedido.id, pedido.telefone_entrega || pedido.cliente_telefone || null);
```

Isso adiciona o id ao cache em memória do `novoPedidoDedupe`. Quando o evento Realtime chegar logo em seguida, `useNovoPedidoNotifier` fará `wasOrderNotified(...) === true` e descartará silenciosamente — sem toast, sem push, sem som.

Bonus: também impede que o `WhatsAppNotificationContext` notifique a mensagem de WhatsApp que originou esse pedido (mesma janela de 60s já existente via `wasRecentOrderForPhone`).

## Fora do escopo
- Nada muda em `useNovoPedidoNotifier`, `WhatsAppNotificationContext`, `useChatNotification` ou no `CallerIdPopup`.
- Sem mudanças no schema, RLS ou edge functions.
- Sem alterações visuais.
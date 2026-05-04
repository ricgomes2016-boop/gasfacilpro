
## Problema identificado

O popup da Bia (ligação + pedido criado) não está aparecendo por **3 bugs encontrados na investigação**:

### Bug 1 — `identificar_cliente` não dispara o popup
Em `supabase/functions/elevenlabs-bia-tools/index.ts` (linhas 209 e 243), quando a Bia recebe a chamada e identifica o cliente, ela insere em `chamadas_recebidas` **sem `pedido_gerado_id`** (fica `null`).

Mas o `CallerIdPopup` (linhas 120 e 143 de `src/components/atendimento/CallerIdPopup.tsx`) só mostra o popup se `pedido_gerado_id IS NOT NULL`:
```ts
.not("pedido_gerado_id", "is", null)
...
if (!nova?.pedido_gerado_id) return;
```
Resultado: a chamada chega, mas o popup nunca aparece durante a ligação.

### Bug 2 — `criar_pedido` não atualiza a chamada com o pedido gerado
Quando a Bia cria o pedido (linha 485 de `elevenlabs-bia-tools/index.ts`), ela **não faz UPDATE em `chamadas_recebidas`** linkando o `pedido_gerado_id`. Por isso, mesmo após criar o pedido, o realtime não dispara o popup (a linha existente continua com `pedido_gerado_id = null`).

### Bug 3 — Pedidos da Bia são filtrados do alerta de pendentes
Em `src/hooks/usePedidosPendentesAlert.ts` linha 49:
```ts
.filter((p: any) => p.canal_venda !== "telefone_ia")
```
Pedidos com canal `telefone_ia` (criados pela Bia) são removidos do alerta de pedidos pendentes — então **nenhum dos dois popups** aparece.

### Bug 4 — Notificação desktop não dispara quando o sistema está em background
- O `useDesktopNotification` só dispara se `Notification.permission === "granted"` — pode não ter sido pedida.
- O service worker está desabilitado em iframe/preview (`src/main.tsx`), o que é correto, mas em produção precisa estar registrado para a notificação aparecer com o app fechado.

---

## Plano de correção

### 1. Edge Function `elevenlabs-bia-tools/index.ts`
- Após `criar_pedido` ter sucesso (após linha 541), fazer UPDATE em `chamadas_recebidas`:
  - Buscar a última chamada `tipo='voip'` da unidade nos últimos 10 minutos sem `pedido_gerado_id`
  - Atualizar com `pedido_gerado_id = pedido.id` e `cliente_id = finalClienteId`
  - Isso dispara o realtime e o `CallerIdPopup` aparece com os dados do pedido recém-criado.

### 2. `src/components/atendimento/CallerIdPopup.tsx`
- Mostrar o popup **também durante a ligação** (sem `pedido_gerado_id`), não só após criar pedido. Mudar o filtro para mostrar qualquer chamada `recebida` recente, mas com visual "Bia atendendo…" enquanto o pedido não veio. Quando o realtime trouxer o UPDATE com `pedido_gerado_id`, atualizar o card no mesmo lugar com os detalhes do pedido.
- Tocar o som de campainha já no início da chamada.
- Solicitar permissão de notificação desktop automaticamente na primeira montagem (se `permission === "default"`).

### 3. `src/hooks/usePedidosPendentesAlert.ts`
- Remover o filtro `p.canal_venda !== "telefone_ia"` (linha 49), para que pedidos criados pela Bia também entrem no alerta global de pedidos pendentes — assim, mesmo se o `CallerIdPopup` for fechado, o `PedidoPendenteModal` continua chamando atenção até o atendente aceitar.

### 4. `src/components/alerts/PedidoPendenteAlertProvider.tsx` + `useDesktopNotification`
- Disparar a notificação desktop **sempre** que chega novo pedido (não só quando `document.hidden`), com `requireInteraction: true` e som — para garantir visibilidade quando o usuário não está no sistema.
- Pedir `Notification.requestPermission()` automaticamente ao montar o provider, uma única vez.
- Garantir que o `tag` seja único por pedido (já está via `pedido-${p.id}`), permitindo múltiplas notificações empilhadas.

### 5. Service Worker (`src/sw.js` / `vite.config.ts`)
- Confirmar que o service worker está registrado em produção (já está em `main.tsx`) e que `showNotification` é chamada via `registration.showNotification` (já está em `useDesktopNotification.ts`) — isso permite a notificação aparecer mesmo com a aba fechada/minimizada.
- Adicionar handler `notificationclick` no SW para focar/abrir a aba `/vendas/pedidos` ao clicar.

---

## Resultado esperado

1. **Durante a ligação**: assim que a Bia atende, popup aparece no canto inferior direito com "Bia atendendo — {telefone/cliente}".
2. **Quando o pedido é criado**: o mesmo popup atualiza para mostrar produto, valor, endereço e botão "REPASSAR ENTREGADOR". Toca som.
3. **Se o usuário estiver em outra aba/app**: notificação desktop com som aparece, clicável, levando direto para `/vendas/pedidos`.
4. **Persistência**: mesmo que feche o popup, o `PedidoPendenteModal` continua alertando até o atendente aceitar.

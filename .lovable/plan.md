
## Objetivo

Quando a Bia (telefone ou WhatsApp) finalizar um pedido, garantir:

1. **Uma única notificação visível** (em vez de 2-3 popups simultâneos).
2. **Notificação nativa do sistema operacional** que aparece mesmo com o navegador minimizado / outra aba ativa.
3. **Funcionamento idêntico** independente do canal (telefone_ia ou whatsapp).

---

## Diagnóstico — por que aparecem 3 popups hoje

Mapeei todos os disparos quando um pedido entra. Existem 3 camadas independentes escutando `INSERT` em `pedidos` (ou tabelas relacionadas), cada uma criando seu próprio aviso:

| # | Origem | O que mostra | Disparado para |
|---|---|---|---|
| 1 | `usePedidos.ts` (realtime INSERT em `pedidos`) | Toast sonner "🛵 Novo Pedido!" + notificação desktop via `sendOrderNotification` | Todo pedido **exceto** `canal_venda='telefone_ia'` (já tem regra de skip) |
| 2 | `CallerIdPopup.tsx` (realtime em `chamadas_recebidas`) | Card grande inferior direito + notificação desktop via `useDesktopNotification` + som `notification.mp3` | Toda chamada da Bia telefone (com ou sem pedido gerado) |
| 3 | `PedidoPendenteAlertProvider.tsx` (poll de `pedidos` pendentes sem entregador) | Modal fullscreen `PedidoPendenteModal` + notificação desktop via `useNotifications` + alarme sonoro escalonado | Todo pedido pendente sem entregador, em qualquer rota fora de `/vendas/pedidos` |
| 4 | `WhatsAppNotificationContext.tsx` (realtime em `ai_mensagens`) | Toast sonner "💬 …" + beep | Toda mensagem WhatsApp recebida (inclusive a que originou o pedido) |

**Cenário Bia WhatsApp → pedido confirmado**: dispara (1) toast + desktop, (3) modal + desktop, (4) toast da mensagem. = **3 popups**.

**Cenário Bia telefone → pedido confirmado**: (1) está skippado, mas dispara (2) CallerIdPopup + desktop e (3) PedidoPendenteAlertProvider + desktop. = **2 popups + 2 notificações nativas** (a notificação nativa também duplica porque (2) e (3) usam `tag` diferentes — `pedido-bina` vs `pedido-${id}`).

**Necessidade real de cada um (após análise):**

- **CallerIdPopup** é único e útil → mostra "Bia atendendo agora" com dados ricos do cliente (histórico, distância, entregador). Deve permanecer **como UI principal para canal telefone**.
- **PedidoPendenteAlertProvider** existe para chamar atenção em pedidos **antigos sem entregador** (escalonamento sonoro 5min/10min). Não foi feito para o instante da criação — mas hoje dispara junto. Deve permanecer só para escalonamento, **não** para a criação imediata.
- **Toast em `usePedidos`** é redundante quando (2) ou (3) já está acionado. Útil apenas se o usuário está logado em outro setor (ex.: vendedor olhando dashboard) e quer ver o tostadinho discreto.
- **Toast do WhatsAppNotificationContext** é útil para mensagens de chat, **não** para confirmação de pedido (a mesma confirmação já vira INSERT em `pedidos`).

---

## Plano

### 1) Centralizar lógica em um único hook: `useNovoPedidoNotifier`

Criar `src/hooks/useNovoPedidoNotifier.ts` que escuta INSERT em `pedidos` (uma vez, no `App.tsx`) e decide **uma e só uma** das saídas:

```
INSERT pedidos
   │
   ├─ canal_venda = 'telefone_ia'  → entrega ao CallerIdPopup (já cuida)
   │                                  → NÃO emite toast nem desktop aqui
   │
   ├─ canal_venda = 'whatsapp'     → desktop notification + toast unificado
   │                                  → suprime toast do WhatsAppNotificationContext
   │                                    para a mensagem de origem (dedupe por telefone+30s)
   │
   └─ outros canais (PDV/app/etc)  → desktop notification + toast unificado
```

Saídas:
- **Notificação nativa via Service Worker** (`registration.showNotification`) com `tag: 'novo-pedido-{id}'` (única por pedido) e `requireInteraction: true` para não auto-desaparecer fora de foco.
- **Toast sonner** apenas se `document.visibilityState === 'visible'` (evita stack invisível).
- **Som único** (não dois beeps simultâneos).

### 2) Remover disparos duplicados

- `src/hooks/usePedidos.ts`: remover o bloco `toast()` + `sendOrderNotification()` dentro do realtime INSERT (linhas ~133-145). Apenas manter o `queryClient.invalidateQueries`. A notificação passa a vir do novo hook central.
- `src/components/alerts/PedidoPendenteAlertProvider.tsx`: manter o modal, mas **só notificar via desktop após X minutos sem aceite** (não na primeira aparição). Trocar a regra `if (!notificadosRef.current.has(p.id))` por `if (idadeMinutos >= 3 && !notificadosRef.current.has(p.id))`. Isso preserva a função de escalonamento sem competir com a notificação imediata.
- `src/contexts/WhatsAppNotificationContext.tsx`: ignorar mensagens cujo `metadata.source` indique fluxo de pedido confirmado (verificar `bia-core` — já existe tag `PEDIDO_CONFIRMADO` retirada antes de salvar; basta filtrar mensagens da própria Bia em conversas que tiveram `pedidos.canal_venda='whatsapp'` no último minuto). Implementação mais simples: no novo hook central, quando emitir notificação de pedido WhatsApp, gravar `lastOrderToastAt[phone] = now` em ref compartilhada via contexto e o WA context consulta antes de toastar.

### 3) Garantir que aparece com sistema fechado / aba inativa

- O `useDesktopNotification` já usa Service Worker, mas hoje só dispara **se o usuário concedeu permissão**. Adicionar **banner persistente** em `MainLayout` quando `Notification.permission === 'default'`, com botão "Ativar alertas de pedido" (reaproveitar `NotificationPermissionBanner` que já existe no app do cliente).
- Adicionar opções no `Service Worker` registration: `requireInteraction: true`, `silent: false`, `actions: [{ action: 'open', title: 'Ver pedido' }]` — Chrome/Edge mostra notificação persistente no canto da tela mesmo com janela minimizada.
- Garantir que o SW (`src/sw.js`) trate o evento `notificationclick` abrindo `/vendas/pedidos` e focando a janela existente (verificar se já existe; se não, adicionar handler).
- Em mobile/PWA: adicionar `vibrate: [300,100,300]` já presente — manter.

### 4) Página de configurações (`/config/notificacoes`)

Hoje a tela `Notificacoes.tsx` é apenas visual (estado local, não persiste). Conectar o switch **"Novo Pedido → Push"** a `localStorage` (`pref_notif_novo_pedido_push`) e fazer o `useNovoPedidoNotifier` respeitar a preferência. (Persistência em banco fica para depois — escopo desta entrega é o canal Push.)

### 5) Testes manuais (após implementação)

- [ ] Bia telefone confirma pedido → aparece **só** o CallerIdPopup + 1 notificação nativa. Nada mais.
- [ ] Bia WhatsApp confirma pedido → aparece **só** 1 toast (se aba ativa) **ou** 1 notificação nativa (se minimizado). PedidoPendenteModal **não** aparece imediatamente.
- [ ] Pedido criado pelo PDV → 1 toast + 1 notificação nativa.
- [ ] Pedido pendente >3min sem entregador → PedidoPendenteModal aparece com escalonamento sonoro (comportamento atual preservado).
- [ ] Navegador minimizado: notificação nativa aparece no SO, clique abre `/vendas/pedidos`.
- [ ] Switch "Push" desativado em Configurações → nenhuma notificação nativa é disparada.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useNovoPedidoNotifier.ts` | **Novo** — listener único + dedupe |
| `src/App.tsx` | Montar `useNovoPedidoNotifier()` no nível raiz |
| `src/hooks/usePedidos.ts` | Remover toast/desktop do INSERT handler |
| `src/components/alerts/PedidoPendenteAlertProvider.tsx` | Notificar só após 3min de idade |
| `src/contexts/WhatsAppNotificationContext.tsx` | Dedupe vs notificação de pedido |
| `src/sw.js` | Confirmar/incluir handler `notificationclick` |
| `src/components/layout/MainLayout.tsx` | Banner de permissão de notificação para ERP |
| `src/pages/config/Notificacoes.tsx` | Persistir switch "Novo Pedido → Push" em localStorage |

Nenhuma alteração em banco, RLS, edge function ou `App.tsx` estrutural (apenas adicionar 1 linha de hook, sem mexer em provider/rotas).

---

## Detalhes técnicos

- **Dedupe entre canais**: ref em módulo `notifiedOrderIds = new Set<string>()`. TTL implícito (o set vive na sessão; ok porque cada pedido tem id único).
- **Som único**: `useNovoPedidoNotifier` toca `notification.mp3` uma vez; CallerIdPopup já toca seu próprio som para chamadas — manter, pois é evento diferente (chamada ≠ pedido). O hook central detecta `canal_venda='telefone_ia'` e **não** toca som (CallerIdPopup já tocou).
- **Permissão**: usar `Notification.requestPermission()` no clique do banner (gesture do usuário) — necessário em Safari/Chrome modernos.
- **Service Worker**: o atual em `src/sw.js` precisa expor handler:
  ```js
  self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    e.waitUntil(clients.matchAll({type:'window'}).then(list => {
      const url = e.notification.data?.url || '/vendas/pedidos';
      const existing = list.find(c => c.url.includes(url));
      return existing ? existing.focus() : clients.openWindow(url);
    }));
  });
  ```


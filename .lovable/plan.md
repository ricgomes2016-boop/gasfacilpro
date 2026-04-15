

## Plano: Notificacoes de Chat com som e alerta nativo (ERP + App Entregador)

### Problemas identificados

1. **ERP (BaseChatPanel)**: A notificacao via `useChatNotification` so dispara quando o painel esta fechado, mas nao solicita permissao de forma proativa. O som pode falhar se o navegador bloquear autoplay. Nao notifica quando o usuario esta em outras telas com o chat fechado.

2. **App Entregador (ChatBase)**: Nao tem NENHUM som nem notificacao nativa quando a base envia mensagem. Apenas atualiza o contador de nao-lidas silenciosamente.

### Solucao

**1. ERP - Melhorar notificacao no BaseChatPanel**
- Solicitar permissao de notificacao ao montar o componente (proativo)
- Garantir que o som toca mesmo com o painel aberto em outra thread
- Usar `requireInteraction: true` para a notificacao persistir no Windows
- Adicionar fallback: tocar som via interacao do usuario para desbloquear autoplay

**2. App Entregador - Adicionar som + notificacao nativa no ChatBase**
- Importar e usar `useChatNotification` no `ChatBase.tsx`
- No handler de realtime, quando `isForMe && !selectedPeer` (mensagem recebida e nao esta na conversa), disparar `notify(remetente_nome, mensagem)`
- Tambem disparar quando esta na conversa mas em outra thread
- Solicitar permissao de notificacao ao abrir o app do entregador

**3. Melhorar useChatNotification**
- Adicionar solicitacao de permissao mais agressiva (retry)
- Usar Service Worker notification quando disponivel (funciona mesmo minimizado)
- Garantir que o som pre-carregado funciona cross-browser

### Mudancas tecnicas

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useChatNotification.ts` | Melhorar: SW notification, retry de permissao, som mais robusto |
| `src/components/chat/BaseChatPanel.tsx` | Solicitar permissao proativamente, notificar em qualquer thread |
| `src/components/entregador/ChatBase.tsx` | Importar `useChatNotification`, disparar notify no realtime para mensagens recebidas |

### Logica de notificacao

**ERP**: Quando chega mensagem de entregador:
- Se chat fechado: som + notificacao nativa
- Se chat aberto mas em outra thread: som + notificacao nativa
- Se chat aberto na mesma thread: sem som (usuario ja esta vendo)

**Entregador**: Quando chega mensagem da base ou outro entregador:
- Se nao esta na conversa do remetente: som + notificacao nativa
- Se esta na conversa: sem som


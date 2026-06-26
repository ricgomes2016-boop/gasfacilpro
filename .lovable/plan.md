## 1. App entregador notificar com tela desligada / fora do app

Hoje o app usa Web Push (VAPID) via `usePushSubscription` + edge function `send-push-novo-pedido`. No APK Android dentro de WebView (Capacitor com `server.url`), Web Push **não dispara com a tela desligada nem com o app fechado** — por isso o entregador só recebe quando está com a tela do sistema aberta.

Solução: adicionar push nativo via Capacitor + FCM, mantendo o Web Push como fallback para quem usa pelo navegador.

Passos:
- Instalar `@capacitor/push-notifications` e `@capacitor/local-notifications`.
- Criar hook `useNativePush` que, dentro do Capacitor, pede permissão, registra o token FCM e salva em `push_subscriptions` (novo campo `provider = 'fcm'` + `fcm_token`).
- Migração: adicionar colunas `provider text default 'web'` e `fcm_token text` em `push_subscriptions`, índice por `user_id + provider`.
- Atualizar edge function `send-push-novo-pedido` (e `send-push-novo-chat`) para, além do Web Push, disparar via FCM HTTP v1 quando houver `fcm_token` (usa secret `FCM_SERVER_KEY` que vou pedir ao publicar).
- No app: registrar listener `pushNotificationReceived` para exibir `LocalNotifications` quando o app está em foreground, e `pushNotificationActionPerformed` para abrir a tela do pedido ao tocar.
- `AndroidManifest`: nada a editar manualmente — o plugin injeta. Documentar para o usuário rodar `npx cap sync android` e gerar nova APK.

Observação: para a notificação acordar o aparelho com tela desligada, a mensagem FCM precisa ser do tipo **notification** (não data-only) com `priority: high`. A edge function fará isso.

## 2. Mapa Operacional sem mostrar entregadores

A query traz os entregadores corretamente, mas o `useMemo` filtra duas vezes:
1. `e.latitude && e.longitude` — esconde quem nunca enviou GPS.
2. `presencaMap[e.id].presenca !== "offline"` — `useEntregadorPresenca` marca como "offline" quem não tem rota em andamento, mesmo que o `entregadores.updated_at` seja recente. Resultado: ninguém aparece.

Correção em `src/pages/operacional/MapaOperacional.tsx` e `src/hooks/useEntregadorPresenca.ts`:
- Considerar `entregadores.updated_at` (último heartbeat enviado pelo app) como fallback quando não há `rota_historico`. Se atualizado há ≤ 5 min → `online`; ≤ 30 min → `instavel`; senão → `offline`.
- Respeitar o toggle "Mostrar offline" também na lista de markers; quando ligado, mostrar entregadores com GPS mesmo offline.
- Quando o entregador não tiver GPS mas tiver pedidos atribuídos, renderizar no pino da unidade com badge "sem GPS" (apenas na lista lateral, não no mapa).

## 3. Renato Roffe aparecendo na Forte Gás

Existem dois registros de "Renato Roffe" ativos:
- `bc24178c-…` em Forte Gás (antigo)
- `da20ac76-…` em Central Gas (atual, após transferência)

A transferência criou o novo sem desativar o antigo. Vou:
- Desativar (`ativo = false`) o registro `bc24178c-…` na Forte Gás (mantém histórico, some dos seletores).
- Migrar referências pendentes (pedidos/rotas em aberto) do id antigo para o novo, se houver — verifico antes de aplicar.

## Resumo técnico (para devs)

| Área | Arquivos |
| --- | --- |
| Push nativo | `package.json`, `src/hooks/useNativePush.ts` (novo), `src/pages/entregador/EntregadorLayout.tsx`, `supabase/functions/send-push-novo-pedido/index.ts`, `send-push-novo-chat/index.ts`, migração `push_subscriptions` |
| Mapa | `src/hooks/useEntregadorPresenca.ts`, `src/pages/operacional/MapaOperacional.tsx` |
| Renato | `UPDATE entregadores SET ativo=false WHERE id='bc24178c-9330-4a76-a7b9-199e50df621e'` (+ remap de pedidos abertos se existirem) |

Após aprovar, vou pedir o `FCM_SERVER_KEY` (chave do Firebase Cloud Messaging do projeto) e instruir o `npx cap sync android` + nova build da APK no fim.

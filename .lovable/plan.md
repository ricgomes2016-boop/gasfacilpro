## Objetivo
Fazer a notificação do app do entregador tocar som quando o celular estiver com a tela desligada, em segundo plano ou com outro aplicativo aberto.

## Diagnóstico
O comportamento descrito indica que o push está chegando, mas o som está sendo tratado pelo WebView/JavaScript quando o app abre. Para tocar em segundo plano no Android, o som precisa estar configurado no nível nativo: Manifest, canal Android criado antes do primeiro push e payload FCM compatível com esse canal.

## Plano de correção
1. **Permissões Android corretas**
   - Adicionar `android.permission.POST_NOTIFICATIONS` no `AndroidManifest.xml` para Android 13+.
   - Manter `WAKE_LOCK` e permissões existentes.

2. **Canal nativo criado no início do APK**
   - Atualizar `MainActivity.java` para criar o canal `gasfacil_alerts_v2` no startup nativo, antes do WebView.
   - Usar `IMPORTANCE_HIGH`, vibração, tela pública e som vinculado ao arquivo `res/raw/gasfacil_alert.wav`.
   - Isso evita depender apenas do `PushNotifications.createChannel()` do JavaScript, que pode rodar tarde demais.

3. **Manifest alinhado ao canal**
   - Garantir que o `default_notification_channel_id` do Firebase aponta para `gasfacil_alerts_v2`.
   - Garantir compatibilidade caso o FCM receba mensagem sem `channel_id`.

4. **Payload FCM mais robusto**
   - Ajustar `supabase/functions/_shared/fcm.ts` para enviar:
     - `priority: HIGH`
     - `channel_id: gasfacil_alerts_v2`
     - `sound: gasfacil_alert`
     - `visibility: PUBLIC`
     - `notification_priority: PRIORITY_MAX`
     - TTL adequado para não perder pedido quando o celular estiver em repouso.

5. **Evitar som duplicado ao abrir o app**
   - Ajustar `useNativePush.ts` para não reemitir notificação local com som quando a notificação já veio do sistema em background.
   - Manter fallback local apenas para foreground, se necessário.

6. **Orientação final de build/teste**
   - Depois da correção, você precisará gerar/instalar um APK novo.
   - No celular, será necessário aceitar a permissão de notificações e verificar se o canal “Notificações Importantes” está com som ativado nas configurações do Android.

## Resultado esperado
Ao chegar novo pedido, o Android deve exibir a notificação com som mesmo com a tela bloqueada, com o app minimizado ou usando outro aplicativo.
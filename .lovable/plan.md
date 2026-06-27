## Diagnóstico

- **PWA no navegador:** a entrega chega, mas o som com tela bloqueada/outro app é uma limitação comum do navegador/Android Web Push. O sistema pode exibir a notificação, mas não garante áudio customizado disparado por JavaScript em segundo plano.
- **APK:** há tokens FCM cadastrados no banco, mas os pedidos recentes não aparecem nos logs da função de push. O gatilho do banco está chamando `extensions.http_post`, porém a extensão disponível está no schema `net`, então o disparo backend provavelmente não está chegando na função `send-push-novo-pedido`.

## Plano de correção

1. **Corrigir o disparo backend de novos pedidos**
   - Ajustar a função SQL `fn_dispatch_push_novo_pedido()` para chamar a Edge Function usando `net.http_post` corretamente.
   - Manter o padrão de nunca bloquear a criação do pedido caso a notificação falhe.
   - Opcionalmente repetir o mesmo ajuste para chat, se a mesma função estiver usando o schema incorreto.

2. **Fortalecer envio para APK via FCM**
   - Revisar `send-push-novo-pedido` para registrar logs claros: pedido recebido, empresa encontrada, total de inscrições, total FCM, total web, enviados e removidos.
   - Manter resposta `200 OK` com flags de diagnóstico, sem expor tokens.
   - Garantir que o filtro por empresa não deixe o entregador fora do envio.

3. **Ajustar PWA para comportamento correto**
   - Corrigir a expectativa técnica: em PWA, o som customizado com tela bloqueada não é confiável por limitação do navegador.
   - Melhorar a notificação web para usar `renotify`, vibração, prioridade visual e ação persistente; o som nativo dependerá das configurações do Android/Chrome.
   - Evitar prometer áudio customizado no PWA; para som garantido, o caminho correto é APK nativo.

4. **Melhorar cadastro/comunicação do APK**
   - Adicionar diagnóstico seguro no `useNativePush`: quando registrar token FCM, salvar `empresa_id`, `unidade_id`, `user_agent` e timestamp corretamente.
   - Ajustar fallback de `unidade_id` para buscar pela tabela de entregadores quando o app não tiver `selected_unidade_id` no localStorage.
   - Evitar depender de service worker no APK para recebimento de pedido.

5. **Validar após implementação**
   - Consultar banco para confirmar chamadas e inscrições.
   - Testar a Edge Function com um pedido real/recente.
   - Orientar geração de APK novo com `git pull`, `npm install`, `npx cap sync android` e build pelo Android Studio.

## Observação importante

Mesmo corrigindo o backend e o APK, no **PWA** o áudio com tela bloqueada pode continuar limitado pelo navegador. A solução profissional para som confiável em segundo plano é o **APK com FCM nativo**, e esse plano foca em fazer o APK voltar a se comunicar com o sistema e receber as entregas.
Plano de correção

1. Assinatura do recebedor no app do entregador
- Remover a exigência de assinatura para pagamentos comuns.
- Exibir e exigir o componente de assinatura somente quando existir pagamento com forma "Fiado" / pedido a prazo.
- Se o pedido já vier com forma de pagamento "Fiado", manter a assinatura como obrigatória.
- Ajustar o texto do botão de finalizar para não bloquear entregas à vista.

2. Ajuste fino visual da tela de finalizar entrega
- Reduzir aparência de cards pesados dentro de cards na tela de finalização.
- Melhorar bordas, espaçamento e contraste dos blocos de produtos/pagamentos.
- Manter o rodapé livre para o botão finalizar não ficar coberto no mobile/PWA/APK.

3. Garantia de notificação PWA para entregadores
- Corrigir o registro Web Push para entregador salvar `empresa_id` e `unidade_id` de forma confiável usando: perfil, entregador ativo e unidade selecionada.
- Revalidar a inscrição push quando o usuário permite notificações, volta ao app ou abre o app do entregador.
- Melhorar o botão/banner de notificação para registrar a inscrição imediatamente após a permissão ser concedida.

4. Disparo correto para o entregador atribuído
- Adicionar uma Edge Function específica para notificar nova entrega ao entregador quando um pedido recebe `entregador_id` ou entra em rota.
- Enviar Web Push para PWA e FCM para APK usando os tokens do usuário do entregador, não apenas tokens gerais da empresa.
- Criar trigger SQL em `pedidos` para disparar essa função em `INSERT/UPDATE` quando houver entregador atribuído.
- Manter retorno tolerante a falhas para nunca impedir a venda/pedido caso a notificação falhe.

5. Limites técnicos importantes
- No PWA, a entrega da notificação com tela bloqueada depende de permissão concedida, HTTPS, Service Worker ativo e inscrição salva no banco.
- Som com tela bloqueada no navegador depende das regras do Android/Chrome; o sistema pode vibrar e mostrar a notificação, mas o navegador pode limitar som personalizado. Para som garantido em background, o APK com FCM/canal Android é o caminho mais confiável.

Arquivos principais a alterar
- `src/pages/entregador/FinalizarEntrega.tsx`
- `src/hooks/usePushSubscription.ts`
- `src/hooks/useNotifications.ts`
- `src/components/entregador/NotificationToggle.tsx`
- `supabase/functions/send-push-nova-entrega/index.ts`
- nova migration SQL para trigger de notificação ao entregador
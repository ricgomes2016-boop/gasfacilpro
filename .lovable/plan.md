## Ajustes na chamada de voz Vonage + Popup de pedidos

### 1. Mensagem intermediária do Vonage

Em `supabase/functions/vonage-voice-webhook/index.ts` (linha ~112-114), trocar o texto do `talk` que toca antes de transferir para a Bia:

- **De:** `"Conectando você à Bia, um momento."`
- **Para:** `"Conectando você a Central Gás, um momento."`

Redeploy da função `vonage-voice-webhook`.

### 2. Popup de pedido aparecendo a cada chamada

**Diagnóstico:** O webhook do Vonage **não cria** pedidos. Quem cria é a Bia via tool `criar_pedido` (`elevenlabs-bia-tools/index.ts` linha 237) com `canal_venda: "telefone_ia"`. Então o popup aparece porque, quando a Bia conclui um pedido durante a ligação, ele entra como `status='pendente'` sem entregador, e o `PedidoPendenteAlertProvider` (via realtime + polling 10s) abre o modal — comportamento atual do sistema para qualquer pedido pendente.

**Correção:** Suprimir o modal automático para pedidos vindos do canal de voz (`canal_venda = 'telefone_ia'`). Eles continuam aparecendo normalmente em `/vendas/pedidos` e na lista do entregador, só não interrompem o ERP com popup.

Em `src/hooks/usePedidosPendentesAlert.ts`, ao mapear `pendentes`, filtrar fora os pedidos com `canal_venda === 'telefone_ia'`:

```ts
const mapped: PedidoPendente[] = (data || [])
  .filter((p: any) => p.canal_venda !== 'telefone_ia')
  .filter((p: any) => !cleanedSnooze[p.id] || cleanedSnooze[p.id] < now)
  .map(...)
```

Isso evita que ligações telefônicas disparem o popup, mantendo o popup funcionando para pedidos via WhatsApp/web/balcão.

### Validação

Ligar para **+55 11 5283-5921** e confirmar:
1. Mensagem intermediária diz "Conectando você a Central Gás, um momento."
2. Ao concluir um pedido pela voz com a Bia, **não** aparece popup no ERP — só a notificação normal na tela de Pedidos.
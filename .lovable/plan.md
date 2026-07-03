## Objetivo
Na etapa **Entregador** da Nova Venda, adicionar uma checkbox **"Pedido já entregue"**. Quando marcada:
- O pedido é gravado com `status = 'entregue'` (não vai para "pendente/em rota").
- Não dispara notificação push para o app do entregador.
- O roteamento financeiro (caixa / contas a receber / cheques) ocorre imediatamente, como se não houvesse entregador em rota (já que a entrega e o pagamento já aconteceram).

## Onde mexer

**`src/pages/vendas/NovaVenda.tsx`** (único arquivo)

1. Novo state:
   ```ts
   const [jaEntregue, setJaEntregue] = useState(false);
   ```
2. Na etapa `entregador` (linha ~1608) e no fluxo desktop antigo (perto do `DeliveryPersonSelect` / `QuickSelectorsRow`), renderizar uma `Checkbox` do shadcn com o label "Pedido já entregue (não notificar entregador)". Só faz sentido quando há entregador selecionado — desabilitar/ocultar enquanto `entregador.id` for null.
3. No `handleFinalizar` (linha ~1057), no `pedidoInsert`:
   - `status: jaEntregue ? "entregue" : "pendente"`
   - Quando `jaEntregue`, também setar `data_entrega` para agora (registro correto da entrega feita).
4. No bloco de roteamento financeiro (linha ~1174, `if (!entregador.id)`), mudar a condição para `if (!entregador.id || jaEntregue)` e, quando `jaEntregue`, passar `entregadorId: entregador.id` (para atribuir corretamente a origem do dinheiro no caixa/acerto). Assim o dinheiro entra imediatamente no financeiro, sem esperar acerto.
5. Não é necessário mexer no trigger do banco (`fn_dispatch_push_nova_entrega`) — ele já ignora inserts com `status = 'entregue'`, então o push simplesmente não dispara.
6. Resetar `jaEntregue = false` no reset pós-finalização e ao trocar entregador para vazio.

## Fora de escopo
- Não altero migrations, edge functions ou o app do entregador.
- Não mexo em `EditarPedido`, apenas na Nova Venda.

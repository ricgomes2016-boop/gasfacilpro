## Problema

Ao pedir pela Bia no site institucional (ForteGás, CentralGásCP, JapaGás) acontecem dois problemas:

1. **Pedido sobe antes de o cliente concluir** — a Bia chama `criar_pedido` antes de fechar a confirmação final com o cliente.
2. **Popup do pedido aparece no próprio site** — o `GlobalNotifiers` (que monta `useNovoPedidoNotifier`) está ativo em todas as rotas, inclusive nas rotas públicas (`/fortegas`, `/centralgascp`, `/japagas`, `/cliente/*`, etc). Quando um operador está com o ERP logado na mesma sessão (ou só visitando o site público), o toast/alerta do novo pedido aparece sobre a landing.

## Correções

### 1) `supabase/functions/bia-site-chat/index.ts` — exigir confirmação explícita

- Reforçar o `systemPrompt` deixando claro que `criar_pedido` só pode ser chamado **depois** de o cliente responder afirmativamente a uma pergunta de confirmação final ("Posso confirmar o pedido?").
- Adicionar ao schema da tool `criar_pedido` o parâmetro obrigatório `confirmado_pelo_cliente: boolean` (descrição: "Marque true APENAS se o cliente respondeu sim na confirmação final").
- Em `criarPedido(...)`, se `confirmado_pelo_cliente !== true`, retornar `{ error: "Peça a confirmação final ao cliente antes de criar o pedido." }` sem inserir nada no banco.
- Redeploy da edge function.

### 2) `src/App.tsx` — não montar `GlobalNotifiers` em rotas públicas/cliente

- Transformar `<GlobalNotifiers />` em um componente que lê `useLocation()` e retorna `null` quando o `pathname` começa com prefixos públicos:
  - `/fortegas`, `/centralgascp`, `/japagas`, `/comprar-vale-gas`, `/cliente`, `/instalar`, `/auth`, `/qrcode`, `/reset-password`.
- Apenas dentro do ERP autenticado os hooks `useNovoPedidoNotifier`, `useNativePush`, `usePushSubscription` continuam ativos.
- O `PedidoPendenteAlertProvider` já está dentro do `MainLayout` (apenas ERP), não precisa mexer.

## Validação

- Abrir `/fortegas` deslogado e fazer um pedido pela Bia: confirmar que o pedido **só** é criado depois do "sim" final, e que nenhum popup aparece na tela do site.
- Abrir o ERP autenticado em outra aba: o popup de novo pedido deve aparecer normalmente no ERP.

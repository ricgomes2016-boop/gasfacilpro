## Objetivo
Adicionar atalhos de teclado na tela Nova Venda:

- **F2** → abre uma nova janela de Novo Pedido (mesma ação do botão "+ Nova Venda" atual: `openNovaVendaWindow({})`).
- **F3** → finaliza o pedido (`handleFinalizar`).
- **F4** → agenda o pedido (`handleAgendar`).
- **F5** → abre o cadastro de cliente em nova janela (`/clientes/cadastro`).
- **Enter** → pula para a próxima aba do stepper (Cliente → Produtos → Pagamento → Entregador → Confirmar), preservando o comportamento atual do Enter dentro de campos `[data-venda-enter-next]` (que continua navegando entre inputs).

## Mudanças

### `src/pages/vendas/NovaVenda.tsx`
1. Adicionar `useEffect` global com listener `window.addEventListener("keydown", ...)`:
   - Ignorar quando o foco está em `<input>`, `<textarea>` ou `[contenteditable]` editáveis para **F2–F5** apenas se o usuário estiver digitando texto puro (mas teclas F* normalmente não causam digitação — então capturamos sempre, com `preventDefault`).
   - `F2`: `event.preventDefault()`; `openNovaVendaWindow({})`.
   - `F3`: `event.preventDefault()`; se não estiver carregando, chama `handleFinalizar()`.
   - `F4`: `event.preventDefault()`; chama `handleAgendar()`.
   - `F5`: `event.preventDefault()`; `window.open("/clientes/cadastro", "_blank", "noopener,noreferrer,width=1200,height=800")`.
   - Cleanup no unmount.

2. **Enter pula de aba**: estender `handleStepEnterNavigation` (ou adicionar handler complementar no contêiner externo):
   - Quando Enter for pressionado e **não houver próximo input** `[data-venda-enter-next]` no painel atual (`focusables[index + 1]` undefined), avançar para o próximo step via `setActiveStep(proximoStep)` respeitando `canOpenStep`.
   - Quando o Enter for pressionado **fora** de um input (ou em um painel sem inputs com `data-venda-enter-next` — ex: Entregador, Confirmar), também avançar para o próximo step.
   - Sequência: `cliente → produtos → pagamento → entregador → confirmar`. No `confirmar`, Enter não faz nada (usuário usa F3).

3. Adicionar uma **dica visual discreta** ao lado dos botões (no header da página ou no `OrderSummary` actions) com os atalhos: `F2 Novo · F3 Finalizar · F4 Agendar · F5 Cliente · Enter Próximo`.

## Fora do escopo
- Sem mudanças em `OrderSummary`, `PaymentSection`, `CustomerSearch` etc. (apenas leitura/uso de funções já existentes).
- Sem mudanças de rota ou backend.
- F5 padrão do navegador (reload) é sobrescrito apenas enquanto a tela Nova Venda está montada.
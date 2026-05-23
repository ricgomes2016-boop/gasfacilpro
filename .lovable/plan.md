## Objetivo

Adicionar navegação por teclado ao stepper da **Nova Venda** (Cliente → Produtos → Pagamento → Entregador → Confirmar) com foco visível e acessibilidade.

## Comportamento de teclado

- **Seta direita (→)**: avança para a próxima etapa.
- **Seta esquerda (←)**: volta para a etapa anterior.
- **Enter / Espaço**: ativa a etapa atualmente focada.
- Sem wrap-around: na primeira etapa, ← não faz nada; na última, → não faz nada.
- Sem Home/End ou auto-activation — apenas o que foi pedido.

## Mudanças em `src/pages/vendas/NovaVenda.tsx` (componente `VendaStepper`)

1. **Tablist acessível**
   - Wrapper recebe `role="tablist"` e `aria-label="Etapas da venda"`.
   - Cada botão: `role="tab"`, `aria-selected`, `aria-current="step"` na ativa, `tabIndex={activeStep === step.id ? 0 : -1}` (roving tabindex).

2. **Refs + handler `onKeyDown`**
   - `useRef<(HTMLButtonElement | null)[]>([])` para focar irmãos.
   - `ArrowRight` / `ArrowLeft`: move foco para a próxima/anterior etapa habilitada e chama `onStepClick` dessa etapa.
   - `Enter` / `Space`: chama `onStepClick(step.id)` (com `preventDefault` no Space).

3. **Foco visível**
   - Classes Tailwind no botão: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2` (tokens do design system).

4. **Preservar**
   - `title`, `aria-label`, comportamento de clique, layout e estilos atuais permanecem.

## Fora de escopo

- Não alterar validações, auto-advance (já removido), view antiga, ou outros steppers do projeto.
- Sem mudanças em CSS global.

## Arquivo

- `src/pages/vendas/NovaVenda.tsx` — apenas o componente `VendaStepper`.

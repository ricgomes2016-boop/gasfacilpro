## Problema

Na tela **Nova Venda**, o stepper (Cliente → Produtos → Pagamento → Entregador → Confirmar) avança automaticamente quando os campos da etapa atual ficam preenchidos. Isso atrapalha quando você está corrigindo um cadastro de cliente: qualquer interação dispara o pulo para "Produtos".

Há dois pontos que causam isso em `src/pages/vendas/NovaVenda.tsx`:

1. **`useEffect` (linhas ~672-695)** que detecta quando uma etapa fica "preenchida" e chama `setActiveStep(nextStep)`.
2. **`handleSelecionarEntregador` (linha 713)** que força `setActiveStep("confirmar")` ao escolher o entregador.

## Solução proposta

Tornar a navegação do stepper **100% manual via clique nas abas** (Cliente, Produtos, Pagamento, Entregador, Confirmar). O card do stepper já existe e fica fixo no topo — vamos só remover os avanços automáticos e reforçar o visual de "clique para avançar".

### Mudanças

1. **Remover o auto-advance** do `useEffect` — manter apenas a atualização de `previousStepState.current` (para preservar o indicador "done" ✓ nas abas), sem nunca chamar `setActiveStep`.
2. **Remover o `setActiveStep("confirmar")`** de `handleSelecionarEntregador`. Continua mostrando o toast "Entregador selecionado".
3. **Reforço visual no stepper** (`VendaStepper`, linhas ~115-167):
   - Adicionar `title`/`aria-label` "Clique para avançar" nos botões das abas.
   - Garantir cursor `pointer` e hover mais visível na aba não-ativa quando `onStepClick` está disponível (já existe um hover básico, vamos deixar mais claro).
4. **(Opcional, recomendado) Toast discreto na primeira vez** que o usuário preenche uma etapa, dizendo "Clique em Produtos para continuar" — só na primeira venda da sessão, usando `sessionStorage`. Posso pular se preferir mantermos só o stepper clicável.

### Fora de escopo

- Não mexer em validação, em regras de quais etapas podem ser abertas (`canOpenStep` já libera todas) nem em layout/posição do card.
- Não mexer no fluxo da view antiga (`useNewView = false`).

### Arquivos

- `src/pages/vendas/NovaVenda.tsx` (única alteração).

## Pergunta antes de implementar

Quer que eu inclua o **toast de dica** ("Clique em Produtos para continuar") na primeira venda da sessão, ou prefere **apenas remover o auto-advance** sem nenhuma dica extra?
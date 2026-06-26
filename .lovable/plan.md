## Objetivo
Ajustar o rodapé fixo do **Nova Venda** no mobile para:
1. Botões Voltar/Avançar inline (antes/depois do stepper, nunca acima/abaixo).
2. Aparência idêntica entre os dois botões (mesmo estilo neutro, sem o verde do "default").
3. Stepper compacto que cabe em uma linha sem quebrar.
4. Conteúdo da página não fica escondido atrás do rodapé fixo durante a rolagem.

## Mudanças

### 1. `src/pages/vendas/NovaVenda.tsx` — `StepperFooterBar`
- Trocar `variant="default"` do botão Avançar por `variant="outline"` (mesmo estilo do Voltar `ghost` → unificar ambos como `outline`, com hover sutil).
- Reduzir botões para `h-7 w-7` no mobile (`sm:h-8 sm:w-8`) e ícone `h-3.5 w-3.5`, garantindo que a linha caiba.
- Envelopar com `flex items-center gap-2 w-full flex-nowrap` para impedir quebra.

### 2. `src/pages/vendas/NovaVenda.tsx` — `VendaStepper` (modo `compact`)
- Reduzir gap entre steps (`gap-0.5`), padding do pill (`px-1 py-0.5`), fonte `text-[10px]`, ícone `h-2.5 w-2.5`.
- Conectores menores (`h-px min-w-[6px]`).
- Ocultar labels em telas < 380px (`hidden min-[380px]:inline`) mantendo só o ícone — evita wrap quando 5 etapas + 2 setas estão na mesma linha em 390px.
- Adicionar `overflow-x-auto no-scrollbar` no container do stepper como fallback se ainda transbordar.

### 3. `src/pages/vendas/NovaVenda.tsx` — espaçamento de conteúdo
- Aumentar o spacer final de `h-20` para `h-24 md:h-20` para garantir que o último card/campo não fique sob o rodapé (rodapé mobile tem ~52px + safe-area).
- Manter a classe global do `<main>` (`pb-16 md:pb-10` no `MainLayout`) — sem alteração ali.

### 4. `src/components/layout/SystemFooter.tsx` — densidade mobile
- Reduzir `py-1.5` para `py-1` quando `centerOverride` ativo e remover `gap-3` lateral (`gap-2`) para liberar mais largura para o stepper no mobile.
- Esconder o "accent dot" da esquerda no mobile (`hidden md:block`) para liberar ainda mais espaço.

## Resultado esperado
- Mobile (390px): `[‹] Cliente • Produtos • Pagamento • Entregador • Confirmar [›]` — tudo em uma única linha; botões Voltar/Avançar com o mesmo visual outline; conteúdo da página rolando sem sumir atrás do rodapé.
- Desktop: inalterado visualmente, apenas a unificação dos botões (sem o verde do Avançar).

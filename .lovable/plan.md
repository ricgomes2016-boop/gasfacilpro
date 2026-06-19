## Otimização Nova Venda — aiCommandCard + Stepper

### 1. aiCommandCard → popover acionado por botão

O card do Assistente IA (linhas 1320-1357 de `src/pages/vendas/NovaVenda.tsx`) ocupa uma faixa larga no topo do passo "Cliente" e é pouco usado.

**Solução:** transformar em um botão "Assistente IA" (ícone `Sparkles` + label) colocado na **mesma linha do stepper/atalhos** (linha 1379, ao lado do "Nova Venda" e badge `#numero`).

- Clique abre um `Popover` (`@/components/ui/popover`) alinhado à direita, largura ~`w-[420px]`.
- Conteúdo do popover = exatamente o conteúdo atual do `aiCommandCard`:
  - Input de comando (`aiCommand`)
  - Botões: Mic, Galeria, Câmera, Enviar
  - Texto de dica ("💡 Digite, 🎤 dite, ou 📷 tire foto…")
  - Inputs file ocultos (`photoInputRef`, `cameraInputRef`)
- Mantém todos os handlers existentes: `handleAiCommand`, `startListening`, `stopListening`, `handlePhotoSales`, `aiLoading`, `isListening`, `photoLoading`.
- O botão de abrir mostra estado: ícone pulsa quando `isListening`, spinner quando `aiLoading`/`photoLoading`, badge dot quando há texto digitado pendente.
- Auto-focus no input ao abrir o popover; auto-fechar após `handleAiCommand` resolver com sucesso.
- Remover o `{aiCommandCard}` das linhas 1400 e 1433 (tanto na versão nova quanto na antiga).

**Ganho:** ~80px verticais recuperados no topo da tela.

### 2. Stepper mais compacto

Arquivo: `src/components/vendas/VendaStepper.tsx` (modo `compact` já existe).

- Reduzir altura/padding do modo compact: `py-2` → `py-1.5`, ícones `h-4 w-4` → `h-3.5 w-3.5`, textos `text-xs` → `text-[11px]`.
- Diminuir gap entre steps (`gap-2` → `gap-1`) e separador/connector mais fino.
- Em telas `<sm`: mostrar apenas ícone + check (esconder label do step).
- Reduzir `space-y-3` do wrapper externo (linha 1364 em `NovaVenda.tsx`) para `space-y-2`, juntando stepper + linha de ações com menos respiro.
- Trocar a string longa de atalhos (`F2 Novo · F3 Finalizar · F4 Agendar · F5 Cliente · Enter Próximo`, linha 1381) por um ícone `Keyboard` com `Tooltip` exibindo os atalhos no hover — economiza ~280px horizontais para acomodar o novo botão "Assistente IA".
- Botão "Versão antiga/nova" (linha 1383) vira ícone-only com tooltip.

### 3. Sem mudanças

- `metaCard` (Data de Entrega + Canal de Venda) permanece exatamente como está.
- Toda lógica de negócio, atalhos de teclado, validações, draft, navegação entre passos — inalterados.
- A versão antiga (`useNewView=false`) recebe o mesmo botão na barra superior.

### Detalhes técnicos

- `Popover` / `PopoverTrigger` / `PopoverContent` já existem em `@/components/ui/popover`.
- Estado `aiPopoverOpen` local no componente; fechado por padrão.
- O botão fica visível em todos os passos (não só "cliente"), permitindo lançar venda por IA a qualquer momento.
- Inputs `<input type="file">` ocultos saem do popover e ficam no nível do componente raiz (popover desmonta ao fechar; refs precisam persistir).

### Arquivos afetados

- `src/pages/vendas/NovaVenda.tsx` — remover renderização do `aiCommandCard`, adicionar `AiCommandPopover` na barra superior, mover inputs file.
- `src/components/vendas/VendaStepper.tsx` — densificar modo compact.

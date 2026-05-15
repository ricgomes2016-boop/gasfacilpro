## Redesenho do modal "Itens da Proposta"

O modal atual usa uma grade de 12 colunas muito apertada. No viewport do usuário (~1070px com modal centralizado em `max-w-4xl` mas comprimido pela barra lateral) os inputs ficam tão estreitos que viram pílulas, o cabeçalho `sticky` se sobrepõe à primeira linha e aparece scroll horizontal. Vou reconstruir só o `ItensEditor` (linhas 569–636 de `src/components/config/LicitacaoTab.tsx`) — sem mexer em lógica, persistência ou geração de PDF.

### Mudanças

1. **Container**
   - Trocar `Dialog`/`DialogContent max-w-4xl` por `ResponsiveDialog` + `ResponsiveDialogContent` com `sm:max-w-5xl w-[95vw] p-0` para aproveitar a largura disponível e ganhar versão mobile (drawer).
   - Header e footer com `px-6 py-4` fixos; corpo com `px-6 py-4` e `max-h-[65vh] overflow-y-auto`.

2. **Barra superior (validade + adicionar)**
   - Card claro com `bg-muted/40 rounded-lg px-4 py-3 flex items-center justify-between`.
   - Label "Validade da proposta" + Input `w-20` + sufixo "dias".
   - Botão "Adicionar item" alinhado à direita, com ícone.

3. **Lista de itens — cartões em vez de grade**
   - Abandonar grid de 12 colunas. Cada item vira um cartão (`rounded-md border p-3 space-y-2`) com:
     - Linha 1: badge numérica `#N` + Input "Especificação" largo (`flex-1`) + botão remover (ícone) à direita.
     - Linha 2: 4 campos rotulados em `grid grid-cols-2 sm:grid-cols-4 gap-3`:
       - Quantidade (number)
       - Unidade (text, `w-full`)
       - Valor unitário (number, prefixo "R$")
       - Total calculado (somente leitura, destaque `font-semibold tabular-nums`)
   - Cada campo com `<Label className="text-xs text-muted-foreground">` em cima do input — elimina a confusão de cabeçalhos sticky e funciona em qualquer largura.

4. **Rodapé do total**
   - Faixa fixa abaixo da lista: `border-t bg-muted/40 px-4 py-3 flex justify-between items-center` com "Total Geral" à esquerda e valor formatado em `text-lg font-bold tabular-nums` à direita.

5. **Detalhes visuais**
   - Inputs com `h-9 text-sm`.
   - Hover sutil no cartão (`hover:border-primary/40 transition-colors`).
   - Botão remover só aparece em hover no desktop (`opacity-0 group-hover:opacity-100`) e sempre visível em mobile.

6. **Lógica preservada**
   - Mesmas funções `update`, `add`, `remove`, mesmo estado `list`/`validade`, mesmo `onSave(list, validade)`. Nenhuma mudança em template/PDF/persistência.

### Arquivo afetado

- `src/components/config/LicitacaoTab.tsx` — substituir apenas o componente `ItensEditor` (linhas 569–636).

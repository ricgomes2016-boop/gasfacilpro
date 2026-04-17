
## Problema
No header do ERP (`src/components/layout/Header.tsx`), em telas de celular pequenas (<400px), o conteúdo do lado direito (UnidadeSelector + ícones de chat, notificações, tema, GásMais, avatar) ocupa muito espaço e empurra/esmaga o título da página à esquerda. O `overflow-hidden` no header esconde elementos, e o `UnidadeSelector` tem largura fixa que não encolhe.

## Investigação necessária
Preciso verificar como o `UnidadeSelector` está dimensionado hoje, já que ele é o maior responsável pelo "travamento" do layout em telas pequenas. Também vou conferir o `BuildVersionBadge`, `NotificationCenter`, `BaseChatPanel` e `GasmaisThemeQuickToggle` para garantir que tenham comportamento responsivo adequado.

## Plano de correção

### `src/components/layout/Header.tsx`
1. **Título e subtítulo (esquerda)**:
   - Garantir `min-w-0` no container pai (`flex items-center gap-3`) para permitir truncamento real.
   - Reduzir o tamanho do título em telas muito pequenas (`text-base` em <sm, `text-lg` md, `text-xl` lg).
   - Esconder o subtítulo completo abaixo de `sm` (já está, mas validar).

2. **Lado direito (ações)**:
   - Reduzir `gap` em mobile (`gap-0` no menor breakpoint).
   - **UnidadeSelector**: aplicar `max-w-[120px] sm:max-w-none` ou tornar compacto (só ícone + nome curto truncado) em telas <sm.
   - **GasmaisThemeQuickToggle**: esconder em telas <sm (`hidden sm:inline-flex`) — é um toggle secundário.
   - **NotificationCenter** e **BaseChatPanel**: garantir `h-9 w-9` consistente e shrink-0.
   - Manter avatar do usuário sempre visível.

3. **Container do header**:
   - Reduzir padding horizontal em mobile (`px-2 md:px-6`).
   - Remover `overflow-hidden` do header e aplicar truncamento nos filhos certos (overflow-hidden corta dropdowns potencialmente).

### `src/components/layout/UnidadeSelector.tsx` (a inspecionar e ajustar se necessário)
- Adicionar truncamento ao nome da unidade exibido no botão.
- Largura responsiva: compacto em mobile, expandido em desktop.

## Arquivos afetados
- `src/components/layout/Header.tsx` — ajustes de breakpoints, gap, padding, visibilidade condicional
- `src/components/layout/UnidadeSelector.tsx` — largura responsiva e truncamento (se aplicável após inspeção)

## Resultado esperado
Em telas de 320–400px, o título permanece legível e truncado, o seletor de unidade encolhe mostrando nome curto, ícones secundários (GásMais toggle) somem, e nada estoura a largura do header.

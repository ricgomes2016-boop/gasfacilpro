## Problema

A tela `/config/personalizacao` quebra ao montar porque o `useEffect` que aplica o tema (linha 67-72 de `src/pages/config/PersonalizacaoVisual.tsx`) referencia `PRESET_THEME_OVERRIDES`, mas esse símbolo não está incluído no `import` vindo de `@/lib/themeUtils`.

Resultado: `ReferenceError: PRESET_THEME_OVERRIDES is not defined` → a página não renderiza nada (ou trava no loader, dependendo da ordem de execução).

## Correção

Arquivo: `src/pages/config/PersonalizacaoVisual.tsx`

- Linha 18: incluir `PRESET_THEME_OVERRIDES` no import existente:

```ts
import { THEME_PRESETS, COLOR_OPTIONS, applyTheme, PRESET_THEME_OVERRIDES } from "@/lib/themeUtils";
```

Nenhuma outra alteração necessária — `PRESET_THEME_OVERRIDES` já é exportado em `src/lib/themeUtils.ts` e o resto da lógica está correto.

## Validação

- Abrir `/config/personalizacao` e confirmar que a tela carrega, lista os temas prontos e permite salvar.
- Console sem `ReferenceError`.

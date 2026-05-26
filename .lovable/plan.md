## Diagnóstico

Encontrei a causa real de "só o pastel funciona":

1. `applyTheme()` em `src/lib/themeUtils.ts` aplica os tokens (`--primary`, `--sidebar-*`, `--card`, etc.) como **inline style no `<html>`**.
2. Mas em `PersonalizacaoVisual.tsx` (linhas 337–341), quando o preset escolhido **não tem** `brandThemeId`, chamamos `setBrandTheme("gasfacil")`. Isso coloca a classe `.brand-theme-gasfacil` no `<body>`.
3. Em `src/styles/brand-themes.css`, `.brand-theme-gasfacil` redefine `--primary: 174 61% 47%`, `--sidebar-background: 174 61% 47%`, `--sidebar-gradient-from/to`, `--sidebar-accent*`, `--ring`, etc.
4. Como CSS variables são herdadas, a regra **no `body`** vence sobre o inline do `<html>` para todo o conteúdo (cards, menu, header).

Resultado: só os presets que possuem `brandThemeId` próprio (`dashboard-pastel`, `saas-moderno`) funcionam; os demais (gas-clássico, eco-verde, premium-dark, energia, aurora-glass, onyx-prestige, forte-gas, forte-gas-light) caem no `brand-theme-gasfacil` e ficam com a cara teal padrão. O modo escuro continua mudando porque a classe `.dark` é aplicada à parte.

## O que vou alterar

### 1. `src/lib/themeUtils.ts` — `applyTheme()`
- Após aplicar os overrides no `<html>`, **replicar** os mesmos `setProperty` no `document.body.style`. Inline no body vence a classe `.brand-theme-*` do próprio body.
- Antes de aplicar, limpar `OVERRIDABLE_VARS` também do `document.body.style` (mesmo loop que já fazemos no root) para não acumular lixo de troca de tema.
- Sem isso o modo "padrão" (sem preset) continua igual; só passamos a propagar tokens quando há preset.

### 2. `src/pages/config/PersonalizacaoVisual.tsx` (linhas 335–342)
- Continuar chamando `setBrandTheme(preset.brandThemeId)` quando existir.
- Para presets sem `brandThemeId`, **manter o brand theme atual** (não forçar `"gasfacil"`). Hoje forçar `gasfacil` é exatamente o que sobrescreve os tokens. Como agora o `applyTheme` escreve no body, a classe ainda fica, mas o inline do body vence — fica seguro.
- Alternativa, se a classe atrapalhar fontes/logo: introduzir id sentinel `"none"` em `brandThemes.ts` (className vazia). Não vou fazer isso para evitar refactor; basta o passo do applyTheme.

### 3. `src/components/layout/ThemeSync.tsx`
- Nenhuma mudança lógica. Continua escolhendo o preset por `cor + dark` e chamando `applyTheme(..., preset.id)`. Como agora `applyTheme` propaga ao body, a sincronização entre rotas/recarregamentos passa a refletir o tema correto em cards e menu também.

## Validação

1. Em `/config/personalizacao` clicar em cada um dos 10 temas e confirmar que **header, sidebar (gradiente + item ativo), cards, popovers e bordas** mudam imediatamente.
2. Salvar, navegar para outra rota (ex.: `/dashboard`, `/financeiro`, `/estoque`) e confirmar que o tema permanece em todas as páginas.
3. Recarregar a página: `ThemeSync` deve reaplicar o tema salvo no banco e o visual deve continuar igual.
4. Telas públicas (App Cliente, Entregador, ForteGás, JapaGás, CentralGasCP, Auth) — confirmar que **não foram afetadas** (elas vivem fora do `MainLayout`/`.system-surface`, e como não escrevemos tokens em CSS global, seguem com seu branding próprio).
5. Sidebar colapsada e Drawer mobile herdam os mesmos tokens (continuam OK).

## Arquivos a editar

- `src/lib/themeUtils.ts` (alterar somente a função `applyTheme`)
- `src/pages/config/PersonalizacaoVisual.tsx` (remover `setBrandTheme("gasfacil")` no `else`)

Nenhuma alteração em `index.css`, `Sidebar.tsx`, `MainLayout.tsx` ou `brand-themes.css`.

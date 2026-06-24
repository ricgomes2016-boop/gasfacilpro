
# Tema Premium padrão — menu, cards, KPI e tabelas

Como você não escolheu, adoto defaults profissionais:
- Paleta: **Midnight Indigo** (navy profundo + indigo elétrico + dourado sutil de acento)
- Modos: **claro e escuro** (alternável)
- Menu: **compacto com ícones + labels**, colapsável para rail no desktop e drawer no mobile

## O que entrega

1. Novo preset **"Premium"** no seletor de Personalização Visual, marcado como padrão sugerido.
2. Brand theme `premium` (light + dark) com tokens consistentes para fundo, superfícies, primário, accent dourado, bordas hairline e sombras em duas camadas.
3. Sidebar premium: tipografia mais firme, item ativo com barra lateral indigo + fundo translúcido, hover sutil, agrupamentos com label uppercase tracking-wide, divisores hairline; rail 64px no desktop e drawer fullscreen no mobile.
4. Card premium: borda hairline + sombra dupla discreta, header sem fundo cinza, sem "card dentro de card". Variantes mantidas: `default`, `flat`, `sunken`, `interactive`, `kpi`.
5. KPI premium: gradiente leve da superfície para muted, faixa lateral 2px no accent (indigo no light, dourado no dark), número em display font tabular, label uppercase, delta colorido (verde/vermelho) com chip arredondado.
6. Tabela premium: header `bg-muted/40` uppercase tracking-wide, linhas com hairline `border-b border-border/40`, hover `bg-muted/30`, célula numérica `tabular-nums text-right`, primeira coluna `font-medium`. Sem zebra. Em mobile, wrapper com scroll horizontal + sombra-fade nas bordas; tabelas marcadas com `data-stack-mobile` viram lista de cards.
7. Ajuste fino mobile: aumenta toque (min-h 44px nas linhas e itens de menu), inputs 16px, paddings reduzidos nos cards (`p-4` mobile / `p-6` desktop), KPIs em grid 2 colunas no mobile.
8. ThemeSync e PersonalizacaoVisual passam a aplicar `premium` como brand theme quando o preset Premium é escolhido; modo light/dark respeita o toggle global existente.

## Arquivos a editar/criar

- `src/lib/brandThemes.ts` — adicionar `premium` em `BrandThemeId` e no array de presets; tornar `defaultBrandTheme` o premium.
- `src/styles/brand-themes.css` — `.brand-theme-premium` (light) e `.dark .brand-theme-premium` (dark) com tokens completos: `--background`, `--foreground`, `--card`, `--muted`, `--primary`, `--accent`, `--sidebar-*`, `--border`, `--ring`, `--brand-font`, e variáveis novas `--shadow-elevated`, `--shadow-hairline`, `--kpi-accent`.
- `src/lib/themeUtils.ts` — registrar preset "Premium" em `PRESET_THEME_OVERRIDES` (apontando para `brandThemeId: "premium"`); incluir `PRESET_EXTRA_CSS["premium"]` com regras de menu/card/kpi/tabela; adicionar `.brand-theme-premium` em `BRAND_THEME_SELECTORS`.
- `src/pages/config/PersonalizacaoVisual.tsx` — marcar Premium como recomendado/destaque ("Padrão Premium") e como primeiro item.
- `src/components/ui/card.tsx` — refinar variante `kpi` para usar tokens `--kpi-accent` e `--shadow-elevated`; ajustar paddings responsivos.
- `src/components/ui/table.tsx` — header/células/rows usando tokens premium; adicionar wrapper com `overflow-x-auto` + máscara de fade nas bordas; suporte a `data-stack-mobile` para virar lista no mobile.
- `src/components/layout/MainLayout.tsx` / sidebar — aplicar classes premium (item ativo com barra lateral, label uppercase, drawer mobile).
- `src/index.css` — registrar as variáveis novas (`--shadow-elevated`, `--shadow-hairline`, `--kpi-accent`) com fallback no tema base e reforçar regra anti "card dentro de card".

## Detalhes técnicos (tokens principais)

```text
Premium Light
  --background: 220 25% 98%
  --foreground: 222 47% 11%
  --card: 0 0% 100%
  --muted: 220 20% 95%
  --primary: 238 75% 58%        (indigo)
  --accent: 43 70% 52%          (dourado sutil)
  --border: 220 18% 88%
  --sidebar-bg: 222 45% 14%
  --sidebar-fg: 220 18% 92%
  --sidebar-active: 238 80% 62%
  --kpi-accent: 238 75% 58%
  --shadow-elevated: 0 1px 2px hsl(222 47% 11% / .05), 0 8px 24px -12px hsl(222 47% 11% / .12)

Premium Dark
  --background: 222 47% 7%
  --foreground: 220 20% 96%
  --card: 222 40% 11%
  --muted: 222 30% 16%
  --primary: 238 85% 68%
  --accent: 43 80% 62%
  --border: 222 25% 20%
  --sidebar-bg: 222 50% 5%
  --sidebar-active: 238 90% 70%
  --kpi-accent: 43 80% 62%
```

Regras CSS chave injetadas pelo preset:
- `.app-card.kpi { border-left: 2px solid hsl(var(--kpi-accent)); background: linear-gradient(180deg, hsl(var(--card)), hsl(var(--muted)/.5)); }`
- `[data-sidebar="menu-button"][data-active="true"] { box-shadow: inset 2px 0 0 hsl(var(--sidebar-active)); background: hsl(var(--sidebar-active)/.12); }`
- `table thead th { text-transform: uppercase; letter-spacing: .04em; font-size: .72rem; }`
- `@media (max-width: 640px) { table[data-stack-mobile] thead { display:none } table[data-stack-mobile] tr { display:block; border:1px solid hsl(var(--border)); border-radius:12px; padding:12px; margin-bottom:8px } }`

## Fora de escopo

- Não mexe em lógica de negócio, rotas, App.tsx, providers, edge functions ou schema.
- Não remove presets existentes — apenas adiciona Premium e o marca como padrão sugerido.

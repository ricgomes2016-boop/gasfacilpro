## Objetivo

Em `Configurações → Personalização Visual`:
1. Garantir que **todos os temas prontos** carreguem corretamente (cores, menu, cards).
2. No tema **Clássico** (Gás Clássico), fazer ajuste fino em cards, tabelas e KPIs.
3. Ao trocar de tema, **menu lateral** acompanha sempre.
4. Sem mexer em `App.tsx`, providers, rotas, ou lógica de negócio.

## Diagnóstico

### Bug raiz dos temas que não carregam
Em `PersonalizacaoVisual.tsx`, ao clicar num preset **sem `brandThemeId`** (Gás Clássico, Eco Verde, Premium Dark, Energia, Forte Gás, Aurora Glass, Onyx Prestige, Forte Gás Light), **`setBrandTheme` não é chamado**. Resultado: a classe `.brand-theme-*` anterior (`gasmais`, `executive`, `signature`…) continua no `<body>` injetando `--primary`, `--sidebar-*` e `--brand-font` antigos e poluindo o preset escolhido. O menu/sidebar e a fonte ficam misturados.

`ThemeSync.tsx` tem o mesmo gap — ao carregar, força `brandTheme = "gasfacil"` sempre que o preset não tem `brandThemeId`, mas `.brand-theme-gasfacil` sobrescreve `--primary` para teal, brigando com o preset. Funciona só porque `applyTheme` injeta inline no `<body>` (frágil) e quebra em qualquer componente que use a variável herdada de uma sub-árvore.

### Falta de ajuste fino
- KPIs (`StatCard`/dashboards) usam `bg-card` puro — sem hierarquia visual no tema Clássico (tudo cinza claro chapado).
- Tabelas dentro de `<Card>` ainda existem em várias telas (efeito card-dentro-de-card já parcialmente resolvido).
- Linhas de tabela com `text-foreground/70` viram quase ilegíveis em alguns presets escuros.

## Mudanças

### 1. `src/lib/brandThemes.ts`
Adicionar preset neutro `"classic"` (sem overrides de cor — apenas fonte) que serve de "limpa-trastes" quando o preset escolhido define seus próprios tokens via `PRESET_THEME_OVERRIDES`.

```ts
{ id: "classic", className: "brand-theme-classic", fontLabel: "Plus Jakarta Sans", ... }
```

### 2. `src/styles/brand-themes.css`
- Criar `.brand-theme-classic { --brand-font: 'Plus Jakarta Sans', ...; }` **sem nenhuma variável de cor** — deixa o preset reinar.
- Incluir `.brand-theme-classic` no seletor de `font-family` no final.

### 3. `src/lib/themeUtils.ts`
- Mapear **todos os presets sem `brandThemeId`** para `brandThemeId: "classic"` implicitamente (em vez do default `gasfacil`).
- Adicionar `.brand-theme-classic` em `BRAND_THEME_SELECTORS` (na verdade não precisa — sem vars não há conflito).
- Ampliar `OVERRIDABLE_VARS` para garantir limpeza de `--brand-font` quando trocar.

### 4. `src/pages/config/PersonalizacaoVisual.tsx`
No `onClick` do preset:
```ts
const nextBrandThemeId = ("brandThemeId" in preset)
  ? preset.brandThemeId
  : "classic";
setBrandTheme(nextBrandThemeId as BrandThemeId);
```
Remove o comentário "NÃO forçar gasfacil" pois agora forçamos `classic`.

### 5. `src/components/layout/ThemeSync.tsx`
Mesma lógica — quando o preset carregado do banco não tem `brandThemeId`, aplicar `classic` em vez de `gasfacil`.

### 6. Ajuste fino — KPIs, cards e tabelas
Pequenos refinos puramente visuais usando tokens semânticos (sem hardcode):

- `src/components/ui/card.tsx`: adicionar variante `kpi` (gradiente sutil `from-card to-muted/40`, borda mais marcada à esquerda em `--primary`, número `tabular-nums font-semibold tracking-tight`).
- `src/components/ui/table.tsx`: subir contraste das linhas — `TableCell` de `text-foreground/90` → `text-foreground`; cabeçalho com `text-foreground/70` (era muted-foreground muito apagado em presets escuros).
- `src/index.css`: adicionar regra `.app-card.kpi` (sombra suave + hover lift discreto). E no preset `gas-classico` (via `PRESET_EXTRA_CSS`), adicionar:
  - sombra de card mais nítida (`0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(26,111,204,.18)`)
  - cabeçalho de tabela com `bg-primary/5`
  - KPI com borda esquerda `border-l-2 border-primary/60`

### 7. Menu lateral acompanhando o tema
Já há `--sidebar-*` em todos os presets. Garantir que `Sidebar` use `bg-[hsl(var(--sidebar-background))]` e o gradiente quando `--sidebar-gradient-from/to` existirem (já implementado). Apenas confirmar visualmente após o fix do brand-theme leftover.

## Arquivos afetados

- `src/lib/brandThemes.ts` (+ preset `classic`)
- `src/styles/brand-themes.css` (+ classe `classic`)
- `src/lib/themeUtils.ts` (limpeza de fonte; OVERRIDABLE_VARS)
- `src/pages/config/PersonalizacaoVisual.tsx` (forçar `classic` quando preset não tem brandThemeId)
- `src/components/layout/ThemeSync.tsx` (mesma lógica)
- `src/components/ui/card.tsx` (variante `kpi`)
- `src/components/ui/table.tsx` (contraste)
- `src/index.css` (regras `.app-card.kpi` + extras do preset clássico via `PRESET_EXTRA_CSS`)

## Fora de escopo

- App.tsx, providers, rotas.
- Componentes públicos (ForteGas, JapaGas, App Cliente, Entregador, Parceiro, Contador, Auth) — mantêm branding próprio.
- Não converto KPIs existentes para a variante `kpi` em massa; deixo opt-in. Posso aplicar nos 2-3 dashboards principais (`Dashboard`, `AdminDashboard`, `VendedorDashboard`) se confirmar.

## Verificação

Após implementar, abro `/config/personalizacao` em Playwright, clico em cada preset, capturo screenshot da home + uma tela com tabela e confirmo: menu mudou, cards e KPIs respeitam o tema, fonte do preset anterior não persiste.

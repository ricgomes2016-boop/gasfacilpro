# Refino visual — Tema "Operacional Clean"

## Escopo

Atualizar **somente** o bloco `.brand-theme-operacional-clean` em `src/styles/brand-themes.css`, alinhando cores, tipografia, espaçamentos, bordas e hovers ao novo Design System (estilo GestãoClick).

**Nenhum** componente React, rota, hook, página, provider, regra de negócio, layout ou nome é alterado. Apenas tokens CSS e regras escopadas dentro do tema.

## Diagnóstico do que vai mudar (e o que NÃO vai)

| Camada | Estado atual | Ação |
|---|---|---|
| Header | Fundo escuro `222 47% 11%` | Trocar para `#FFFFFF` com borda inferior `#E5E7EB`, ícones em `#6B7280` |
| Sidebar | Branco genérico, item ativo roxo | Branco, item selecionado com **barra azul à esquerda + bg `#EEF5FF` + texto/ícone `#2563EB`** |
| Primary | Roxo `250 78% 60%` | Azul `#3B82F6` / hover `#2563EB` |
| Cards | Sombra leve já existe | Manter, ajustar borda para `#E5E7EB`, radius **12px**, padding interno 24px |
| KPIs | Herdam tokens de card | Acento colorido apenas na faixa/ícone do indicador (verde/azul/laranja/vermelho) |
| Tabelas | Cabeçalho muted | Cabeçalho `#F3F4F6`, hover linha `#F9FAFB`, divisórias finas |
| Inputs | Radius do tema (`0.5rem`) | Radius **10px**, altura **42px**, focus `#3B82F6` |
| Botões | Radius `0.5rem` | Radius **10px**, altura **40-44px**, sem glow/gradiente |
| Tipografia | Plus Jakarta Sans | Inter (400/500/600/700), títulos 600 |
| Fundo | `220 20% 97%` | `#F5F7FA` |
| Texto | `222 30% 16%` | Principal `#111827`, secundário `#6B7280` |
| Estrutura/layout | Header.tsx, Sidebar.tsx, MainLayout.tsx | **NÃO TOCAR** |

## Implementação

### Único arquivo editado

`src/styles/brand-themes.css` — substituir/expandir o bloco `.brand-theme-operacional-clean` e suas regras escopadas (linhas 222-292). Nenhum outro arquivo é tocado.

### 1. Tokens base (substituição dentro do bloco existente)

```text
--brand-font: 'Inter', ui-sans-serif, system-ui, sans-serif
--background:      220 20% 97%   → #F5F7FA
--foreground:      222 47% 11%   → #111827
--card:            0 0% 100%     → #FFFFFF
--card-foreground: 222 47% 11%   → #111827
--popover/-fg:     iguais ao card
--primary:         217 91% 60%   → #3B82F6
--primary-foreground: 0 0% 100%
--secondary:       220 14% 96%   → #F3F4F6
--secondary-foreground: 222 47% 11%
--muted:           220 14% 96%   → #F3F4F6
--muted-foreground: 220 9% 46%   → #6B7280
--accent:          214 95% 96%   → #EEF5FF  (uso: item de menu selecionado)
--accent-foreground: 221 83% 53% → #2563EB
--border:          220 13% 91%   → #E5E7EB
--input:           220 13% 91%   → #E5E7EB
--ring:            217 91% 60%   → #3B82F6
--radius:          0.625rem      → 10px
--success: 122 39% 49% (#4CAF50)
--warning: 38 92% 50% (#F59E0B)
--info:    217 91% 60% (#3B82F6)
--destructive: 0 84% 60% (#EF4444)
```

### 2. Sidebar (claro, item ativo azul)

```text
--sidebar-background:        0 0% 100%   (#FFFFFF)
--sidebar-foreground:        220 9% 46%  (#6B7280) — itens inativos
--sidebar-primary:           217 91% 60% (#3B82F6)
--sidebar-primary-foreground:0 0% 100%
--sidebar-accent:            214 95% 96% (#EEF5FF) — bg do item ativo
--sidebar-accent-foreground: 221 83% 53% (#2563EB) — texto/ícone ativo
--sidebar-border:            220 13% 91% (#E5E7EB)
--sidebar-ring:              217 91% 60%
--sidebar-gradient-from/to:  0 0% 100% (achata o gradiente sem mexer em código)
```

### 3. Header (branco)

```text
--clean-header-bg:     0 0% 100%   (#FFFFFF)
--clean-header-fg:     222 47% 11% (#111827)
--clean-header-border: 220 13% 91% (#E5E7EB)
```

### 4. Regras escopadas (atualizar as já existentes, sem criar componentes novos)

- `cards/.kpi-card`: borda `--border`, radius `12px` (override só para `[data-slot="card"]` mantendo `--radius` 10px para inputs/botões), sombra `0 1px 2px rgba(17,24,39,0.04)`, padding interno `1.5rem` aplicado via `:where([data-slot="card-content"])`.
- `table thead`: bg `#F3F4F6`, texto `#6B7280`, font-size `12px`, font-weight 600, uppercase removido.
- `tbody tr:hover`: `#F9FAFB`.
- `input, button, select` dentro de `.brand-theme-operacional-clean`: `min-height: 42px` para inputs/selects, `40-44px` para botões; `border-radius: 10px`.
- `:where(h1,h2,h3,h4,h5,h6)`: font-weight `600`, letter-spacing `-0.01em`.
- Barra azul à esquerda do item de menu ativo: `:where([data-active="true"], [aria-current="page"])` recebe `box-shadow: inset 3px 0 0 hsl(var(--sidebar-accent-foreground))`. Funciona com a marcação já existente no `Sidebar.tsx`, **sem alterar o componente**.
- Hover de itens de menu inativos: `background-color: #F3F4F6`, transição `150ms`.
- KPIs: acento de cor controlado por classes utilitárias já existentes (`text-green-*`, `text-blue-*`, etc.) — sem mudança de componente. Apenas garantir que o card-base fique branco e neutro.

### 5. Animações

Adicionar no escopo do tema:
```text
* { transition-duration: 150ms } — apenas para hover de menu/botão/input via :where()
.brand-theme-operacional-clean :where(button, a, [role="menuitem"]):hover { transition: background-color 150ms, color 150ms }
```
Nada mais (sem framer-motion changes).

## Critérios de aceite

1. Trocar para o tema "Operacional Clean" muda visualmente Header, Sidebar, Cards, KPIs, Tabelas, Inputs, Botões — sem qualquer alteração de componente React.
2. Item de menu selecionado mostra **barra azul à esquerda**, bg `#EEF5FF`, texto/ícone `#2563EB`.
3. Header branco com linha inferior cinza clara; ícones em cinza.
4. Cards brancos, borda `#E5E7EB`, radius 12px, sombra leve.
5. Inputs com radius 10px, altura 42px, foco azul.
6. Fonte Inter aplicada em todo o tema.
7. Demais temas (`premium`, `gasfacil`, `gasmais`, `signature`, etc.) permanecem 100% intactos.
8. Build sem erros; nenhuma rota, página ou hook alterado.

## Fora de escopo (não fazer)

- Editar `Header.tsx`, `Sidebar.tsx`, `MainLayout.tsx`, `UnidadeSelector.tsx` ou qualquer componente.
- Criar novos componentes (`CleanPageTitleBar`, `CleanQuickShortcuts`, etc.).
- Mexer em rotas, hooks, providers, contextos, edge functions, banco.
- Alterar outros temas ou tokens globais fora do bloco `.brand-theme-operacional-clean`.

## Arquivos afetados

- `src/styles/brand-themes.css` — único arquivo modificado.

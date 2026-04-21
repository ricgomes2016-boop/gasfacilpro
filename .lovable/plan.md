

## Objetivo

1. Aplicar paleta de cores inspirada na imagem (tons roxo/violeta profundo com acentos vibrantes) em todo o portal do contador.
2. Garantir que o filtro de mês (período) funcione corretamente na página `/contador/xml`, deixando-o como comportamento padrão.

## 1. Nova paleta do Portal do Contador

Inspirada na imagem: fundo roxo profundo com gradiente, cards translúcidos, acento violeta vibrante e detalhes em rosa/magenta.

Tokens (HSL) que serão criados em `src/styles/theme-contador.css` (escopo `.theme-contador`):

```text
--background:        252 45% 8%      (roxo quase preto)
--foreground:        250 20% 96%
--card:              252 35% 13%     (card escuro translúcido)
--card-foreground:   250 20% 96%
--muted:             252 25% 18%
--muted-foreground:  250 15% 70%
--primary:           265 85% 65%     (violeta vibrante - botões)
--primary-foreground:0 0% 100%
--accent:            290 80% 65%     (magenta - destaques)
--accent-foreground: 0 0% 100%
--border:            252 30% 22%
--ring:              265 85% 65%
--sidebar-background:252 50% 6%
--sidebar-accent:    265 60% 25%
```

Mais um gradiente global de fundo:
```text
background: radial-gradient(at 20% 0%, hsl(265 70% 25% / 0.6), transparent 50%),
            radial-gradient(at 80% 100%, hsl(290 60% 25% / 0.5), transparent 50%),
            hsl(252 45% 8%);
```

### Aplicação
- Criar `src/styles/theme-contador.css` com os tokens acima.
- Importar o CSS no `src/main.tsx` (ou onde os outros temas são importados).
- Aplicar a classe `theme-contador` no layout do contador (`src/layouts/ContadorLayout.tsx` ou equivalente — será localizado).
- Ajustar a sidebar e o header do contador para usar `bg-sidebar`, `text-sidebar-foreground`, `border-sidebar-border`.
- Trocar cores hardcoded `hsl(220,18%,15%)` etc. nas páginas `src/pages/contador/*` e `src/components/contador/*` por tokens semânticos (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-primary`).

### Páginas/componentes afetados pelo recolor
- `src/pages/contador/ContadorXML.tsx`
- `src/pages/contador/ContadorDashboard.tsx` (e demais páginas do portal)
- `src/components/contador/FiltroPeriodo.tsx`
- `src/components/contador/ImportacaoInteligente.tsx`
- Layout/sidebar do contador

## 2. Filtro de mês na página XML

Hoje o `ContadorXML.tsx` está com `ignorarPeriodo = true` por padrão (mostra tudo). Será ajustado para:

- `ignorarPeriodo` inicia em `false` → o filtro do `PeriodoContext` (mês atual por padrão) é aplicado direto na query por `data_emissao`.
- Manter o toggle “Mostrar todos os períodos” como opção secundária.
- Garantir refetch automático ao mudar `preset` ou datas customizadas (dependência do `useEffect` já considera `range.inicioISO`/`fimISO`).
- Mostrar com destaque o período ativo (ex.: “Exibindo: 04/2026 — 47 XML”).
- Estado vazio diferenciado quando há registros no banco mas o mês filtrado não tem nada: oferecer botão “Ver todos os períodos”.

### Arquivos
- `src/pages/contador/ContadorXML.tsx` — alterar default do estado, ajustar banner e estado vazio.

## Resultado esperado

- Portal do contador com identidade visual nova (roxo profundo + violeta/magenta), coerente em todas as páginas.
- Página `/contador/xml` abre já filtrada pelo mês atual; trocar o seletor de período recarrega imediatamente; opção de ver tudo continua disponível.

## Detalhes técnicos

- Sem migração de banco.
- Sem mexer em `App.tsx`, providers ou rotas.
- Tokens em HSL (sem `hsl(...)`), respeitando o padrão Tailwind do projeto.
- Tema isolado por classe (`.theme-contador`) — não afeta ERP, app cliente, entregador nem transportadora.


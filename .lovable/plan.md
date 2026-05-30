## Diagnóstico — Relatório de Vendas hoje

Hoje a tela tem **três blocos de filtro diferentes**, com sobreposição de função:

1. **Card "Filtros" global (topo)** — `RelatorioVendas.tsx` linhas 796–890
   - Data Início / Data Fim (input date)
   - Status / Canal / botão Atualizar
   - Linha "Período rápido": Mês atual, Últimos 3/6/12, Ano atual, Ano anterior
   - Switch "Consolidar todas as unidades" (matriz)

2. **Card verde "Comparativo Mensal por Produto"** dentro da aba **Produtos** — linhas 1250–1353
   - De / Até (input month, independente do filtro global)
   - Select Quantidade / Faturamento
   - Atalhos próprios: Ano todo, Até hoje, Últimos 3/6/12, Ano anterior
   - Chips dos meses selecionados (Jan/26, Fev/26…)

3. **Aba "Produtos Vendidos"** (`ProdutosVendidosTab.tsx`) — linhas 261–360
   - Repete Data Início / Data Fim
   - Repete "Período rápido"
   - Botão exportar XLSX

Resultado: o usuário vê o mesmo filtro 2–3 vezes, com estados independentes que se contradizem. No mobile (384px) a tela fica cheia de cartões verdes/roxos com seletores de data repetidos.

---

## Plano

### 1. Barra de filtros única, fixa e enxuta (topo)

Substituir o `Card "Filtros"` por uma **FilterBar** compacta, com dois níveis:

**Linha 1 — sempre visível (1 só linha no mobile):**

```text
[ Período ▾ ]   [ Atualizar ⟳ ]   [ Mais filtros ▾ ]
```

- **Botão Período** abre um **Popover** com:
  - Presets em chips: Mês atual · Últimos 3m · Últimos 6m · Últimos 12m · Ano atual · Ano anterior · Personalizado
  - Quando "Personalizado" → mostra Data Início / Data Fim
  - O período escolhido é **a única fonte da verdade** (estado `dataInicio`/`dataFim` global).
- **Mais filtros** abre Popover com Status, Canal e (se matriz) o switch Consolidar.
- Resumo do filtro ativo aparece como chips abaixo da barra: "Mai/2026 · Entregue · Loja" (com X para limpar individual).

### 2. Aba "Produtos" — remover filtros próprios do Comparativo Mensal

- Eliminar os inputs De/Até e os 6 botões de atalho do header verde "Comparativo Mensal por Produto".
- **O comparativo passa a usar o período global** (`dataInicio`/`dataFim`) e derivar os meses cobertos automaticamente. Os chips de meses selecionados continuam aparecendo, mas só como visualização (read-only).
- Manter apenas o **Select "Quantidade / Faturamento"** dentro do card, pois é uma opção de **métrica**, não de período.
- Remover `rangeIni` / `rangeFim` / `setRangeIni` / `setRangeFim` e a lista de presets do JSX. Os meses passam a ser calculados a partir do intervalo global (`startOfMonth(dataInicio)` → `endOfMonth(dataFim)`, limitado a, por exemplo, 24 meses para proteção).

### 3. Aba "Produtos Vendidos" — remover filtros duplicados

- Em `ProdutosVendidosTab.tsx`, remover o bloco de Data Início/Data Fim (linhas ~261) e o bloco "Período rápido" (linhas ~325).
- Manter apenas: o agrupamento (dia/semana/mês), busca por produto e o botão Exportar XLSX.
- A prop `onPeriodoChange` deixa de ser usada para alterar período (segue read-only via `dataInicio`/`dataFim` recebidos).

### 4. Layout mobile (384px)

- FilterBar fica **sticky no topo** da página (`sticky top-0 z-20`) com `backdrop-blur` para continuar legível ao rolar.
- Popovers usam `ResponsiveDialog` (drawer no mobile) seguindo o padrão do projeto.
- Chips de filtro ativo quebram em múltiplas linhas (`flex-wrap`).

### 5. Detalhes técnicos / arquivos afetados

- `src/pages/vendas/RelatorioVendas.tsx`
  - Trocar o `<Card>` de Filtros pela nova `FilterBar` (componente local no mesmo arquivo ou em `src/components/vendas/FilterBarRelatorio.tsx`).
  - Remover `rangeIni`, `rangeFim` e seus presets; derivar `periodosSelecionados` a partir de `dataInicio`/`dataFim` global.
  - Remover a action do `VendaSectionHeader` do comparativo (deixar só o Select de métrica).
- `src/pages/vendas/ProdutosVendidosTab.tsx`
  - Apagar os dois blocos de filtro de período (Linhas 261–283 e 325–360 aprox), mantendo o restante intacto.
- Sem mudanças em backend, RLS, queries ou rotas.

### 6. Fora do escopo

- Não mexer em `App.tsx`, providers, autenticação, dados ou RLS.
- Não alterar gráficos, tabelas, exportações (PDF/XLSX) nem a lógica de vendas manuais — apenas a UI de filtros.

---

## Resultado esperado

```text
ANTES                              DEPOIS
─────────────                      ─────────────
Filtros (5 inputs + 6 chips)       FilterBar (1 linha)
  ↓                                 ↓ chips de filtro ativo
Tabs                               Tabs
  Produtos                          Produtos
   └ Comparativo (De/Até + 6        └ Comparativo (só Qtd/Fat)
     presets + chips)               (usa período global)
  Produtos Vendidos                 Produtos Vendidos
   └ Data Início/Fim + 6 presets    └ só agrupamento + busca
```

Um único lugar para escolher período/status/canal. As abas só mostram dados.
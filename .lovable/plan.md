

## Objetivo

Transformar a aba **Extratos** de `/contador/financeiro` numa planilha interativa multi-conta com tabs dinâmicas por conta bancária, categorização editável, totais e filtros — alimentada pelos dados já importados via `DialogImportarOFX` (sem refazer a importação, que continua igual).

## Mudanças

### 1. Nova aba dinâmica por conta bancária na página `/contador/financeiro`

Em `src/pages/contador/ContadorFinanceiro.tsx`, substituir a tabela única atual da aba **Extratos** por:

- **Tab "Todas as contas"** (visão consolidada) + uma tab para cada `conta_bancaria_id` distinto presente em `extrato_bancario` no período.
- Label de cada tab: `[UNIDADE] · [BANCO] ····[4 últimos da conta]`. Quando o lançamento não tiver `conta_bancaria_id`, agrupar em tab `Sem conta vinculada`.
- Setas ←/→ no header para navegar entre tabs (ChevronLeft/ChevronRight) + clique direto.
- Ícone Banknote por tab.

### 2. Planilha interativa

Componente novo `src/components/contador/PlanilhaExtratos.tsx` (uma tabela reaproveitada pelas tabs):

Colunas:
| Coluna | Comportamento |
|---|---|
| Data | `dd/MM/yyyy`, `tabular-nums`, `whitespace-nowrap` |
| Descrição | texto, truncate com tooltip |
| Débito | valor absoluto se `valor < 0`, célula vermelha, alinhada à direita |
| Crédito | valor absoluto se `valor >= 0`, célula verde, alinhada à direita |
| Saldo | acumulado calculado client-side por aba (ordem cronológica), verde se ≥0, vermelho se <0 |
| Categoria | `<Select>` editável com opções pré-definidas (Alimentação, Combustível, Salário, Fornecedores, Impostos, Tarifas Bancárias, Transferência, Outros). Persiste em `extrato_bancario.categoria` via update inline |
| Conciliado | badge Sim/Não (somente leitura aqui) |

UX:
- Cabeçalho com clique para ordenar (asc/desc) por Data ou Valor.
- Virtualização leve via paginação cliente (50/100/500 linhas, default 100).
- Linha com `valor === 0` ou `|valor| > 100000` recebe ícone `AlertTriangle` amarelo.
- Footer fixo da tabela: **Saldo Inicial** (calculado), **Total Débitos**, **Total Créditos**, **Saldo Final** — sempre refletindo os filtros ativos.

### 3. Filtros (barra acima da tabela)

- Range de datas (já existe no `PeriodoContext` global; adicionar filtros locais de refinamento dentro da aba):
  - Busca por descrição (input com debounce).
  - Tipo: Todos / Débito / Crédito (toggle group).
  - Categoria: multi-select.
  - Valor mínimo / máximo (inputs numéricos).
- Estado dos filtros locais persistido em `localStorage` por chave `extratos-filtros-v1`.

### 4. Estados vazios e erros

- Sem dados no período: card centralizado com mensagem "Nenhum extrato importado neste período. Use **Importar OFX** acima para começar." + botão atalho que abre o `DialogImportarOFX` existente.
- Tab de conta sem lançamentos após filtros: "Nenhuma transação corresponde aos filtros."
- Erro de fetch: toast + botão "Tentar novamente".

### 5. Migração mínima de banco

Coluna `categoria text` em `extrato_bancario` (nullable). Se já não existir.

```sql
ALTER TABLE public.extrato_bancario ADD COLUMN IF NOT EXISTS categoria text;
```

Sem alteração em RLS — a coluna herda as policies existentes.

### 6. Exportação

Reaproveitar o `BotaoExportar` que já está na página, adicionando a coluna `Categoria` ao CSV/PDF e respeitando os filtros locais (passando `extratosFiltrados` em vez de `extratos`).

### 7. Botão "Importar OFX"

Permanece igual — o `DialogImportarOFX` já está pronto, com abas de preview, detecção em cascata e toast de sucesso. Após importar, a aba **Extratos** recarrega automaticamente (já há `onConcluido={fetchExtratos}`).

## Arquivos afetados

- **Editar**: `src/pages/contador/ContadorFinanceiro.tsx` — tabs dinâmicas por conta + integração com nova planilha + filtros locais.
- **Novo**: `src/components/contador/PlanilhaExtratos.tsx` — planilha interativa com saldo acumulado, categoria editável, paginação, ordenação e footer com totais.
- **Migração**: adicionar coluna `categoria` em `extrato_bancario`.

Sem mexer em `App.tsx`, providers, rotas, parser OFX nem no fluxo de importação atual.

## Critérios de aceite

- ✓ Tabs aparecem automaticamente, uma por conta bancária presente nos extratos do período + tab "Todas as contas".
- ✓ Cada planilha mostra Data, Descrição, Débito (vermelho), Crédito (verde), Saldo acumulado, Categoria editável.
- ✓ Footer mostra Saldo Inicial, Total Débitos, Total Créditos, Saldo Final dinâmicos.
- ✓ Filtros (descrição, tipo, categoria, valor) funcionam por aba e persistem.
- ✓ Estado vazio leva para o `DialogImportarOFX` existente.
- ✓ Categoria é persistida no banco ao alterar no select.
- ✓ Exportação CSV/PDF respeita filtros e inclui categoria.


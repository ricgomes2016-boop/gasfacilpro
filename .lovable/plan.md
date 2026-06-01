## Objetivo

Substituir a tela atual `/financeiro/fluxo-caixa` (cards + gráfico) por uma visualização tipo "extrato bancário" como no Gas Expert da imagem: seletor de conta, intervalo de datas, saldo do período em destaque, e uma tabela linha-a-linha com saldo corrido.

## Layout da nova tela

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Fluxo de Caixa                                            [+ Nova Mov.]  │
├──────────────────────────────────────────────────────────────────────────┤
│  Caixas / Bancos         Período                                         │
│  [ BANCO ITAÚ        ▼]  [30/05/2026] até [31/05/2026]   [Aplicar]       │
│  [ Faça uma busca...  ]                              ┌─ Saldo Atual ──┐  │
│                                                      │ BANCO ITAÚ     │  │
│                                                      │   R$ 12.430,00 │  │
│                                                      └────────────────┘  │
├──────────────────────────────────────────────────────────────────────────┤
│ Data       │ Histórico                 │ Entrada │ Saída │ A Receber │Saldo│
│ 30/05/2026 │ SALDO INICIAL             │         │       │           │ 0,00│
│ 30/05/2026 │ Venda Pedido #1234        │  150,00 │       │           │150,0│
│ 30/05/2026 │ Pagto Fornecedor X        │         │ 80,00 │           │ 70,0│
│ 31/05/2026 │ Boleto a vencer Cliente Y │         │       │   200,00  │ 70,0│
├──────────────────────────────────────────────────────────────────────────┤
│ TOTAL GERAL                            │  150,00 │ 80,00 │   200,00  │ 70,0│
└──────────────────────────────────────────────────────────────────────────┘
```

## Componentes da tela

1. **Barra de filtros (topo)**
   - `Select` "Caixa / Banco": lista todas as `contas_bancarias` ativas da unidade + opção fixa **"Caixa da Loja"** (= `movimentacoes_caixa` sem conta).
   - `Input` de busca para filtrar histórico por texto (client-side).
   - Dois `DatePicker` (data inicial / data final), padrão = primeiro e último dia do mês corrente.
   - Botão **Aplicar**.

2. **Card "Saldo Atual"** (canto direito, igual à imagem)
   - Mostra o nome da conta selecionada e o saldo até a data final do filtro.

3. **Tabela de movimentações** (corpo principal)
   - Colunas: **Data**, **Histórico**, **Entrada (R$)**, **Saída (R$)**, **A Receber (R$)**, **Saldo Atual (R$)**.
   - Primeira linha sempre **"SALDO INICIAL"** com saldo até o dia anterior à data inicial.
   - Linhas ordenadas por data ascendente; coluna **Saldo Atual** = saldo corrido (saldo_inicial + Σ entradas − Σ saídas até a linha). "A Receber" **não** entra no saldo corrente (é projeção).
   - Última linha **TOTAL GERAL** somando Entradas / Saídas / A Receber do período.
   - Tipografia tabular (`font-variant-numeric: tabular-nums`), zebra rows, valores negativos em `text-destructive`.

4. **Botão "Nova Movimentação"** mantido (reaproveita o Dialog atual).

## Fonte de dados por seleção

- **Conta bancária selecionada (UUID)**: 
  - Lançados: `movimentacoes_bancarias` filtrando `conta_bancaria_id` + `data` no intervalo.
  - Saldo inicial: soma de `saldo_inicial` da conta + movimentações **anteriores** à data inicial.
  - A Receber: `contas_receber` com `status='pendente'` e `vencimento` dentro do intervalo, somente quando uma forma de pagamento ligada à conta existir — para a v1, listar A Receber só quando "Caixa da Loja" estiver selecionado **ou** "Todas".
- **"Caixa da Loja"**: `movimentacoes_caixa` (`unidade_id` atual, `status='aprovada'`) + `contas_receber` pendentes no intervalo.
- **"Todas as contas"** (opção extra): união de ambas, sem coluna saldo corrente confiável → nesta opção, ocultar coluna Saldo Atual e mostrar apenas totais.

## Implementação técnica (resumo)

- Reescrever `src/pages/financeiro/FluxoCaixa.tsx` mantendo o `embedded` prop e o Dialog "Nova Movimentação".
- Novo hook local `useExtratoConta(contaId, dataIni, dataFim, unidadeId)` que retorna `{ saldoInicial, linhas[], totais }`.
- Usar `useQuery` (TanStack) com `queryKey` parametrizado para cache automático.
- Componente de tabela usando `Table` do shadcn (`@/components/ui/table`).
- Datas no padrão BR via `date-fns/format` e `getBrasiliaDate()`.
- Sem alterações em banco, edge functions, rotas ou outras telas.

## Arquivos afetados

- `src/pages/financeiro/FluxoCaixa.tsx` — reescrita completa do conteúdo da página.

## Fora de escopo

- Edição inline de lançamentos, impressão/exportação PDF, conciliação bancária, gráfico (removido — a tela vira extrato puro).

# R.O. — Resultado Operacional (mensal, por unidade)

Nova página que replica a planilha "R.O. Central Gás" com o mesmo layout de blocos, exportação Excel fiel e drill-down por linha.

## 1. Rota e menu

- Rota nova: `/operacional/ro` → `src/pages/operacional/ResultadoOperacional.tsx`
- Item novo no menu **Operacional › R.O. (Resultado Operacional)**
- Cabeçalho premium (mesmo padrão do Relatório Gerencial): título, seletor de **mês/ano**, seletor de **unidade**, seletor de **representante** (opcional), botão **Exportar .xlsx**.

## 2. Layout — 4 blocos como na planilha

```text
┌──────────────────────────┬─────────────────────────────────────┬────────────────────────┐
│ 1) CUSTOS / DESPESAS     │ 2) VENDAS POR CANAL / PRODUTO       │ 4) ENTRADAS / SAÍDAS   │
│  Aluguel                 │ Canal | Qtd P13 | P.Venda | Total  │ Dinheiro               │
│  Água/Luz/Telefone       │ P.Compra | MC R$ | Tonelagem       │ Cheque (Pré + Vista)   │
│  Pró-Labore              │ ── P13 Venda Direta                 │ Cheque Devolvido       │
│  Contador                │ ── Portaria                         │ Cartão                 │
│  Diárias/Limpeza         │ ── P05                              │ Boletos                │
│  Refeição                │ ── VAZIO                            │ Vale Ultragaz P13/P45  │
│  Impostos (Lucro Real,   │ ── P13 Disk                         │ Fernando ABM Gas       │
│    Salário, Social)      │ ── P13 Comércio                     │                        │
│  Salários                │ ── Whats/App                        │ SAÍDAS                 │
│  Manut./Veículos/Pneus   │ ── P13 PV                           │ INVESTIMENTOS          │
│  Combustível             │ ── P20 Ind.                         │                        │
│  Depreciação Veicular    │ ── P45 Ind.                         │ SALDOS                 │
│  Monitoramento           │ ── Água                             │  Estoque P05/P13/P20/  │
│  Pedágio/Detran          │ ── VZ Água + Registro               │    P45/Água (valorizado)│
│  Aluguel Maquininhas     │ TOTAL                               │  Uniprime / B.Brasil / │
│  Divulgação              │                                     │    Azul Gás / Santander│
│  Cartão de Crédito       │ 3) CONSOLIDADO                      │  Cartão / Pendências   │
│  Sistema                 │  Receita Bruta                      │                        │
│  Transporte              │  Custo Mat. Prima                   │                        │
│  Diversos                │  Lucro Bruto                        │                        │
│  ─────────────────       │  Custo / Despesa (do bloco 1)       │                        │
│  TOTAL DESPESAS          │  Lucro Líquido                      │                        │
│                          │  Nota Crédito                       │                        │
│                          │  RESULTADO                          │                        │
│                          │                                     │                        │
│                          │  Share por canal (VD/Disk/Com/PV/Ind)│                        │
│                          │  Ponto de Equilíbrio                │                        │
└──────────────────────────┴─────────────────────────────────────┴────────────────────────┘
```

No mobile os 3 blocos empilham (accordion), com o Consolidado sempre visível no topo como `FinancialHeroCard`.

## 3. Origem dos dados

### Bloco 2 — Vendas por canal/produto
- Fonte: `pedidos` + `pedido_itens` do mês/unidade, com `status IN ('finalizado','entregue','concluido','pago')`.
- Agrupa por `pedidos.canal_venda` (usando o campo já existente) cruzado com `produtos.nome` normalizado (P13, P20, P45, P05, Água, Vazio).
- Normalizações necessárias para casar com a planilha:
  - `Disk/Telefone` → **P13 Disk**
  - `Entregador` / `Ponto de Venda` → **P13 PV**
  - `WhatsApp` / `site` → **Whats/App**
  - `Portaria` / `portaria` → **Portaria**
  - `Comercio` → **P13 Comércio**
  - `Prefeitura` / clientes industriais (P20/P45) → **P20 Ind.** / **P45 Ind.**
  - Demais canais nomeados (Alfa Gás, Amigão, Zavagli, Foguinho, Molinis, Vale Ultragaz…) → agrupados em **P13 Venda Direta** (revenda), com detalhamento no drill-down.
- Colunas calculadas: `Preço Venda médio = Total / Qtd`, `Preço Compra` do `produtos.preco_custo` (média corrente já mantida pela trigger `recalcular_preco_custo_produto`), `MC R$ = Total − (Qtd × PreçoCompra)`, `Tonelagem = Qtd × peso_kg`.

### Bloco 1 — Custos/Despesas
- União das 3 fontes já usadas no Relatório Gerencial:
  - `contas_pagar` pagas no mês
  - `movimentacoes_caixa` de saída no mês
  - `despesas_contabeis` do mês
- Mapeamento categoria → linha do R.O. via `categorias_despesa` (nome + código). Novas categorias caem em **Diversos**.
- Uma linha "Salários" soma folhas + encargos vindos de `folhas_pagamento`/`folha_pagamento_itens` quando existirem no mês.

### Bloco 3 — Consolidado
- `Receita Bruta` = soma do bloco 2
- `Custo MP` = soma (Qtd × PreçoCompra) do bloco 2
- `Lucro Bruto` = Receita − Custo MP
- `Custo/Despesa` = total do bloco 1
- `Lucro Líquido` = Lucro Bruto − Custo/Despesa
- `Nota Crédito` = campo manual editável (persistido em nova tabela `ro_ajustes_mensais`, ver §4)
- Share por canal = participação % da MC R$ de cada agrupamento
- Ponto de Equilíbrio (R$) = `Custo/Despesa ÷ (MC média % da Receita)`

### Bloco 4 — Entradas / Saídas / Saldos
- **Dinheiro**: entradas de `movimentacoes_caixa` no mês (tipo entrada, forma dinheiro).
- **Cheque Pré + Vista** e **Cheque Devolvido**: `cheques` do mês por status.
- **Cartão**: soma de `contas_receber` liquidadas via operadora de cartão no mês.
- **Boletos**: `boletos_emitidos` liquidados no mês.
- **Vale Ultragaz P13/P45**: `vale_gas` do mês por produto.
- **Saldos bancários** (fim do mês): último snapshot de `contas_bancarias.saldo_atual` filtrado por unidade (Uniprime, B. Brasil, Azul Gás/Inter, Santander).
- **Estoque valorizado** (fim do mês): `SUM(quantidade × preco_custo)` por produto P05/P13/P20/P45/Água a partir da última posição de `estoque_dia`/`movimentacoes_estoque`.
- **Saídas / Investimentos / Pendências / Fernando ABM Gas**: linhas manuais editáveis (persistidas em `ro_ajustes_mensais`).

## 4. Persistência de ajustes manuais

Nova tabela `ro_ajustes_mensais` (via migração):

- Colunas de domínio: `empresa_id`, `unidade_id`, `ano`, `mes`, `representante`, `chave` (ex.: `nota_credito`, `saidas`, `investimentos`, `pendencias`, `fernando_abm`, `preco_compra_ref_p13` etc.), `valor`, `observacao`.
- Índice único em (`unidade_id`, `ano`, `mes`, `chave`).
- GRANTs para `authenticated` e `service_role`; RLS por `unidade_id` do usuário e `has_role('gestor')`.

## 5. Drill-down

Clique em qualquer linha do bloco 1 ou 2 abre um `Dialog` listando os documentos que somam aquele valor (pedidos, contas a pagar, movimentações de caixa), reusando o padrão já implementado no Relatório Gerencial.

## 6. Exportação Excel fiel

Nova Edge Function `gerar-ro-excel`:

- Recebe `{ unidade_id, ano, mes }`, valida com Zod, checa auth via JWT em código.
- Monta um `.xlsx` com **12 abas nomeadas Janeiro…Dezembro** (mesmo padrão do arquivo), preenchendo só o mês solicitado (ou todos os meses do ano se pedido).
- Layout fiel: mesmos títulos, colunas, fórmulas de Receita/Custo/MC/Ponto de Equilíbrio, formatação de moeda BRL, larguras de coluna.
- Retorna base64 → download no cliente como `RO_<Unidade>_<Ano>.xlsx`.
- Lib: `xlsx-populate` via `npm:xlsx-populate` no Deno (ou `xlsx`/`sheetjs` já usado em outras funções — reaproveitar a que existir).

## 7. Ordem de implementação

1. Migração `ro_ajustes_mensais` (tabela + GRANTs + RLS + trigger `updated_at`).
2. Hook `useRoData(unidadeId, ano, mes)` consolidando vendas + despesas + fluxo lateral (uma query por bloco, em paralelo).
3. Página `ResultadoOperacional.tsx` com os 4 blocos, edição inline dos campos manuais e drill-down.
4. Rota + item de menu.
5. Edge Function `gerar-ro-excel` + botão Exportar.
6. Testes rápidos: mês corrente Forte Gás bate com o dashboard financeiro; abrir XLSX no Excel para conferir layout.

## Detalhes técnicos

- Reutiliza `PremiumKpiCard`, `SectionCard`, `FinancialHeroCard`, `ChartTooltip` e `formatMoney` já padronizados.
- Todas as queries filtram por `unidade_id` do contexto (`useEmpresa`) — sem cross-tenant.
- Cálculo de MC e Share fica no cliente com `useMemo` para evitar re-render.
- Peso por produto vem de `produtos.peso_kg`; se ausente, assume tabela padrão (P13=13, P20=20, P45=45, P05=5, Água=0).
- A Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` só para leitura consolidada, com validação prévia de que o `user_id` do JWT tem acesso à `unidade_id` pedida.

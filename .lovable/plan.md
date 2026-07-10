## Diagnóstico

Vendas em cartão crédito, débito e PIX Maquininha já são gravadas corretamente em `contas_receber` (89 registros da Forte Gás) pelo `paymentRoutingService` — com `operadora_id`, `taxa_percentual`, `valor_taxa`, `valor_liquido`, `conta_bancaria_destino_id` e `vencimento` calculado a partir do prazo da operadora.

O problema é que as telas do **Portal da Operadora de Cartão** (Vendas / Recebíveis / métricas do cabeçalho) e o dashboard de **Gestão de Cartões** leem da tabela `conferencia_cartao`, que só é populada em fluxos específicos (Gás do Povo e PagBank) — por isso aparecem vazias, apesar do dinheiro existir em Contas a Receber.

`conferencia_cartao` deve continuar existindo apenas como ferramenta de conferência manual (extrato x sistema).

## Padronização (fonte única = `contas_receber`)

Refatorar as consultas das telas de operadora para lerem de `contas_receber` filtrando por `operadora_id`, `forma_pagamento IN ('cartao_credito','cartao_debito','pix_maquininha')` e `unidade_id`.

### Arquivos alterados (somente frontend, sem migrations, sem mudar `paymentRoutingService`)

1. **`src/components/financeiro/operadora-detalhe/VendasOperadoraTab.tsx`**
   - Trocar `from("conferencia_cartao")` por `from("contas_receber")` filtrando por operadora, período (`created_at`/`data_venda` derivado), unidade.
   - Mapear colunas: `data_venda` ← `created_at`, `valor_bruto` ← `valor`, `valor_liquido_recebido` ← `valor_liquido` quando `status='recebido'`, senão `valor_liquido_esperado`.
   - `tipo` derivado de `forma_pagamento` (credito/debito/pix_maq).

2. **`src/components/financeiro/operadora-detalhe/RecebiveisOperadoraTab.tsx`**
   - Ler `contas_receber` da mesma forma. Separar `recebido` (`status='recebido'` com `data_recebimento`) e `a receber` (`status='pendente'` com `vencimento`).

3. **`src/components/financeiro/operadora-detalhe/RelatoriosOperadoraTab.tsx`**
   - Trocar fonte para `contas_receber` para gráficos/relatórios do mês.

4. **`src/pages/financeiro/OperadoraCartaoDetalhe.tsx`** (métricas do cabeçalho)
   - Métrica "Vendas do mês / A receber / Recebido" passa a somar `contas_receber` da operadora no período.

5. **`src/pages/financeiro/GestaoCartoes.tsx`** (grid de operadoras)
   - Métrica por operadora (a receber / recebido) passa a somar `contas_receber` por `operadora_id` — remove o mapeamento indireto via `pagamentos_cartao.maquininha_serial → terminais_cartao`.

### Fora do escopo (não mexer)

- `paymentRoutingService.ts`: já grava certo, mantido.
- `ConferenciaCartao.tsx`: continua sendo o formulário manual de conferência (extrato x sistema); segue lendo/escrevendo `conferencia_cartao`.
- `pagamentos_cartao` (PagBank/PlugPag): fluxo próprio, não interfere.
- Schema do banco, RLS e migrations: nenhuma alteração.

### Backfill

Não é necessário — os dados já existem em `contas_receber`. As telas passarão a mostrá-los imediatamente após o deploy.

### Validação

Após implantar, o Portal da operadora de cartão deve exibir as 54 vendas de crédito, 29 de débito e 6 de PIX-maquininha da Forte Gás separadas por operadora, batendo com Contas a Receber e com o card "Recebíveis por Banco" do Dashboard Financeiro.

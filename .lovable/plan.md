## Objetivo

Adicionar pagamento profissional no cadastro de compras (Estoque › Compras › Nova Compra), com escolha de origem do dinheiro (banco / caixa da loja), e remover o campo "Previsão Entrega".

## Mudanças na tela "Registrar Nova Compra"

### Remover
- Campo **Previsão Entrega** (`data_prevista`) — inputs, label e envio ao banco.

### Nova seção "Pagamento"
Substitui o campo isolado "Data Pagamento" por um bloco completo:

1. **Situação do pagamento** (radio/segmented):
   - `À vista` (pago no ato) — libera bloco de origem do pagamento
   - `A prazo` (gerar conta a pagar) — mantém `Data de vencimento` e cria em `contas_pagar` como hoje
   - `Parcelado` (2ª fase, opcional) — várias parcelas em `contas_pagar`

2. **Forma de pagamento** (select) — quando "À vista":
   - Dinheiro
   - PIX
   - Transferência / TED
   - Cartão de débito
   - Cartão de crédito
   - Boleto pago
   - Cheque

3. **Origem do dinheiro** (condicional à forma):
   - Se **Dinheiro** → select `Caixa` (usa a sessão de caixa aberta da unidade — `caixa_sessoes` ativa; se não houver, avisa e bloqueia).
   - Se **PIX / TED / Débito / Boleto** → select `Conta bancária` (lista de `contas_bancarias` ativas da unidade, mostrando banco + saldo atual).
   - Se **Cartão de crédito** → select conta + campo `Parcelas` (gera lançamento em `contas_pagar` na fatura).
   - Se **Cheque** → select conta bancária + nº cheque + data bom-para (registra em `cheques` como "emitido").

4. **Data do pagamento** — default = data da compra.

5. Painel resumo mostra: valor, forma, origem e saldo restante após lançamento.

### Layout
O dialog atual passa a ter 3 abas ou 3 blocos colapsáveis para não ficar denso:
`Fornecedor & NF` · `Itens` · `Pagamento`.
Mantém importar XML / foto NF no topo.

## Efeitos financeiros (ao salvar)

Dependendo da forma escolhida, além de inserir em `compras`:

- **Dinheiro (à vista)** → `movimentacoes_caixa` (tipo `saida`, categoria `compras`, vínculo `compra_id`), reduz saldo do caixa. Marca `compras.pago = true`, `data_pagamento` preenchida.
- **PIX / TED / Débito / Boleto pago (à vista)** → `movimentacoes_bancarias` (tipo `saida`, `conta_bancaria_id`, vínculo `compra_id`), atualiza `saldo_atual` da conta. Marca `pago = true`.
- **Cheque** → `cheques` (emitido, `conta_bancaria_id`, `bom_para`) + `contas_pagar` com vencimento igual ao bom-para.
- **Cartão de crédito** → `contas_pagar` (uma por parcela, categoria `compras`, `conta_bancaria_id` da fatura).
- **A prazo (sem forma)** → mantém comportamento atual: cria `contas_pagar` com `vencimento = data_pagamento`.

Reversão: no `handleDeleteCompra`, apagar também as `movimentacoes_caixa` / `movimentacoes_bancarias` / `contas_pagar` / `cheques` vinculadas àquela compra (por `compra_id`).

## Persistência

Nova migração adiciona à tabela `compras`:

- `forma_pagamento text` (dinheiro | pix | ted | debito | credito | boleto | cheque | a_prazo | parcelado)
- `origem_pagamento text` (caixa | banco | fatura)
- `conta_bancaria_id uuid` → `contas_bancarias(id)` (nullable)
- `caixa_sessao_id uuid` → `caixa_sessoes(id)` (nullable)
- `parcelas integer default 1`
- Índices em `conta_bancaria_id` e `caixa_sessao_id`.

Vínculo reverso já existente:
- `movimentacoes_caixa.compra_id` e `movimentacoes_bancarias.compra_id` — criar coluna se não existir.
- `contas_pagar.compra_id` — criar coluna se não existir (para reversão).

RLS: manter policies existentes de `compras`; novas colunas herdam. GRANTs já existem nas tabelas afetadas.

## Arquivos a alterar

- `src/pages/estoque/Compras.tsx` — remover `data_prevista`, adicionar seção Pagamento, novo estado `pagamento`, novo `handleSave` chamando helper de rota financeira, ajuste do `handleDeleteCompra` para limpar movimentações.
- **Novo** `src/services/compraFinanceiroService.ts` — funções `registrarPagamentoCompra(compraId, dadosPagamento)` e `reverterPagamentoCompra(compraId)`, centralizando a criação/remoção de `movimentacoes_caixa`, `movimentacoes_bancarias`, `contas_pagar` e `cheques`.
- **Nova migração** — colunas em `compras` + colunas `compra_id` faltantes.

## Fora de escopo

- Não altera a listagem de compras nem KPIs (só o card `Total em Compras` continua igual).
- Não muda o fluxo de importação XML — apenas herda os novos campos com defaults (`a_prazo` se `data_pagamento` foi preenchida, senão vazio para o usuário decidir).

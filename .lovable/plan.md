
## Problema

1. Em **Financeiro › Contas a Pagar**, ao confirmar pagamento de uma conta/boleto, o sistema apenas marca como paga e grava a forma no texto de observações — **não debita** o Caixa da Loja nem a Conta Bancária. Resultado: saldos ficam errados.
2. Na **Caixa do Dia › Tesouraria**, as contas bancárias aparecem sem indicar se estão "conectadas" (vinculadas/em uso) com o caixa do dia.

## Solução

### 1. Diálogo "Pagar Conta" passa a perguntar a origem do dinheiro

No modal de pagamento (`ContasPagar.tsx` + `useContasPagar.ts`), cada linha de **forma de pagamento** ganha um seletor extra **"Sair de"**:

- Se a forma for **Dinheiro** → seletor lista o **Caixa da Loja** (unidade atual).
- Se for **PIX / Transferência / Débito / Boleto / Cheque** → seletor lista as **Contas Bancárias ativas** da unidade.
- Se for **Cartão de Crédito** → seletor lista os cartões cadastrados (gera `contas_pagar` da fatura, sem mexer em saldo agora).

Validação: campo "Sair de" obrigatório antes de confirmar.

### 2. `handlePagar` registra as movimentações reais

Ao confirmar:

- **Dinheiro** → cria `movimentacoes_caixa` (tipo `saida`, categoria "Pagamento de Conta", `unidade_id`, descrição com fornecedor e nº doc). O saldo do Caixa do Dia já é calculado a partir dessa tabela.
- **Banco/PIX/Boleto/etc.** → cria `movimentacoes_bancarias` (tipo `saida`, `conta_bancaria_id`, `valor`, descrição, `origem='contas_pagar'`, `referencia_id=<id da conta>`) e debita `contas_bancarias.saldo_atual` (na mesma transação, via RPC para evitar inconsistência).
- Em pagamentos parciais e em lote, segue o mesmo princípio (uma movimentação por linha de forma).
- Grava em `contas_pagar`: `data_pagamento`, `conta_bancaria_id` (quando aplicável) e `forma_pagamento` estruturada além das observações.

### 3. Caixa do Dia › Tesouraria mostra status de conexão

No card **Contas Bancárias** da aba Tesouraria (`CaixaDia.tsx`):

- Para cada conta, adicionar badge **"Conectada"** (verde) quando houver pelo menos 1 movimentação no dia OU quando a conta estiver marcada como ativa e vinculada à unidade.
- Mostrar também, abaixo do nome, as últimas movimentações do dia daquela conta (entrada/saída) com origem (ex.: "Pagamento Enel – R$ 250,00").
- Botão "Ver extrato" abre a página `ContasBancarias` filtrada pela conta.

### Detalhes técnicos

- **Tabelas envolvidas**: `contas_pagar`, `contas_bancarias`, `movimentacoes_caixa`, `movimentacoes_bancarias`.
- **Migração**: adicionar coluna `conta_bancaria_id uuid` em `contas_pagar` (FK para `contas_bancarias`, nullable) caso ainda não exista; e `forma_pagamento text`.
- **RPC** `pagar_conta_pagar(p_conta_id, p_pagamentos jsonb)` em SECURITY DEFINER: recebe lista `[{forma, valor, origem_id, origem_tipo}]`, cria as movimentações, atualiza saldos e marca a conta como paga/parcial em uma única transação. Isola por `empresa_id` via `get_user_empresa_id`.
- **Frontend**: refatorar `pagarForm` para `{forma, valor, origemTipo: 'caixa'|'banco'|'cartao', origemId}`. Carregar listas via hooks já existentes (`useContasBancarias`).
- **Tesouraria**: enriquecer `fetchTesouraria` para trazer `movimentacoes_bancarias` do dia agrupadas por `conta_bancaria_id` e calcular status "Conectada".

### Critérios de aceite

- Pagar uma conta de R$ 100 em **Dinheiro** reduz o Saldo do Caixa do Dia em R$ 100 e gera linha em "Movimentações".
- Pagar uma conta de R$ 500 em **PIX** pela conta "Itaú PJ" reduz `saldo_atual` da Itaú em R$ 500 e aparece no extrato bancário.
- Pagamento parcial e em lote seguem a mesma regra (cada linha de forma vira uma movimentação).
- Aba Tesouraria mostra badge **Conectada** + últimas movimentações do dia por conta bancária.

### Fora de escopo

- Conciliação automática com extrato OFX/Open Finance.
- Estorno de pagamento (será tratado em iteração futura).

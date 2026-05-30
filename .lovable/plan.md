# Vale Gás × Contas a Receber — Pré-pago vs Consignado

## Entendimento

Há **dois tipos** de parceiro Vale Gás, e cada um gera Contas a Receber em momento diferente:

### 1. Parceiro Pré-pago (ex.: Amigão 2)
- Compra o lote inteiro **antecipado**.
- Na **emissão do lote** já se gera 1 título em Contas a Receber para o parceiro (valor = lote inteiro, vencimento configurável, default hoje + 10 dias).
- Quando o cliente final usa o vale na venda, **não** gera mais nada financeiro — só consome o voucher.
- Esse é o fluxo já implementado na rodada anterior.

### 2. Parceiro Consignado
- Recebe os vales **sem pagar na hora**.
- Vende para clientes ao longo do mês; o cliente usa o vale, sistema vai marcando `utilizado` e controlando numeração.
- Na **quinzena / fechamento de mês**, roda-se o **Acerto** (tela `ValeGasAcerto.tsx` que já existe): soma os vales utilizados não acertados, gera 1 registro de acerto.
- **Nesse momento** (geração do acerto) é que deve nascer o título em Contas a Receber para o parceiro consignado — boleto / pix / cheque / dinheiro.

## Problema atual

- **Emissão de lote** hoje cria Contas a Receber **para todos** os parceiros (após a última correção). Para consignado isso está errado — o título do consignado só existe quando há acerto.
- **Acerto** hoje só registra `status_pagamento` no próprio acerto, mas **não** cria título em Contas a Receber, então o consignado nunca aparece no fluxo financeiro padrão.

## Mudanças

### 1. `src/pages/financeiro/ValeGasEmissao.tsx`
- Ler `parceiro.tipo` do parceiro selecionado.
- **Se `tipo === "pre_pago"` (ou equivalente)**: manter comportamento atual — cria `contas_receber` (`origem = "vale_gas_lote"`, status `pendente`, vencimento default hoje + 10 dias, editável).
- **Se `tipo === "consignado"`**: **não** criar `contas_receber` na emissão. Esconder/desabilitar o campo "Vencimento do título" e mostrar aviso: *"Parceiro consignado — título será gerado no acerto."*
- Reverter lote se a inserção do título falhar (igual hoje), só quando aplicável.

### 2. `src/pages/financeiro/ValeGasAcerto.tsx` + `ValeGasContext.gerarAcerto`
- Após criar o registro de acerto com sucesso, inserir um título em `contas_receber`:
  - `cliente` = nome do parceiro, `vale_gas_parceiro_id` preenchido
  - `descricao` = `"Acerto Vale Gás - {parceiro} - {qtd} vales ({periodo})"`
  - `valor` = `acerto.valor_total`
  - `vencimento` = data escolhida pelo usuário no dialog (novo campo: default hoje + 10 dias)
  - `status = "pendente"`, `forma_pagamento = "vale_gas"`, `origem = "vale_gas_acerto"`, `vale_gas_acerto_id` (se a coluna existir; caso contrário gravar o id no campo `referencia` ou similar)
  - `unidade_id` da unidade atual
- Adicionar campo **"Vencimento do acerto"** no dialog `Gerar Novo Acerto`.
- Em `registrarPagamentoAcerto`: além de marcar o acerto como pago, atualizar o respectivo `contas_receber` para `recebida` (data_pagamento, forma_pagamento) — manter os dois lados sincronizados.

### 3. `src/services/paymentRoutingService.ts`
- Já corrigido na rodada anterior (case `vale_gas` não cria mais título na venda). Sem alterações.

### 4. Documentação (`.lovable/plan.md`)
- Atualizar com a regra dos dois tipos.

## Fora de escopo

- Estrutura de tabelas, RLS, App.tsx, rotas e providers.
- `ContasReceber.tsx` (já mostra normalmente por `forma_pagamento = "vale_gas"`).
- Boleto Asaas a partir do título do acerto (pode ser pedido depois — o título nasce `pendente` e o fluxo de boleto existente já consegue agir sobre ele).

## Perguntas

1. **Vencimento padrão do título do acerto** (consignado): hoje + 10 dias, igual ao lote pré-pago — confirma?
2. O campo `tipo` em `vale_gas_parceiros` usa exatamente os valores `"pre_pago"` e `"consignado"` (vi `consignado` em `ValeGasAcerto.tsx`)? Se houver outros valores em uso, me diga para tratar corretamente.

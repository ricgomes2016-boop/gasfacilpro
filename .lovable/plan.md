# Vale Gás × Contas a Receber — Pré-pago vs Consignado (implementado)

## Regra atual

- **Parceiro pré-pago**: na emissão do lote em `ValeGasEmissao.tsx`, cria 1 `contas_receber` com `origem = "vale_gas_lote"`, `forma_pagamento = "vale_gas"`, vencimento configurável (default hoje + 10 dias).
- **Parceiro consignado / empenho**: NÃO cria conta a receber na emissão. O card no formulário avisa "Parceiro Consignado — título nasce no Acerto".
- **Acerto (`ValeGasAcerto.tsx`)**: ao gerar acerto cria 1 `contas_receber` com `origem = "vale_gas_acerto"`, marcador `[acerto:<uuid>]` em `observacoes` (não há coluna `vale_gas_acerto_id`). Vencimento configurável no dialog (default hoje + 10 dias).
- **Pagamento do acerto**: `registrarPagamentoAcerto` atualiza o acerto e a `contas_receber` correspondente (busca por `origem = "vale_gas_acerto"` + marcador) para `recebida`.
- **Venda com Vale Gás (`paymentRoutingService.ts`)**: não cria `contas_receber` — só consome o voucher.

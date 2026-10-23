# Conferência: separar "venda do dia anterior" e "estoque atual do dia"

## Exemplo Usagas (data selecionada 23/10, início do dia)
- Contagem P13 em 23/10 (início): **1099** → fecha a venda de **22/10**.
- Entrada P13 em 23/10: **187** → pertence a **23/10**, não à venda de 22/10.
- Total atual de 23/10: 1099 + 187 = **1286**.
- Venda de 22/10 = saldo de 22/10 + entradas de 22/10 − transferências de 22/10 − 1099.

## O que muda na tela
1. Entradas e transferências passam a ser gravadas na **data selecionada** (23/10), e não no dia da venda apurada.
2. Novo card **"Estoque atual do dia 23/10"** por produto: contagem início + entradas − transferências de 23/10 (ex.: P13 1286).
3. Card **"Venda de 22/10"** continua usando apenas a movimentação de 22/10 e a contagem de 1099.
4. Rótulos claros em cada bloco: "Contagem 23/10 (início)", "Entrada 23/10", "Total atual 23/10", "Venda apurada 22/10".
5. Quando o momento for "final do dia", tudo fica no mesmo dia (sem mudança no comportamento atual).

## Detalhes técnicos
- Primeiro passo: confirmar em `ConferenciaEstoque.tsx` e na função `estoque-conferencia-portal` qual data hoje é usada para gravar/ler `estoque_conferencia_movimentos` (suspeita: `dataConferencia` = dia da venda).
- Movimentos gravados/lidos por `dataContagem`; a venda apurada lê movimentos de `dataVenda`.
- Nova função `calcularEstoqueAtual({contagem, entrada, transferencia})` em `conferenciaFluxo.ts` com teste 1099 + 187 = 1286, e teste de que 187 não altera a venda de 22/10.
- Sem alterar contagens já salvas.

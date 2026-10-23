# Conferência de Estoque — apuração da venda esperada por produto

## O que muda
Para cada loja e cada produto (P13, P20, P45, Água), a tela passa a mostrar o fluxo do dia, como na imagem:

1. **Saldo inicial**: a contagem de cheios do dia anterior, preenchida sozinha (sem digitar).
2. **Entrada (+)**: digitada à mão, por enquanto.
3. **Total inicial (=)**: saldo inicial + entrada, calculado.
4. **Cheios (contagem atual)**: o que já é digitado hoje.
5. **Transferência (-)**: botão "Transferir" abre uma janela para escolher a loja de destino e a quantidade. Ao confirmar, a janela fecha, a quantidade sai desta loja e **aparece como entrada na loja de destino** no mesmo dia.
6. **Venda esperada (=)**: saldo inicial + entrada − transferência − cheios.

Exemplo: 500 + 200 − 100 (VJ Gás) − 400 = **200 de venda esperada**.

Onde aparece:
- **Celular**: um quadro por produto com os 6 blocos, igual à imagem, com a venda esperada em destaque verde.
- **Computador**: na tabela, cada produto ganha as colunas Inicial, Entrada, Transf., Cheio, Vazio, Total e Venda; a linha de total geral soma tudo.
- Os cards do topo ganham "Venda esperada" por produto (ex.: 136 P13 · 2 P20 ...).

Entradas recebidas por transferência aparecem na loja destino com a origem indicada e não podem ser editadas ali (só apagadas na loja de origem).

## Detalhes técnicos
- Nova tabela `estoque_conferencia_movimentos` (data, unidade_id, empresa_id, produto_grupo, tipo `entrada_manual`|`transferencia`, quantidade, unidade_destino_id, criado_por), com GRANTs e RLS por unidades do usuário (origem ou destino).
- Saldo inicial = registros `cheio` de `estoque_conferencias` em `data - 1`.
- Entrada da loja = entradas manuais + transferências com destino nela.
- Cálculo isolado em `src/lib/estoque/conferenciaFluxo.ts` com testes do exemplo (500+200−100−400=200).
- Não altera o estoque real dos produtos nem `transferencias_estoque`; é só registro da conferência.

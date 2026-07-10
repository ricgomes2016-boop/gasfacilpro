## Objetivo
No passo de pagamento da Nova Venda, quando a forma "Gás do Povo" for selecionada, permitir incluir uma **taxa de entrega** adicional (paga em outra forma), já que o valor do Gás do Povo é fixo (R$ 101,08) e não cobre frete.

## Contexto atual
- `src/components/pdv/PDVPayment.tsx` já bloqueia Gás do Povo para exigir carrinho = 1× Gás P13 e valor fixo em `gasDoPovoValor`.
- Hoje, se houver taxa de entrega no pedido, o total fica acima de R$ 101,08 e o cliente/entregador não tem um fluxo claro para lançar a diferença.

## Mudanças (somente UI/estado local do modal de pagamento)

1. **Campo "Taxa de entrega"** no `PDVPayment` quando a forma selecionada for `gas_do_povo`:
   - Input numérico (R$), default 0,00.
   - Ao adicionar o pagamento Gás do Povo:
     - Lança 1 pagamento `gas_do_povo` no valor fixo `gasDoPovoValor` (mantém a validação atual).
     - Se `taxa_entrega > 0`, abre automaticamente a seleção da 2ª forma (Dinheiro/PIX/Cartão) com o valor da taxa já pré-preenchido, para o operador confirmar como a taxa foi recebida.
   - `info` do pagamento Gás do Povo passa a mostrar: `Programa Gás do Povo — R$ 101,08 (D+2) + Taxa entrega R$ X,XX`.

2. **Validação**:
   - Taxa de entrega é opcional (pode ser 0).
   - Se informada, obriga selecionar a forma de recebimento da taxa antes de finalizar.
   - Gás do Povo continua exigindo carrinho elegível (1× Gás P13).

3. **Sem mudanças em backend, tabelas, RLS ou schema** — os pagamentos já são um array e o sistema financeiro já sabe processar múltiplas formas por venda.

## Arquivos afetados
- `src/components/pdv/PDVPayment.tsx` (único arquivo alterado)

## Fora do escopo
- Não altero regras do programa Gás do Povo (valor fixo, D+2, elegibilidade).
- Não crio nova forma de pagamento nem coluna nova.
- Não mexo no fluxo do PDV/Entregador além do modal de pagamento.

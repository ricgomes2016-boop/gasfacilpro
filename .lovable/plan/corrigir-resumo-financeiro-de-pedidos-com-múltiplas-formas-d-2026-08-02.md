# Corrigir Resumo Financeiro de Pedidos com múltiplas formas de pagamento

## Problema confirmado

Consultei os pedidos reais com mais de uma forma de pagamento. O resumo abaixo do relatório erra em três situações:

1. **Parte em dinheiro some.** O resumo usa `contas_receber` como fonte única quando existe qualquer título. Como dinheiro vai para o caixa (não gera título), ele é ignorado.
   - Pedido #538: total R$ 110 → resumo mostra só R$ 100 de PIX-maquininha; os R$ 10 em dinheiro somem.
   - Pedido #420: total R$ 294 → mostra R$ 70 PIX-maquininha + R$ 124 crédito; os R$ 100 em dinheiro somem.
2. **Divisão em partes iguais quando não há títulos.** Pedido #337 (R$ 315, "dinheiro, pix") é dividido em 157,50 / 157,50, mas o real é R$ 105 em dinheiro e R$ 210 em PIX.
3. **Rótulos quebrados.** Alguns pedidos gravam a forma como `"dinheiro R$100.00, pix R$470.00 [cta:...]"`. O parser atual não remove o valor nem o sufixo técnico, criando categorias como "dinheiro r$100.00" separadas de "dinheiro".

## O que será feito

Reescrever apenas o cálculo do breakdown financeiro em `src/pages/vendas/Pedidos.tsx` (nada de mudança em banco ou em outras telas):

1. **Parser robusto da string de pagamento**: extrair, para cada trecho, o nome da forma limpa (sem `multiplo:`, sem `R$ x`, sem `[op:...|cta:...]`) e o valor explícito quando houver.
2. **Composição por pedido**, nesta ordem de confiança:
   - valor explícito na string (`dinheiro R$100.00`) quando presente;
   - títulos de `contas_receber` para as formas que os possuem;
   - movimentações de caixa do pedido para a parcela em dinheiro;
   - rateio proporcional apenas para as formas que continuarem sem valor, usando o residual `valor_total − já atribuído`.
3. **Fechamento com o total do pedido**: se a soma das parcelas divergir do `valor_total`, a diferença é aplicada à forma sem valor definido (ou proporcionalmente), garantindo que o somatório do resumo bata com o total de vendas exibido.
4. **Drill-down coerente**: o detalhamento ao clicar em cada forma passa a exibir o valor real daquela parcela e a marcação de pedido multi-pagamento.

## Detalhes técnicos

- Arquivo: `src/pages/vendas/Pedidos.tsx`, bloco `useMemo` de `pagamentoContadores` / `pagamentoDetalhes` (linhas ~770-815) e a query `pedidos-recebiveis-breakdown` (~750).
- A query passa a buscar também `movimentacoes_caixa` (tipo entrada, `pedido_id` nos ids ativos) para recuperar a parcela em dinheiro.
- Normalização de formas centralizada numa função utilitária local, reutilizada pelos rótulos existentes (`formaLabel`).
- Pedidos cancelados continuam fora do resumo.

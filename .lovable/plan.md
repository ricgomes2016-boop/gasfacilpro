# DRE clara e sem interpretação errada (Gestão Operacional)

## O que está errado hoje (verificado nos dados da Forte Gás)

- **Custo não corresponde ao que foi vendido.** O custo do mês é a soma das compras do período (R$ 5.739,88 neste mês), não o custo dos botijões efetivamente vendidos.
- **Despesas contadas em dobro.** As saídas bancárias do mês somam R$ 19.544, e praticamente todas são "Pagto ... — Compra NF ...", ou seja, pagamento de compras que já entraram como custo. Isso infla as despesas e destrói o lucro.
- **Compras entrando como despesa por outra porta.** Um lançamento de caixa com categoria "compras" (R$ 8) e um "Venda de mercadorias" (R$ 60,32) caem em "Despesas Operacionais".
- **Contas a pagar por vencimento.** Contas com vencimento no mês entram no mês mesmo quando se referem a outro período; e o pagamento delas volta a aparecer como saída bancária.
- **Dedução de 5% inventada.** A receita líquida é reduzida por um percentual fixo que não vem de nenhum imposto real.
- **Nada explica de onde vem cada número.** Não há como clicar e ver o que compõe a linha.

## Como vai ficar

Uma DRE com regra única e explícita, em regime de competência:

```text
Receita Bruta de Vendas          (pedidos entregues/finalizados, cancelados fora)
(-) Impostos e deduções          (apenas impostos realmente lançados)
= Receita Líquida
(-) CMV — custo dos produtos vendidos   (qtd vendida x custo médio do produto)
= Lucro Bruto
(-) Despesas com Pessoal
(-) Despesas Operacionais
(-) Despesas Administrativas
= Resultado Operacional
(-) Despesas Financeiras
= Resultado Líquido
```

Regras que passam a valer:

1. **Receita**: só pedidos com status entregue/finalizado/pago_cartão, pela data de entrega. Cancelados nunca entram (já é assim, fica explícito na tela).
2. **CMV**: quantidade vendida de cada produto no mês x preço de custo do produto. Vendeu 431 P13 → CMV = 431 x custo do P13. Compras do mês deixam de virar custo; viram estoque.
3. **Despesas**: cada gasto entra **uma única vez**. Pagamentos de compras/contas a pagar (saídas bancárias com categoria `contas_pagar` ou descrição "Pagto ... Compra") são liquidação financeira, não despesa — ficam fora. Lançamentos de caixa/contas a pagar com categoria de compra/mercadoria também ficam fora (já estão no estoque/CMV). Transferências internas continuam fora.
4. **Impostos**: só o que estiver lançado como imposto/tributo em despesas. Sem percentual fixo.
5. **Período**: tudo pela data do fato (entrega, venda, data da despesa), não pela data do pagamento.

## Clareza na tela

- Cabeçalho do mês mostrando: **431 P13 vendidos · custo unitário R$ X · CMV R$ Y · lucro R$ Z**, com quantidade vendida por produto.
- Cada linha da DRE vira clicável e abre um detalhamento com os lançamentos que a compõem (data, descrição, valor), para conferência.
- Barra de avisos quando algo pode distorcer o número: produto vendido sem preço de custo cadastrado, despesa sem categoria, ou compras não pagas do mês (informativo, fora do resultado).
- Legenda fixa no rodapé com as regras acima em uma frase cada, para não haver dupla interpretação.
- Exportação PDF/Excel refletindo exatamente a tela.

## Detalhes técnicos

- Arquivo principal: `src/pages/operacional/DRE.tsx`.
- Cálculo extraído para um módulo novo `src/lib/financeiro/dreCalculo.ts` (mesma fonte usada por DRE, Relatório Gerencial e Análise de Resultados, evitando números divergentes entre telas).
- CMV: agregação de `pedido_itens` x `produtos.preco_custo` dos pedidos que compõem a receita.
- Despesas: união de `movimentacoes_caixa`, `movimentacoes_bancarias`, `contas_pagar` e `despesas_contabeis`, com deduplicação por origem (exclui saídas que quitam contas a pagar/compras) e classificação por categoria.
- Novo componente `DRELinhaDetalheDialog` para o drill-down por linha.
- Nenhuma alteração de banco de dados necessária.

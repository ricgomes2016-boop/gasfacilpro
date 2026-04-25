Plano de ajuste da tela /vendas/nova

1. Manter apenas os cards da etapa selecionada
- Preservar a etapa Cliente como está: card IA, dados/canal, card cliente e histórico do cliente.
- Na etapa Produtos, remover o Histórico do Cliente e o card Data de Entrega/Canal de Venda.
- Na etapa Pagamento, remover o Resumo da Venda lateral, deixando somente o card Pagamento.
- Na etapa Entregador, remover o Resumo da Venda lateral, deixando somente o card Entregador.
- Na etapa Confirmar, manter o Resumo da Venda centralizado.

2. Modernizar o card Produtos
- Atualizar `ProductSearch` para um visual mais moderno, com cabeçalho destacado, busca mais evidente e lista/tabela com acabamento mais limpo.
- Aproveitar as classes de tom da etapa (`venda-tone-produtos`) para que, no tema GásMais, o card use tons laranja modernos iguais às abas/indicadores da dashboard.
- Melhorar estados vazios e destaque do total/itens sem alterar a lógica de estoque, busca ou edição de preço.

3. Modernizar o card Pagamento
- Atualizar `PaymentSection` visualmente com cabeçalho mais forte, blocos de pagamento adicionados mais claros e status de falta/troco/pago com aparência moderna.
- Manter as formas de pagamento, modais PIX/cartão, cheque, fiado e validações existentes.
- Aplicar o tom verde da etapa (`venda-tone-pagamento`) no tema GásMais.

4. Melhorar seleção de Entregador
- Transformar `DeliveryPersonSelect` na tela nova em uma grade/lista clicável de entregadores.
- Exibir avatar/foto visual com iniciais do entregador, nome e status.
- Permitir seleção clicando no avatar, no nome ou no card inteiro.
- Manter a sugestão automática existente abaixo, quando houver endereço.
- Aplicar o tom amarelo/amber da etapa (`venda-tone-entregador`) no tema GásMais.

5. Melhorar cores da etapa Confirmar
- Manter a estrutura do `OrderSummary`, mas reforçar cores modernas baseadas no tema aplicado.
- No GásMais, usar destaque do tom de confirmação/primary para bordas, topo do card, total e botão principal.
- Preservar os botões Finalizar Venda, Agendar Entrega e Cancelar, bem como as validações existentes.

Detalhes técnicos
- Arquivos principais a alterar:
  - `src/pages/vendas/NovaVenda.tsx`
  - `src/components/vendas/ProductSearch.tsx`
  - `src/components/vendas/PaymentSection.tsx`
  - `src/components/vendas/DeliveryPersonSelect.tsx`
  - `src/components/vendas/OrderSummary.tsx`
  - `src/index.css` para utilitários visuais escopados ao `.theme-gasmais`, se necessário.
- Não alterar rotas, providers, `App.tsx`, nem arquivos gerados de integração.
- Manter a versão antiga funcional; os ajustes de mostrar somente o card ativo serão aplicados à versão nova guiada.
- Após implementar, rodar verificação de TypeScript/build para confirmar que a tela continua compilando.
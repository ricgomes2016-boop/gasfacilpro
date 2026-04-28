Plano de correção

1. Corrigir o número mostrado ao finalizar venda
- Na tela Nova Venda, manter a gravação do pedido como está, mas usar sempre o `numero_sequencial` retornado pelo banco para exibição.
- No popup/comprovante de finalização, substituir o número baseado no ID interno do pedido pelo número real do pedido.
- Ajustar o PDF de comprovante para aceitar e imprimir o número sequencial real, mantendo o ID interno apenas como fallback técnico se algum pedido antigo não tiver numeração.

2. Garantir que a numeração seja por ordem de lançamento
- Não usar a data selecionada para calcular o número exibido.
- A numeração seguirá o `numero_sequencial` já gerado no momento do insert do pedido, que representa a ordem real de lançamento/criação.
- Revisar também o fluxo de PDV para buscar `numero_sequencial` no insert e exibir/imprimir o número correto.

3. Melhorar a tela Caixa > Acerto
- Adicionar um resumo visível no topo da tela mostrando quais entregadores têm pedidos pendentes de acerto no período selecionado.
- O resumo deve listar: nome do entregador, quantidade de pedidos pendentes e valor total pendente.
- Ao clicar em um entregador do resumo, a tela seleciona automaticamente esse entregador e carrega os pedidos pendentes dele.
- Manter a tela atual de busca por entregador/canal, sem refatorar a estrutura geral.

Detalhes técnicos
- Arquivos principais a ajustar:
  - `src/pages/vendas/NovaVenda.tsx`
  - `src/services/receiptPdfService.ts`
  - `src/pages/vendas/PDV.tsx`
  - `src/pages/caixa/AcertoEntregador.tsx`
- O comprovante passará a receber algo como `pedidoNumero: pedido.numero_sequencial`, imprimindo `PEDIDO #123` em vez de `PEDIDO #AB12CD34`.
- A consulta de acertos pendentes buscará pedidos com status `entregue`/`pago`, agrupados por `entregador_id`, filtrados por unidade e período, trazendo o nome do entregador.
- Não será necessária mudança estrutural no banco para essa correção.
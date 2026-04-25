Plano para ajustar a tela `/vendas/nova`:

1. Deixar os cards mais nítidos
   - Aplicar um estilo visual específico para os cards da tela de nova venda, com borda mais escura/contrastante e sombra mais perceptível.
   - Usar uma borda escura suave em vez de preto puro para manter legibilidade no tema atual, por exemplo `border-slate-900/20` ou equivalente compatível com o design.
   - Aplicar o mesmo padrão nos principais blocos: comando por IA, dados da venda, cliente, entregador, produtos, pagamento, resumo da venda e histórico do cliente.

2. Reduzir espaçamentos excessivos
   - Diminuir o padding geral da página de `p-4 md:p-6` para algo mais compacto, mantendo conforto no mobile.
   - Reduzir gaps verticais entre seções de `space-y-4 md:space-y-6` para um padrão mais fechado.
   - Ajustar gaps do grid principal e dos grupos internos para deixar a tela menos “espalhada”.

3. Preservar responsividade
   - Manter o layout em 3 colunas no desktop e empilhado no mobile.
   - Não mexer em rotas, providers ou estrutura global do app.
   - Evitar alterações funcionais: apenas aparência, bordas, sombras e margens.

Detalhes técnicos:
- Alterar `src/pages/vendas/NovaVenda.tsx` para aplicar classes compactas e uma classe reutilizável local para cards da tela.
- Alterar componentes usados nessa tela quando necessário: `CustomerSearch`, `DeliveryPersonSelect`, `ProductSearch`, `PaymentSection`, `OrderSummary` e `CustomerHistory`, apenas para receber o novo visual de card/spacing.
- Não alterar o componente global `Card` para não afetar outras telas do sistema.
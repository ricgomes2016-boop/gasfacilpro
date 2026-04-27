Plano para corrigir os títulos que ainda ficaram com fundo branco e padronizar o restante:

1. Ajustar o componente global `VendaSectionHeader`
   - Fazer o `CardTitle` receber também a classe do tema atual (`section-header-title`) de forma consistente.
   - Garantir que `h3`, `span`, ícones e textos internos herdem a cor correta do cabeçalho sólido.
   - Manter a paleta sólida já definida: cliente/azul, produto/amarelo, financeiro/verde, crítico/vermelho e neutro com contraste.

2. Corrigir a etapa Cliente e Produto da venda
   - Em `CustomerHistory.tsx`, trocar o cabeçalho “Histórico do Cliente” para usar uma cor sólida, em vez do tom neutro branco.
   - Em `ProductSearch.tsx`, trocar “Produtos” para o tom de produto/estoque sólido, evitando o card branco no título.
   - Conferir se o card “Cliente” já segue o tom azul e manter igual.

3. Corrigir Dashboard
   - Em `RecentSales.tsx`, aplicar cabeçalho sólido em “Vendas do Dia”.
   - Em `SalesChart.tsx`, aplicar cabeçalho sólido em “Vendas por Hora”.
   - Em `AiInsightsWidget.tsx`, aplicar cabeçalho sólido em “Insights IA”, incluindo ícone e botão de atualizar com contraste correto.
   - Em `DeliveriesMap.tsx` e/ou página de entregas, aplicar cabeçalho sólido em “Entregas do Dia”.

4. Corrigir tela Pedidos
   - Em `src/pages/vendas/Pedidos.tsx`, aplicar o padrão sólido no cabeçalho “Pedidos (...)”.
   - Garantir que o contador de página no canto direito continue legível sobre o novo fundo.

5. Auditoria rápida nos componentes próximos
   - Revisar os principais `CardHeader`/`CardTitle` em dashboard e vendas que ainda estejam sem `section-header-*`.
   - Substituir títulos simples por classes padronizadas, sem refatoração estrutural grande.

6. Validação
   - Rodar checagem TypeScript após as alterações.
   - Conferir visualmente no código que não restaram títulos citados com `CardHeader` branco sem classe de tema.
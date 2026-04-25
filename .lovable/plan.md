Plano para ajustar o layout da dashboard e deixar todos os cards alinhados com espaçamento consistente em desktop, tablet e celular.

1. Padronizar o container principal da dashboard
- Aplicar `w-full min-w-0 max-w-full` no wrapper principal.
- Manter espaçamentos responsivos consistentes: menor no mobile e maior no desktop.
- Evitar qualquer scroll horizontal.

2. Ajustar os cards de indicadores/KPIs
- Padronizar os grids dos cards para usar gaps consistentes.
- Garantir que todos os cards tenham altura uniforme dentro da mesma linha.
- Adicionar `h-full`, `min-w-0` e estrutura interna flexível onde necessário.
- Corrigir textos longos/valores grandes para não desalinharem os cards.

3. Ajustar o bloco de Acesso Rápido
- Melhorar o grid dos botões para distribuir melhor em telas pequenas, médias e grandes.
- Manter as cores atuais dos botões.
- Garantir altura mínima uniforme e espaçamento igual entre os botões.

4. Ajustar widgets e seções inferiores
- Padronizar os grids de `SalesChart`, `AiInsightsWidget`, `DailySalesGoal`, `DeliveryDriverStatus`, `RecentSales`, `StockOverview` e `DeliveriesMap`.
- Adicionar `min-w-0`, `h-full` e espaçamento consistente nos wrappers para evitar desalinhamento.
- Corrigir a seção de “Vendas recentes”, que hoje ocupa apenas 2 colunas em um grid de 3 e pode deixar uma área vazia desalinhada.

5. Respeitar o padrão mobile do projeto
- Seguir as regras existentes de responsividade: containers com `w-full min-w-0 max-w-full`, grids com base mobile e textos seguros.
- Sem refatorar rotas, providers ou estrutura global do app.

Arquivos previstos:
- `src/pages/Dashboard.tsx`
- `src/components/dashboard/StatCard.tsx`
- `src/components/dashboard/QuickActions.tsx`

Resultado esperado:
- Cards alinhados visualmente.
- Espaçamento consistente entre seções.
- Melhor encaixe em celular, tablet e desktop.
- Sem alterar dados, regras de negócio ou funcionamento da dashboard.
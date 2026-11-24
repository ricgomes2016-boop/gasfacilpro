# Cards de resumo no estilo "Acesso Rápido" em outras telas

## O que encontrei
Cerca de 40 telas têm uma fileira de cards de resumo no topo (total, pendentes, valores etc.), cada uma com um visual diferente. Todas podem usar o mesmo estilo dos Produtos: cor sólida, ícone branco, número grande e 2 por linha no celular.

## Telas sugeridas, por área
**Cadastros:** Clientes, Veículos, Comodatos, Categorias de despesa
**Vendas:** Pedidos, Pedidos Kanban, Relatório de vendas, Vendedores
**Caixa e Financeiro:** Caixa do dia, Despesas, Pagamentos com cartão, Aging (contas vencidas), Emissão de boleto, Orçamentos, Gestão de crédito
**Estoque:** Compras, Transferências, MCMM, Lotes
**Operacional:** Gestão de rotas, SLA de entregas, Aprovações, Licitações, Bolão
**Frota:** Manutenção, Combustível, Multas
**Fiscal:** Painel fiscal, Relatórios de notas, Gerar XML
**Marketing e RH:** Painel de marketing, Métricas, Campanhas WhatsApp, Horários

**Ficam de fora:** Mapa operacional e Conferência de estoque (os cards têm muita informação e tabelas internas) e a página de vendas do site.

## Cores
Mesmas do Acesso Rápido, conforme o significado:
- Azul: total / geral
- Verde: recebido, pago, concluído
- Laranja/amarelo: pendente, em andamento
- Vermelho: vencido, atrasado, estoque baixo

## Como faço
Em etapas, para não quebrar nada: 1) Cadastros e Vendas, 2) Caixa e Financeiro, 3) Estoque e Operacional, 4) Frota, Fiscal, Marketing e RH. Os números e as contas não mudam, só o visual.

## Detalhes técnicos
- Novo componente `src/components/ui/kpi-tile.tsx` (`KpiTile` + `KpiTileGrid`), extraído do card de `Produtos.tsx`: props `label`, `value`, `icon`, `tone` (`blue|orange|amber|green|red`), `hint?`, `onClick?`.
- Grid `grid-cols-2 md:grid-cols-4/5 gap-3`; o último card ocupa a linha inteira no celular quando a quantidade é ímpar.
- `style={{color:"#fff"}}` + `!text-white` para vencer as regras globais de `.system-surface`.
- `Produtos.tsx` passa a usar o componente.
- Trocar só o bloco de KPIs de cada página; nenhuma consulta ou cálculo é alterado.

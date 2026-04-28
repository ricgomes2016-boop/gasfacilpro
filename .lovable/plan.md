Vou transformar o HTML enviado em uma implementação nativa do app, dentro de Gestão de Frota, seguindo os componentes e padrões existentes do projeto.

## O que será implementado

1. Atualizar o Dashboard de Frota
- Incorporar a estrutura visual do exemplo “Gestão Total da Frota”.
- Manter o layout existente com `MainLayout` e `Header`.
- Substituir/adaptar os blocos atuais para uma visão mais completa com:
  - KPIs principais: custo mensal, custo/km, veículos ativos e alertas críticos.
  - Área principal com custos da frota e ranking de veículos.
  - Status dos veículos.
  - Análise de IA sobre comportamento do motorista.
  - Alertas da IA.
  - Simulação “E se?”.
  - Resultado da simulação.

2. Adaptar o HTML para React + Tailwind
- Não vou inserir HTML cru, `<style>`, `<script>` externo ou CDN de Chart.js.
- Vou converter para JSX usando os componentes já usados no sistema: `Card`, `Badge`, `Button`, tabelas simples e inputs/selects do design system.
- O layout será responsivo, mantendo a ideia do exemplo:
  - Desktop: coluna principal + coluna lateral.
  - Tablet/mobile: tudo em uma coluna.
  - KPIs em 4 colunas no desktop e 2/1 no mobile.

3. Usar dados reais quando já existem no sistema
- Custo mensal: continuará usando abastecimentos + manutenções do mês.
- Veículos ativos: continuará usando a tabela de veículos.
- Alertas críticos: usará alertas de documentos, manutenções e multas quando disponíveis.
- Status dos veículos: será montado a partir dos veículos ativos e alertas calculados.
- Ranking de veículos: será calculado com base nos dados disponíveis de frota, com fallback visual quando faltarem dados suficientes.

4. IA e simulação
- A seção de IA será implementada como análise operacional calculada no front-end, reaproveitando a lógica já existente em `FrotaIAInsights` quando fizer sentido.
- A simulação “E se?” terá seleção entre frota própria e terceirizada e exibirá um resultado estimado.
- Inicialmente, a simulação será local/interativa, sem criar novas tabelas no banco.

## Arquivos a alterar

- `src/pages/frota/DashboardFrota.tsx`
  - Principal alteração visual e funcional da Gestão Total da Frota.

- `src/components/frota/FrotaIAInsights.tsx`
  - Ajuste ou reaproveitamento para encaixar melhor no novo dashboard, evitando duplicidade visual.

## Detalhes técnicos

- Não vou alterar `App.tsx`, rotas principais ou estrutura de providers, respeitando a regra de estabilidade do projeto.
- Não será necessário criar tabela nova nem mexer em RLS nesta primeira etapa.
- Não vou adicionar Chart.js via CDN. Se for necessário um gráfico, farei com elementos visuais em Tailwind ou componentes já existentes no projeto, para evitar dependência externa e conflito com Vite.
- Onde não houver dados suficientes para calcular um indicador, o painel exibirá um estado seguro como “Sem dados suficientes”, em vez de valores fixos enganosos.

## Resultado esperado

A página `/frota` passará a parecer uma “Gestão Total da Frota”, com a visão executiva e operacional do HTML enviado, porém integrada ao sistema real, responsiva e compatível com o padrão visual do app.
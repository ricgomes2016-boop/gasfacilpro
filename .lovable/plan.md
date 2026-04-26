Plano para deixar os cards mais modernos e padronizar a tela de Estoque

1. Padronizar cards do sistema
- Atualizar o componente base `Card` para usar cantos mais modernos (`rounded-xl`), borda mais suave, sombra mais limpa e transições de hover discretas.
- Ajustar `CardHeader` para acompanhar o novo raio dos cards, evitando aparência de borda quadrada no topo.
- Criar/ajustar utilitários globais para que elementos internos com `border rounded-md` usados como “mini-cards” fiquem visualmente mais arredondados e consistentes, sem alterar inputs, selects, tooltips ou botões que dependem de `rounded-md`.

2. Modernizar o Header global
- Atualizar `src/components/layout/Header.tsx` com visual mais moderno: fundo translúcido com blur, borda inferior mais suave, altura responsiva e melhor espaçamento.
- Melhorar a área do título/subtítulo com truncamento seguro e hierarquia visual mais limpa.
- Manter todos os botões e ações atuais do header sem alterar comportamento.

3. Melhorar o design visual da tela Estoque
- Reestruturar a área superior de `/estoque` com um bloco visual moderno: título contextual, período, ações e filtros organizados em cards/painéis arredondados.
- Melhorar os cards de resumo: cores sólidas/semânticas, ícones padronizados, melhor contraste e layout responsivo para mobile.
- Ajustar os filtros de data e botões para não quebrarem de forma estranha em telas pequenas.
- Manter as regras e cálculos atuais de estoque sem alterar dados ou consultas.

4. Verificação ampla no sistema
- Procurar ocorrências de cards ou containers com aparência quadrada (`rounded-none`, `rounded-sm`, `rounded-md` em blocos visuais) e ajustar apenas onde forem cards/painéis, preservando componentes que precisam ser retos por design, como tabelas, inputs, menus e grupos de botões.
- Conferir especialmente páginas com cards de status, dashboards, estoque, vendas, caixa e entregador.

Detalhes técnicos
- Arquivos principais previstos:
  - `src/components/ui/card.tsx`
  - `src/components/layout/Header.tsx`
  - `src/index.css`
  - `src/pages/Estoque.tsx`
  - possivelmente componentes de estoque relacionados, como `src/components/estoque/EstoqueDiaTable.tsx`, se a tabela diária estiver com cards/painéis quadrados.
- Não haverá mudança no banco de dados.
- Não haverá alteração em autenticação, rotas ou estrutura principal do app, respeitando a regra de estabilidade do projeto.
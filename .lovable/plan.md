Plano para ajustar o cabeçalho da tela `/vendas/nova`:

1. Reduzir a pressão visual do cabeçalho global
   - Ajustar `src/components/layout/Header.tsx` para que o lado direito não fique espremido em larguras médias como a atual.
   - Diminuir gaps excessivos e larguras fixas que competem por espaço.
   - Manter o título e subtítulo com truncamento seguro, sem quebrar o layout.

2. Priorizar ações importantes por tamanho de tela
   - Em desktop largo: manter seletor de unidade, busca, chat, notificações, tema, calculadora e usuário.
   - Em telas médias: reduzir/ocultar elementos menos críticos, especialmente a busca grande (`CommandPalette`) e/ou botões duplicados, para liberar espaço.
   - Em mobile: preservar o padrão existente com menu mobile e barra inferior, sem adicionar poluição no topo.

3. Compactar componentes específicos do header
   - Ajustar `CommandPalette` para não ocupar sempre `w-64`; usar largura responsiva menor em telas médias.
   - Ajustar `UnidadeSelector` para ter limite de largura mais previsível e não empurrar os demais botões.
   - Evitar alterações funcionais nos menus, notificações, chat, calculadora e autenticação.

4. Manter estabilidade do app
   - Não alterar `App.tsx`, rotas, providers ou regras globais.
   - Não mexer em banco de dados.
   - Fazer somente mudanças visuais/responsivas no cabeçalho.

Detalhes técnicos:
- Arquivos previstos:
  - `src/components/layout/Header.tsx`
  - `src/components/layout/CommandPalette.tsx`
  - `src/components/layout/UnidadeSelector.tsx`
- Estratégia provável:
  - Trocar `md:gap-4` por gaps menores/responsivos no grupo de ações.
  - Exibir a busca do Command Palette apenas em `xl` ou reduzir sua largura em `lg`.
  - Usar classes como `hidden lg:block`, `w-40 xl:w-64`, `max-w-*`, `shrink-0`, `min-w-0` e truncamento controlado.
  - Se necessário, ocultar o toggle de tema ou itens secundários em telas médias, mantendo acesso por outros pontos já existentes.
Vou revisar e corrigir o padrão de cores para evitar textos brancos em fundos claros, especialmente no header e no seletor de unidade, sem alterar regras de negócio ou fluxos do sistema.

Plano:

1. Corrigir o seletor do header
   - Ajustar o botão do seletor de unidade para usar o gradiente azul/roxo com texto legível.
   - Corrigir o menu aberto do seletor para garantir fundo e texto com contraste correto.
   - Revisar badges dentro do seletor para não ficarem brancos sobre fundo branco.

2. Corrigir componentes globais de menu e seleção
   - Ajustar `DropdownMenu` para que itens em foco/hover usem texto escuro em fundo claro, e texto claro apenas quando o fundo for realmente colorido.
   - Ajustar `Select`/combobox para manter texto visível em trigger, opções abertas, estado selecionado e foco.
   - Evitar que o padrão `accent-foreground` branco seja aplicado em menus claros.

3. Ajustar tokens problemáticos de tema
   - Corrigir variáveis como `--accent-foreground` e `--sidebar-accent-foreground` quando estiverem causando branco em superfícies claras.
   - Manter branco apenas para elementos com fundo forte: gradiente azul/roxo, botões primários, cards escuros/coloridos e sidebar.

4. Revisão global de classes perigosas
   - Revisar usos de `text-white`, `text-primary-foreground`, `text-accent-foreground` e similares.
   - Corrigir casos onde essas classes aparecem em cards, popovers, inputs, selects, tabelas, badges e botões com fundo claro.
   - Manter as páginas públicas e áreas com hero/gradiente intactas quando o branco for correto.

5. Preservar o padrão visual pedido
   - Continuar usando o azul/roxo do menu como padrão de destaque.
   - Manter vermelho para erro, verde para sucesso e amarelo/âmbar para alerta real.
   - Não mexer em rotas, autenticação, banco de dados, permissões ou regras operacionais.

6. Validação
   - Rodar verificação TypeScript/build.
   - Conferir especificamente: header, seletor de unidade, dropdowns, selects, menu lateral, menu mobile e tela atual de nova venda.

Detalhes técnicos:
- Arquivos principais previstos: `src/index.css`, `src/components/layout/UnidadeSelector.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/components/ui/select.tsx`, e ajustes pontuais em componentes que usam texto branco indevidamente.
- A correção será visual e conservadora: substituir texto branco indevido por `text-foreground`, `text-popover-foreground`, `text-card-foreground`, `text-primary` ou `text-sidebar-foreground` conforme o fundo.
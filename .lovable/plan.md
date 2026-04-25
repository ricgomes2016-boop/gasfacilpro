Vou corrigir a responsividade da tela **Gestão Operacional > Análise de Resultados**, principalmente o card/área de **Resultado Operacional** e as abas **RO, DRE e PE** no celular.

O problema identificado está em três pontos principais:

1. A área das abas usa `grid-cols-3` com textos/ícones que podem ficar apertados em telas pequenas.
2. O conteúdo da aba **RO** tem cabeçalho com filtros e botões em uma única linha, além de tabelas largas sem contenção horizontal adequada.
3. As abas **DRE** e **PE** já possuem algumas rolagens, mas precisam de wrappers `min-w-0`, larguras máximas e ajustes de grids/cards para não estourarem o layout mobile.

Plano de ajuste:

- Ajustar o container principal de `AnaliseResultados.tsx` com `w-full min-w-0 max-w-full overflow-x-hidden`, preservando o layout desktop.
- Melhorar o seletor de período para mobile, fazendo Mês/Ano/Badge quebrarem corretamente e ocuparem largura adequada em telas pequenas.
- Reestruturar a barra de abas para celular:
  - manter 3 abas na mesma linha;
  - reduzir gaps e padding no mobile;
  - esconder ou encurtar textos longos onde necessário;
  - garantir que os botões não estourem a largura.
- Envolver cada `TabsContent` com `min-w-0 overflow-hidden` para impedir vazamento lateral.
- Ajustar `ResultadoOperacional.tsx` quando usado dentro da análise:
  - cabeçalho/filtros em coluna no mobile e linha no desktop;
  - botões de Categorias, PDF e Imprimir quebrando em grade/flex-wrap;
  - tabelas largas dentro de `overflow-x-auto` com `min-w` controlado;
  - cards finais em grid responsivo com largura correta.
- Ajustar pontos críticos de `DRE.tsx` e `PontoEquilibrio.tsx` para melhorar comportamento dentro das abas:
  - adicionar `min-w-0` nos wrappers;
  - reduzir paddings/textos em mobile;
  - garantir que gráficos e tabelas não causem rolagem horizontal da página inteira.

Arquivos a alterar:

- `src/pages/operacional/AnaliseResultados.tsx`
- `src/pages/operacional/ResultadoOperacional.tsx`
- `src/pages/operacional/DRE.tsx`
- `src/pages/operacional/PontoEquilibrio.tsx`

Resultado esperado:

- No celular, as abas RO/DRE/PE ficam visíveis e clicáveis sem quebrar o layout.
- O card de Resultado Operacional passa a empilhar filtros, ações e tabelas corretamente.
- Tabelas grandes rolam apenas dentro do próprio card, sem criar scroll horizontal na página inteira.
- Desktop e tablet continuam com o layout amplo atual.
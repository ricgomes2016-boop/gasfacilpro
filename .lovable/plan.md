Plano para ajustar a DRE em RO/DRE/PE

1. Responsividade da DRE em 360px e 390px
- Revisar o layout mobile da aba DRE para impedir scroll horizontal externo.
- Manter `overflow-x-hidden` apenas nos containers externos e permitir rolagem somente dentro de cards/tabelas quando necessário.
- Ajustar cards mobile da DRE para evitar sobreposição entre descrição, acumulado, AV% e valores mensais.
- Em telas muito estreitas, usar hierarquia vertical mais segura: descrição em cima, acumulado/AV abaixo, meses em grid legível.

2. Formatação consistente de valores
- Criar formatadores locais padronizados para a DRE:
  - moeda completa em BRL com 2 casas quando estiver em tabela/detalhe;
  - moeda compacta apenas nos KPIs, seguindo o padrão visual de RO/PE;
  - negativos sempre consistentes, com cor destrutiva e sinal/parenteses padronizados;
  - percentuais com 1 casa decimal e tratamento seguro para zero/NaN.
- Aplicar a mesma regra no desktop, mobile, tooltips, AV% e badges.
- Ajustar o export PDF da DRE se necessário para acompanhar a mesma regra de negativos e totais.

3. Filtros para escolher meses exibidos
- Manter o filtro rápido atual de período: últimos 3, 6 ou 12 meses.
- Adicionar seleção de meses visíveis dentro do período carregado, sem nova consulta ao banco a cada clique.
- Calcular a DRE completa uma vez conforme o período e filtrar apenas a visualização, gráficos, totais, acumulados, AV% e PDF com base nos meses selecionados.
- Incluir ações rápidas como “Todos” e “Últimos 3” para facilitar uso no celular.
- Garantir que o filtro use valores não vazios no Select, respeitando a regra do projeto para Radix Select.

4. Tabela desktop mais legível
- Ajustar larguras mínimas das colunas por quantidade de meses exibidos.
- Melhorar alinhamento numérico com `tabular-nums`, valores à direita e descrições à esquerda.
- Tornar o cabeçalho fixo dentro do card durante rolagem vertical/horizontal, sem cortar textos.
- Preservar a coluna “Descrição” fixa à esquerda com fundo sólido e sombra divisória.
- Reduzir risco de corte em “Acumulado”, “AV%” e nomes longos usando largura adequada, `whitespace-nowrap` nos cabeçalhos e quebra controlada na descrição.

5. Verificação após implementação
- Validar visualmente a rota `/operacional/analise-resultados` na aba DRE em 360px e 390px.
- Confirmar que `document.documentElement.scrollWidth` não ultrapassa `window.innerWidth`.
- Conferir que todos os cards/linhas da DRE ficam legíveis, sem texto sobreposto.
- Conferir no desktop se cabeçalho/coluna fixa funcionam e os valores permanecem alinhados.

Arquivos previstos
- `src/pages/operacional/DRE.tsx`
- `src/services/reportPdfService.ts` somente se o PDF precisar acompanhar a nova formatação/filtro de meses.
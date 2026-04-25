Plano para melhorar a aba DRE em telas pequenas

1. Transformar a tabela DRE em layout responsivo dual-view
- No desktop/tablet: manter a tabela financeira completa, porém mais legível e organizada.
- No mobile: substituir a tabela larga por cartões/linhas compactas por item da DRE, evitando depender de uma tabela com largura mínima grande.
- A visualização mobile mostrará, por linha: descrição, acumulado, AV% e os valores mensais em chips/mini-colunas roláveis somente dentro do card se necessário.

2. Melhorar a tabela desktop da DRE
- Reduzir a largura mínima atual para evitar overflow desnecessário.
- Ajustar padding, tamanhos de fonte, altura das linhas e contraste entre linhas normais, subtotais e resultado final.
- Manter a coluna “Descrição” fixa apenas quando fizer sentido, com fundo sólido para não sobrepor os valores durante o scroll interno.
- Destacar melhor: Receita Líquida, Lucro Bruto, EBITDA e Resultado Líquido.

3. Corrigir responsividade em 360px e 390px
- Garantir que a página e a aba DRE usem `w-full`, `min-w-0`, `max-w-full` e `overflow-x-hidden` nos containers externos.
- Garantir que qualquer rolagem horizontal fique confinada ao card da tabela, nunca na página inteira.
- Ajustar o topo da DRE: seletor de período, badge e botões PDF/Imprimir para caberem em uma coluna compacta no celular.
- Ajustar cards KPI e gráficos para não ultrapassarem a largura do viewport.

4. Implementar sem mexer na estrutura global do app
- Editar principalmente `src/pages/operacional/DRE.tsx`.
- Se necessário, fazer apenas ajustes pontuais no wrapper da aba em `src/pages/operacional/AnaliseResultados.tsx`.
- Não alterar rotas, providers, `App.tsx`, cliente/tipos do backend ou estrutura global.

Critérios de aceite
- Em 360px e 390px não deve existir scroll horizontal externo na tela.
- A aba DRE deve permanecer legível no celular.
- A tabela completa deve continuar disponível em telas maiores.
- Se houver rolagem horizontal, ela deve acontecer apenas dentro do card/tabela, não no documento inteiro.
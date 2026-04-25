Plano para aplicar um tema global moderno sem deixar o sistema “branco puro”

1. Criar um fundo global mais moderno
- Ajustar os tokens globais em `src/index.css` para usar um fundo levemente azulado/cinza no modo claro, em vez de branco puro.
- Manter o conteúdo principal legível, com texto nítido e contraste alto.
- Adicionar um tratamento visual discreto no `body`/layout com gradientes suaves e radiais, sem pesar a interface.

2. Atualizar o layout principal do ERP
- Alterar `MainLayout` para aplicar uma classe global de superfície do sistema.
- Garantir que todas as páginas internas recebam o novo fundo automaticamente, sem precisar alterar página por página.
- Preservar a Sidebar preta e a barra inferior mobile já ajustadas.

3. Melhorar cards e áreas de conteúdo
- Manter os cards com fundo claro/branco para contraste, mas com bordas e sombras consistentes com a Nova Venda.
- Criar/ajustar utilitários globais para cards e superfícies internas, evitando excesso de branco chapado.
- Reforçar sombras de forma elegante para destacar os cards sobre o novo fundo.

4. Ajustar a tela Nova Venda para combinar com o novo tema
- Preservar o padrão atual de cards/sombras da Nova Venda.
- Ajustar apenas o fundo externo e áreas de seção para integrar com o tema global.
- Evitar mexer na lógica de venda, produtos, pagamentos ou fluxo do pedido.

5. Garantir compatibilidade com tema GásMais e modo escuro
- Atualizar `theme-gasmais.css` para seguir o mesmo padrão de fundo moderno quando o tema GásMais estiver ativo.
- Manter o modo escuro consistente, sem reduzir contraste das fontes.
- Evitar que o tema global afete páginas públicas/portais de forma indesejada quando já tiverem tema próprio.

Detalhes técnicos
- Arquivos principais previstos:
  - `src/index.css`
  - `src/components/layout/MainLayout.tsx`
  - `src/styles/theme-gasmais.css`
  - ajustes pontuais em `src/pages/vendas/NovaVenda.tsx`, se necessário
- Não haverá mudança estrutural em `App.tsx`, providers ou rotas.
- Não haverá alteração de banco de dados.
- O foco será visual: fundo global, contraste, bordas, sombras e consistência entre desktop/mobile.
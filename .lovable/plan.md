Plano de implementação para `Vendas > Nova Venda`

1. Criar um modo novo guiado por etapas
- Manter a tela atual intacta como “versão antiga”.
- Adicionar uma “versão nova” com fluxo visual por abas/etapas:
  - Cliente
  - Produtos
  - Pagamento
  - Entregador
  - Confirmar
- Ao abrir a nova versão, deixar visíveis imediatamente:
  - Card da IA
  - Card do Cliente
  - Card Histórico do Cliente

2. Avanço automático entre etapas
- Quando o cliente estiver preenchido/selecionado, destacar/liberar a etapa “Produtos”.
- Quando houver produto adicionado, avançar para “Pagamento”.
- Quando o pagamento estiver preenchido, avançar para “Entregador”.
- Quando o entregador for selecionado, avançar para “Confirmar”.
- Na etapa final, exibir o card “Resumo da Venda” com os botões de finalizar, agendar e cancelar.

3. Melhorar a organização visual dos cards
- Na versão nova, cada etapa exibirá apenas os cards relevantes para reduzir poluição visual.
- A etapa inicial terá layout em duas colunas no desktop: IA/Cliente à esquerda e Histórico à direita.
- Em telas menores, os cards ficam empilhados.
- Aplicar cores do tema atual nos cards usando tokens `primary`, `card`, `muted`, `border` e `ring`, para funcionar tanto no tema padrão quanto no tema GásMais.

4. Alternância discreta entre versões
- Criar um botão discreto no topo da página, ao lado do número da próxima venda ou perto do stepper:
  - “Versão nova” / “Versão antiga”
- Salvar a preferência em `localStorage`, para o usuário continuar usando a versão escolhida nas próximas aberturas.
- Se o tema GásMais estiver ativo, a tela poderá abrir por padrão na versão nova, mas o botão continuará permitindo voltar para a antiga.

5. Ajustar o stepper superior
- Atualizar as abas atuais para incluir “Entregador”, ficando:
  - Cliente
  - Produtos
  - Pagamento
  - Entregador
  - Confirmar
- Na versão nova, permitir clicar nas etapas já liberadas para navegar manualmente sem perder dados.
- Marcar visualmente etapas concluídas e a etapa atual.

Detalhes técnicos
- Alterar principalmente `src/pages/vendas/NovaVenda.tsx`.
- Reutilizar os componentes existentes:
  - `CustomerSearch`
  - `CustomerHistory`
  - `ProductSearch`
  - `PaymentSection`
  - `DeliveryPersonSelect`
  - `OrderSummary`
- Usar `useDashboardTheme()` para detectar o tema GásMais sem alterar o hook existente.
- Não mexer em `App.tsx`, rotas, provedores, banco de dados ou autenticação.
- Não alterar a lógica de finalização da venda; apenas reorganizar a experiência visual e a navegação entre cards.
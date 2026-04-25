Plano de implementação para /vendas/nova

1. Etapa Produtos: atalhos com foto dos produtos principais
- Adicionar uma faixa de cards rápidos acima do seletor/busca de produtos em `ProductSearch`.
- Usar imagens já existentes para:
  - Gás P13: `src/assets/products/gas-p13.png`
  - Gás P20: `src/assets/products/gas-p20.png`
  - Gás P45: `src/assets/products/gas-p45.png`
  - Água Mineral 20L: `src/assets/products/agua-20l.png`
- Para Kit Regulador 13kg, como não há imagem existente, usar um card visual com ícone adequado como fallback, mantendo aparência igual aos demais.
- Ao clicar em um card rápido, buscar no cadastro de produtos ativos pelo nome correspondente e adicionar o produto usando a mesma lógica atual de preço, estoque e último preço pago pelo cliente.
- Manter o seletor/busca atual e a tabela/histórico dos itens com Nome, Qtd, Unit. e Total, sem remover a edição de quantidade/preço.

2. Etapa Pagamentos: seleção por ícones
- Modernizar `PaymentSection` para exibir uma grade de cards/ícones das formas de pagamento.
- Ao clicar em Dinheiro, PIX, PIX Maquininha, Cartão Débito, Cartão Crédito, Boleto, Vale Gás, Cheque ou Fiado, selecionar a forma de pagamento automaticamente.
- Manter o comportamento atual: preencher valor restante, abrir modal de PIX/cartão quando necessário, campos extras de cheque/fiado e botão de adicionar pagamento.
- Preservar o Select atual como compatibilidade/acessibilidade, mas o fluxo principal será pelos cards clicáveis.

3. Atalho com Enter entre inputs
- Criar lógica escopada à tela nova guiada para que Enter avance o foco para o próximo campo editável dentro da etapa atual.
- Evitar interferir em botões, selects abertos, textarea com quebra de linha e ações existentes como o campo de comando IA.
- Quando estiver no último input da etapa, o foco seguirá para o próximo elemento relevante; se aplicável, poderá manter o comportamento atual de ações específicas já existentes.
- Manter foco visível e navegação acessível por teclado.

4. Entregador pula para Confirmar
- Ajustar `handleSelecionarEntregador` em `NovaVenda.tsx` para que, ao escolher um entregador na versão nova guiada, a etapa avance imediatamente para `Confirmar`.
- Manter o toast de entregador selecionado e preservar o comportamento da versão antiga sem forçar mudança de layout.

5. Acabamento visual e responsividade
- Aplicar classes e estilos no `src/index.css` para os novos cards rápidos de produto e pagamento, usando a paleta moderna das etapas.
- Garantir contraste em claro/escuro, hover/focus acessível e transições suaves já usadas no fluxo.
- Validar que a tela continua compilando após as alterações.

Detalhes técnicos
- Arquivos principais a alterar:
  - `src/components/vendas/ProductSearch.tsx`
  - `src/components/vendas/PaymentSection.tsx`
  - `src/pages/vendas/NovaVenda.tsx`
  - `src/index.css`
- Não alterar `App.tsx`, rotas, providers, nem arquivos gerados de integração.
- Não alterar regras de banco de dados; a implementação usa produtos já cadastrados e a lógica atual de venda.
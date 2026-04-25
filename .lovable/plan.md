Plano para ajustar a tela /vendas/nova:

1. Melhorar contraste dos inputs e textos
- Escurecer as bordas dos inputs, textareas e selects dentro do fluxo de Nova Venda.
- Manter o foco acessível com anel/outline colorido pela etapa atual.
- Aumentar nitidez visual de labels, textos principais, itens de tabela, totais e badges sem deixar a interface pesada.
- Ajustar claro e escuro separadamente para preservar legibilidade nos dois modos.

2. Refinar o atalho da tecla Enter
- Alterar a lógica atual em `NovaVenda.tsx` para avançar apenas entre campos relevantes de preenchimento da venda.
- Ignorar Enter quando o foco estiver em:
  - botões;
  - selects;
  - comboboxes;
  - campos de busca/autocomplete de cliente/produto/endereço;
  - textarea;
  - inputs de arquivo, checkbox e radio.
- Marcar os campos realmente navegáveis com um atributo específico, por exemplo `data-venda-enter-next`, para evitar que o Enter passe por botões de atalho, cards de produto, ícones de pagamento ou controles de tabela.
- Aplicar esse atributo principalmente em campos como nome, telefone, endereço, número, complemento, bairro, CEP, data de entrega, canal quando aplicável, valor do pagamento e campos extras de cheque/fiado.
- Quando não houver próximo campo relevante, manter o comportamento padrão ou não interferir.

3. Padronizar fundos dos cards com visual moderno do tema GásMais
- Unificar o fundo dos cards das etapas com gradientes suaves baseados em `--venda-tone` e `--venda-tone-strong`.
- Aplicar a mesma lógica aos cards principais, cards internos, atalhos de produto, atalhos de pagamento, blocos de status e containers de tabela.
- Evitar fundos muito claros/acinzentados soltos (`bg-muted/20`, `bg-background`) onde eles quebram a paleta, substituindo por classes/estilos consistentes da venda.
- Preservar o topo colorido e as sombras já existentes, mas com bordas mais escuras e modernas.

4. Arquivos previstos
- `src/pages/vendas/NovaVenda.tsx`: ajustar o handler do Enter e marcar campos relevantes.
- `src/components/vendas/CustomerSearch.tsx`: adicionar marcação nos inputs relevantes e melhorar classes de legibilidade quando necessário.
- `src/components/vendas/ProductSearch.tsx`: impedir que Enter interfira na busca e manter estilo padronizado em atalhos/tabela.
- `src/components/vendas/PaymentSection.tsx`: marcar campo de valor e campos extras, preservar Enter padrão em ícones/selects.
- `src/components/vendas/DeliveryPersonSelect.tsx`: manter seleção por clique sem Enter avançando por cards.
- `src/components/vendas/OrderSummary.tsx`: harmonizar cards/totais/badges com a paleta.
- `src/index.css`: centralizar os novos estilos de borda, contraste, fundo e estados claro/escuro.

5. Validação
- Rodar verificação TypeScript após as alterações.
- Conferir se o Enter não aciona seleção indevida em busca, combobox, select, botões e cards clicáveis.
- Conferir visual em modo claro e escuro, especialmente bordas dos inputs, contraste de texto e fundo dos cards.
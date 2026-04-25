Plano de ajuste para `Vendas > Nova Venda`

1. Corrigir e reforçar o avanço automático da versão nova
- Manter o fluxo guiado nas etapas:
  - Cliente
  - Produtos
  - Pagamento
  - Entregador
  - Confirmar
- Garantir que a tela avance automaticamente quando:
  - Cliente estiver preenchido/selecionado → Produtos
  - Houver pelo menos um produto → Pagamento
  - O pagamento estiver completo, com valor pago maior ou igual ao total da venda → Entregador
  - O entregador estiver selecionado → Confirmar
- Evitar que a etapa volte indevidamente quando o usuário estiver conferindo uma etapa já liberada, preservando a navegação manual entre etapas habilitadas.

2. Ajustar a etapa final
- Na etapa final `Confirmar`, exibir o card `Resumo da Venda` com os botões de finalizar, agendar e cancelar.
- Manter a validação atual de finalização, sem alterar regras de venda, estoque, pagamento ou caixa.

3. Persistir a escolha entre versão nova e antiga
- Usar o `localStorage` com a chave já existente `nova-venda-view-mode`.
- Ao clicar no botão discreto `Versão nova` / `Versão antiga`, salvar imediatamente a escolha do usuário.
- Ao recarregar a página ou abrir novamente `Vendas > Nova Venda`, restaurar automaticamente a última versão escolhida.
- Se não existir escolha salva e o tema GásMais estiver ativo, a tela poderá iniciar na versão nova como padrão, mas sem sobrescrever a preferência manual do usuário.

4. Ajustar o comportamento do stepper
- Permitir clique apenas nas etapas já liberadas.
- Marcar visualmente etapas concluídas e etapa atual.
- Impedir acesso direto a etapas dependentes sem preencher os dados anteriores.

Detalhes técnicos
- Alterar principalmente `src/pages/vendas/NovaVenda.tsx`.
- Refinar os estados `useNewView`, `activeStep`, `clientePreenchido`, `produtosPreenchidos`, `pagamentoPreenchido` e `entregadorPreenchido`.
- Manter a chave `nova-venda-view-mode` para compatibilidade com o que já foi implementado.
- Não mexer em rotas, `App.tsx`, provedores, banco de dados, autenticação ou lógica de finalização da venda.
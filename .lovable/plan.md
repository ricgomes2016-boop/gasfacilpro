Vou ajustar a etapa Pagamento da tela Nova Venda para ficar visualmente mais parecida com os cards de Ações Rápidas do dashboard: mais colorida, com melhor contraste, hover evidente e seleção destacada.

Plano de implementação:

1. Atualizar os atalhos de formas de pagamento
- Transformar cada card de pagamento em um card colorido por tipo: dinheiro/PIX verde, cartões azul/laranja, boleto neutro, vale gás vermelho, cheque/fiado com tons próprios.
- Aplicar fundo suave colorido, borda colorida e ícone dentro de um bloco destacado, seguindo o padrão visual dos cards de ação rápida do dashboard.
- Melhorar hover com borda mais forte, fundo colorido leve, sombra e deslocamento sutil.
- Melhorar estado selecionado com anel/ring, borda ativa e texto em cor forte.

2. Colorir o card/box de adicionar pagamento
- Trocar o container neutro da seção “Adicionar novo pagamento” por uma superfície com fundo levemente colorido, borda mais visível e sombra consistente.
- Manter legibilidade dos campos Select e valor, sem deixar a tela pesada.

3. Ajustar o botão de adicionar pagamento
- Deixar o botão “+” mais chamativo, com gradiente/fundo primário, sombra e hover consistente com a identidade do sistema.
- Garantir que em mobile ele continue com tamanho confortável e sem quebrar o layout.

4. Melhorar lista de pagamentos adicionados
- Aplicar o mesmo padrão visual aos pagamentos já adicionados: ícone colorido, borda/sombra leve e melhor separação entre forma e valor.
- Manter o botão de remover bem visível, mas sem dominar o card.

Detalhes técnicos:
- Principal arquivo a alterar: `src/components/vendas/PaymentSection.tsx`.
- Não vou refatorar a estrutura da tela nem alterar lógica de pagamento.
- Vou reaproveitar `cn`, os tons já existentes e classes utilitárias atuais para preservar estabilidade.
- Não haverá alteração de banco de dados nem backend.
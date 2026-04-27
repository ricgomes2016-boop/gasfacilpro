Vou ajustar a tela `/vendas/nova` focando exatamente nos pontos mostrados nos prints: fundo branco com fonte invisível, ícones dos métodos de pagamento sem contraste e cards de Produto/Pagamento menores que o card superior.

Plano de implementação:

1. Corrigir contraste dos atalhos de pagamento
- Trocar os botões de pagamento que hoje usam fundo muito claro/branco por cards com superfície consistente (`bg-card`) e borda/tinta de marca.
- Garantir que texto e ícones usem cores explícitas (`text-foreground`, `text-primary`, `text-success`, etc.) para não herdarem branco indevidamente.
- Ajustar o estado selecionado para usar o gradiente azul/roxo do menu, com texto branco somente nesse caso.

2. Corrigir contraste dos atalhos de produto
- Aplicar o mesmo padrão visual aos cards de produtos principais.
- Evitar que imagens/ícones fiquem “apagados” em card branco, usando moldura interna com contraste e texto escuro no card normal.
- Manter o destaque visual quando o produto estiver selecionado.

3. Padronizar fundo e texto das superfícies internas
- Revisar `venda-modern-surface`, campos de busca, área de adicionar pagamento, selects e inputs dentro das etapas.
- Garantir que áreas claras usem texto escuro e que o branco só apareça sobre gradiente/fundo escuro.

4. Ajustar largura proporcional dos cards
- Em `NovaVenda.tsx`, remover a largura menor da etapa Produto (`max-w-5xl`) e alinhar Produto e Pagamento ao mesmo padrão do card superior.
- Usar `w-full max-w-6xl` ou largura equivalente para Produto, Pagamento e demais etapas principais, mantendo responsividade.
- Confirmar que em viewport médio, como o atual 1006x672, os cards ocupem a largura proporcional correta.

5. Manter o padrão de cores do sistema
- Não alterar cores semânticas importantes: verde para sucesso/pagamento, vermelho para erro/vale gás quando aplicável, amarelo para alerta.
- Usar azul/roxo do menu para destaque principal e seleção, sem voltar para laranja.

Arquivos previstos:
- `src/pages/vendas/NovaVenda.tsx`
- `src/components/vendas/PaymentSection.tsx`
- `src/components/vendas/ProductSearch.tsx`
- `src/index.css`

Validação:
- Rodar verificação TypeScript após as mudanças.
- Revisar visualmente pela estrutura das classes para garantir que não haja texto branco em fundo branco nas etapas Produto e Pagamento.
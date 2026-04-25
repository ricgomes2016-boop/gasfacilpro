Plano para deixar o fluxo de venda com visual igual ao card do dashboard enviado:

1. Criar um fundo principal do fluxo de venda no estilo dashboard
   - Aplicar um fundo laranja/vermelho moderno na área da etapa ativa da venda.
   - Usar a mesma sensação visual do exemplo: superfície quente, bordas arredondadas, sombras suaves e decoração discreta tipo chama/círculos no fundo.
   - Manter sem gradiente nos cards internos, conforme pedido anterior; o efeito visual ficará no container principal e nas transparências.

2. Transformar os cards internos em “glass cards” transparentes
   - Alterar `.venda-card`, `.venda-modern-surface`, atalhos de produto e atalhos de pagamento para usar fundo branco transparente sobre o laranja.
   - Bordas claras/translúcidas, parecidas com o dashboard.
   - Remover aparência clara/cinza atual que está deixando diferente do modelo.

3. Padronizar textos brancos e nítidos dentro dos cards
   - Forçar títulos, labels, textos, valores e ícones principais do fluxo de venda para branco ou branco translúcido.
   - Ajustar `text-muted-foreground`, badges, totais, cabeçalhos de tabela e estados vazios para não ficarem cinza apagado sobre o fundo laranja.
   - Preservar contraste em campos editáveis para manter leitura e digitação fáceis.

4. Ajustar atalhos e estados selecionados
   - Produtos principais e formas de pagamento ficarão como mini-cards transparentes, com ícone/foto e texto branco.
   - Estado selecionado/hover usará borda branca mais forte e leve fundo branco translúcido.
   - Manter a lógica atual de clique e atalhos; a mudança é visual.

5. Preservar estabilidade do fluxo
   - Não alterar rotas, providers, regras de venda, banco de dados ou lógica de pagamento/produto.
   - Alterações previstas principalmente em `src/index.css`; se necessário, pequenos ajustes de classes nos componentes de venda para garantir que todos os subtítulos e estados sigam o padrão.

Arquivos previstos:
- `src/index.css`
- Possíveis ajustes pontuais em:
  - `src/pages/vendas/NovaVenda.tsx`
  - `src/components/vendas/ProductSearch.tsx`
  - `src/components/vendas/PaymentSection.tsx`
  - `src/components/vendas/DeliveryPersonSelect.tsx`
  - `src/components/vendas/OrderSummary.tsx`
  - `src/components/vendas/CustomerSearch.tsx`
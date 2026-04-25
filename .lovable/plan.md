Plano para deixar a tela Nova Venda visivelmente mais moderna, mantendo cada etapa com sua própria cor.

1. Criar um visual premium por etapa
- Trocar o fundo atual do container da etapa por cores mais profundas e elegantes, inspiradas nos cards de Acesso Rápido do dashboard.
- Manter as cores por etapa: Cliente amber, Produtos teal, Pagamento indigo, Entregador rose e Confirmar emerald.
- Usar uma base escura/saturada com luzes decorativas sutis para dar profundidade, mas sem deixar o card interno pesado.

2. Modernizar os cards internos com glassmorphism real
- Aumentar raio de borda, transparência, blur e sombra dos cards principais.
- Deixar os cards internos claramente transparentes, com borda branca suave e brilho interno.
- Remover interferências antigas que ainda deixam alguns blocos com aparência acinzentada ou “chapada”.

3. Padronizar texto branco e hierarquia visual
- Garantir títulos, labels, textos auxiliares, totais, badges, cabeçalhos de tabela e estados vazios em branco ou branco translúcido.
- Ajustar ícones e chips para parecerem parte do glass card, não como componentes padrão cinza.
- Preservar campos editáveis com fundo claro ou semitransparente legível para digitação.

4. Melhorar atalhos e botões
- Transformar atalhos de produtos, pagamentos e entregadores em mini-cards modernos com hover mais evidente, elevação leve e estado selecionado com borda branca/anel luminoso.
- Ajustar botões principais do fluxo para combinar com a cor da etapa e ter aparência mais premium.
- Manter sem alterações na lógica de clique, busca, pagamento ou finalização.

5. Ajustes pontuais no layout da Nova Venda
- Refinar o bloco do stepper/topo para não destoar do visual moderno.
- Adicionar classes auxiliares apenas onde necessário para separar shell, cards de apoio e controles.
- Não alterar rotas, providers, banco de dados, regras de venda ou fluxo operacional.

Arquivos previstos:
- `src/index.css`
- `src/pages/vendas/NovaVenda.tsx` somente se for necessário adicionar classes de apoio ao layout
- Possíveis ajustes mínimos nos componentes de venda apenas para classes visuais: `ProductSearch`, `PaymentSection`, `DeliveryPersonSelect`, `OrderSummary`, `CustomerSearch`, `CustomerHistory`

Validação:
- Conferir a tela `/vendas/nova` no viewport atual.
- Verificar pelo menos as etapas Cliente, Produtos, Pagamento, Entregador e Confirmar.
- Rodar verificação TypeScript para garantir que as mudanças visuais não quebraram a aplicação.
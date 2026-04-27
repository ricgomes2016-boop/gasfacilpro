Vou ajustar a identidade visual dos cards para ficar mais leve: manter cor como detalhe de orientação, mas remover fundos sólidos muito fortes nos títulos e botões.

Plano:

1. Padronizar os cabeçalhos de cards do sistema
   - Trocar os fundos sólidos de `section-header-primary`, `section-header-catalog`, `section-header-stock`, `section-header-finance` e `section-header-critical` por versões suaves.
   - Em vez de cabeçalho todo azul/amarelo/verde/vermelho, usar fundo branco/card com uma faixa discreta, borda leve e ícone com tom suave.
   - Manter cada área com sua cor de referência, mas em baixa intensidade.

2. Ajustar a tela Nova Venda
   - O título “Cliente” deixará de ter fundo azul sólido.
   - Os títulos das etapas seguirão o novo padrão: card branco, texto escuro, ícone colorido discreto.
   - Manter a leitura visual das etapas sem pesar a tela.

3. Ajustar a Dashboard
   - “Acesso Rápido”: remover o cabeçalho amarelo sólido e aplicar o novo cabeçalho neutro com destaque sutil.
   - Botões do Acesso Rápido: reduzir a intensidade dos botões coloridos, usando fundo suave/borda/ícone colorido em vez de blocos sólidos muito fortes.
   - “Meta Diária”: remover o cabeçalho verde sólido e aplicar destaque verde discreto.
   - “Entregadores”: remover o cabeçalho azul sólido e aplicar destaque azul discreto.

4. Preservar contraste e hierarquia
   - Textos principais ficarão em `foreground/card-foreground` para melhor leitura.
   - Cores serão usadas em ícones, bordas, barras laterais ou badges, não como grandes áreas sólidas.
   - Evitar deixar tudo cinza: a tela continuará colorida, mas com aparência mais profissional e menos pesada.

Detalhes técnicos:

- Arquivo principal de paleta: `src/index.css`
  - Atualizar as classes globais `section-header-*` e `section-header-icon-frame`.
- Nova Venda:
  - Reaproveitar `VendaSectionHeader` em `src/components/vendas/VendaSectionHeader.tsx` sem precisar mudar a estrutura, apenas o estilo global.
- Dashboard:
  - Ajustar `src/components/dashboard/QuickActions.tsx` para trocar os tons sólidos dos botões por classes mais suaves.
  - Conferir `DailySalesGoal.tsx` e `DeliveryDriverStatus.tsx`, que já usam `section-header-*`, para garantir que herdem o novo padrão.

Validação:

- Rodar verificação TypeScript após os ajustes.
- Conferir visualmente se os exemplos citados ficaram mais leves: Nova Venda > Cliente, Dashboard > Acesso Rápido, Meta Diária e Entregadores.
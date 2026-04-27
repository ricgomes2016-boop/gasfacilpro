Plano para atualizar o tema SaaS Moderno com base na imagem enviada

Objetivo
- Transformar o tema “SaaS Moderno” em um visual mais próximo do dashboard de referência: menu lateral roxo com topo arredondado, item ativo claro em formato pill, cards brancos grandes, fundo cinza-claro, cores de destaque vibrantes e espaçamento mais limpo.
- Manter lógica, rotas e funcionalidades intactas.

Extração visual da referência
- Menu: roxo dominante, lateral esquerda larga, cantos superiores/direitos bem arredondados, item ativo em cápsula cinza-clara/branca, textos brancos e rodapé decorativo abstrato em baixa opacidade.
- Fundo geral: cinza muito claro.
- Cards: brancos, arredondados, sem bordas pesadas, sombra suave.
- Destaques: roxo principal, verde, amarelo, coral/rosa e teal para indicadores/KPIs.
- Header: branco, limpo, busca/ações com botões arredondados.
- Estrutura: módulos separados por cards grandes, espaçamento consistente, visual SaaS educacional/fintech moderno.

Implementação proposta

1. Atualizar tokens do tema SaaS
- Ajustar `brand-theme-saas` em `src/styles/brand-themes.css` para a paleta extraída:
  - Roxo menu/brand: aproximadamente `#5B4A92` / `#65539C`
  - Fundo: `#F4F6F8`
  - Cards: `#FFFFFF`
  - Texto: `#15151A`
  - Muted: cinzas suaves
  - Verde: `#39BE69`
  - Amarelo: `#FFC107`
  - Coral: `#F08080`
  - Teal: manter `#2EC4B6` como apoio/acento do tema criado
- Preservar o nome “SaaS Moderno” em Personalização Visual, mas atualizar a prévia/gradiente para refletir o novo roxo + verde/amarelo/coral.

2. Recriar o menu lateral no formato da imagem
- Em `src/components/layout/Sidebar.tsx`, manter a mesma árvore de menus e navegação.
- Alterar somente classes visuais:
  - Lateral com fundo roxo sólido/gradiente sutil.
  - Bordas direitas mais arredondadas, especialmente no topo.
  - Item ativo com fundo claro, texto roxo e formato pill.
  - Itens inativos com texto branco e hover translúcido.
  - Submenus mais leves, com pills menores.
  - Rodapé/decoração abstrata usando pseudo-elementos globais, sem adicionar imagem externa.
- Aplicar o mesmo padrão em `MobileNav`, pois ele já usa `app-sidebar-premium`.

3. Ajustar superfícies globais do SaaS
- Em `src/index.css`, escopar estilos para `.brand-theme-saas`:
  - `system-surface` com fundo cinza-claro.
  - `app-header-premium` branco, sombra suave e divisórias leves.
  - Cards com raio maior, sombra suave, borda quase invisível.
  - Inputs e botões com formato arredondado, foco em roxo/teal.
  - Tabelas com cabeçalho leve e linhas “respirando”, evitando grid pesado.

4. Padronizar KPIs e blocos coloridos
- Atualizar utilitários `.kpi-card-*`, `.status-card-icon-*`, `.section-header-*` para combinar com a referência:
  - KPIs em cards brancos com linha lateral colorida.
  - Ícones coloridos por categoria.
  - Títulos sem fundo branco quebrado; sempre legíveis.
  - Headers de seção mais limpos, com fundo suave ou sólido conforme necessidade.

5. Atualizar a opção em Personalização Visual
- Em `src/pages/config/PersonalizacaoVisual.tsx`:
  - Atualizar descrição do preset “SaaS Moderno” para indicar “roxo, verde, amarelo e coral inspirado em dashboard SaaS”.
  - Atualizar bolinha/gradiente de prévia.
  - Garantir que ao clicar nesse tema ele aplique `brandThemeId: "saas"` corretamente.

Validação
- Rodar verificação TypeScript após alterações.
- Conferir visualmente que:
  - O tema SaaS aparece em Personalização Visual.
  - O menu fica roxo com item ativo claro em pill.
  - Cards e header seguem o estilo da imagem.
  - Dashboard, Vendas, Pedidos e Configurações mantêm estrutura e funcionamento.

Arquivos previstos
- `src/styles/brand-themes.css`
- `src/index.css`
- `src/components/layout/Sidebar.tsx`
- `src/pages/config/PersonalizacaoVisual.tsx`

Sem alterações em banco de dados, rotas, autenticação ou regras de negócio.
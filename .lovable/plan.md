Plano para criar e aplicar o Tema Global SaaS em todo o sistema

Objetivo
Criar um tema visual global, moderno e consistente, baseado na paleta informada, aplicado via tokens e classes reutilizáveis para evitar mistura de estilos, desalinhamento e títulos com contraste incorreto, sem alterar lógica, rotas ou funcionalidades.

O que será feito

1. Criar o tema em Personalização Visual
- Adicionar um novo preset em “Tema de marca” na tela de Aparência/Personalização Visual.
- Nome sugerido: “SaaS Moderno”.
- Esse preset aplicará a paleta solicitada quando selecionado.
- Manter os temas atuais existentes, sem removê-los.

2. Definir tokens globais do tema
Aplicar a paleta como variáveis globais reutilizáveis:
- Primary: #2EC4B6
- Secondary: #6C63FF
- Accent: #FF9F43
- Background: #F5F6FA
- Surface/Card: #FFFFFF
- Texto principal: #2F2F2F
- Texto secundário: #8A8FA3
- Success: #4CAF50
- Warning: #FFC107
- Info/Azul: #3F8CFF
- Roxo: #6C63FF

Também manter:
- Border radius global: 16px
- Espaçamento/padding padrão: 16px a 20px
- Sombra leve e consistente
- Sem alterar estrutura de grid existente

3. Padronizar componentes base
Atualizar os componentes globais já usados pelo sistema para que o tema seja aplicado em todas as telas sem reescrever cada página:
- Card: fundo branco, raio 16px, borda leve, sombra suave.
- CardHeader/CardTitle/CardDescription: títulos legíveis, espaçamento consistente e contraste correto.
- Button: foco/hover alinhado à cor primary.
- Input/Textarea/Select: arredondados, borda leve, foco primary.
- Badge: status com cores suaves e legíveis.
- Table: sem grid pesado, linhas espaçadas, hover leve.
- Calendar: dias em formato pill, dia ativo em primary.

4. Consolidar classes reutilizáveis do Design System
Ajustar/criar classes globais para uso uniforme:
- `modern-panel`
- `modern-soft-panel`
- `modern-status-card`
- `kpi-card`
- `kpi-card-*`
- `section-header-*`
- `status-pill`
- `calendar-pill`
- `saas-table`
- classes de cards de destaque com fundo sólido e texto branco

Essas classes serão responsáveis por manter o padrão visual em Dashboard, Vendas, Pedidos, Estoque, Financeiro, Configurações e demais telas que já usam os componentes globais.

5. KPI Cards
Padronizar os KPI cards globalmente:
- Ícone + título + número grande.
- Linha lateral colorida.
- Card branco com sombra leve.
- Cores por tipo: primary, info, success, warning, destructive/accent.
- Evitar transformação automática agressiva de qualquer card com número grande, para não converter cards comuns em cards coloridos indevidamente.

6. Sidebar
Ajustar visual da sidebar mantendo a estrutura atual e o comportamento de recolher/expandir:
- Gradiente vertical do topo #2EC4B6 até base #6C63FF.
- Normal: texto/ícones brancos com opacidade ~70%.
- Hover: fundo branco transparente.
- Ativo: fundo branco, texto #2F2F2F, formato pill.
- Largura atual preservada.
- Adicionar decoração flat/abstrata de baixa opacidade no rodapé integrada ao gradiente, sem virar um bloco separado.

7. Cabeçalhos dos cards em todas as telas
Reforçar o sistema global de `section-header-*` para que títulos e ícones sempre tenham contraste correto:
- Primary/Teal
- Catalog/Info Azul
- Stock/Amarelo
- Finance/Verde
- Critical/Vermelho
- Muted/Neutro claro

Isso evita novamente casos de texto branco em fundo branco.

8. Tabelas e status
Padronizar tabelas globais:
- Cabeçalho limpo.
- Corpo com linhas espaçadas e fundo branco.
- Hover suave.
- Sem grid pesado.

Status globais:
- Pendente: amarelo.
- Em rota: azul/teal.
- Entregue: verde.
- Cancelado/erro: vermelho.

9. Gráficos e cards de destaque
- Ajustar tokens e classes para gráficos usarem cores suaves e consistentes.
- Criar padrão para cards de destaque com fundo verde/roxo/amarelo, texto branco quando necessário e cantos arredondados.

10. Validação
Após implementar:
- Rodar verificação TypeScript.
- Revisar visualmente os pontos críticos já citados: Dashboard, Venda etapa Cliente/Produto, Pedidos, Entregas e Configurações > Aparência.
- Garantir que não houve alteração de lógica, rotas, autenticação, banco de dados ou fluxos funcionais.

Arquivos que devem ser alterados
- `src/lib/brandThemes.ts`: adicionar o preset “SaaS Moderno”.
- `src/styles/brand-themes.css`: adicionar a classe do novo tema com a paleta completa.
- `src/index.css`: consolidar tokens/classes globais, cards, KPI, tabelas, calendário, headers, status e sidebar.
- `src/components/layout/Sidebar.tsx`: ajustar somente classes visuais de estado ativo/hover e decoração integrada.
- `src/components/ui/card.tsx`: padronizar base visual dos cards.
- `src/components/ui/button.tsx`: alinhar botões ao tema.
- `src/components/ui/input.tsx`: alinhar inputs ao tema.
- `src/components/ui/table.tsx`: reforçar tabela SaaS global.
- `src/components/ui/badge.tsx`: reforçar status/badges.
- `src/components/ui/calendar.tsx`: aplicar pill e primary no dia ativo.
- `src/pages/Configuracoes.tsx`: apenas pequenos ajustes visuais nos botões de seleção do tema, se necessário, para aparecer como “Personalização Visual” de forma clara.

Restrições seguidas
- Não alterar `App.tsx`, rotas ou provider nesting.
- Não alterar lógica de negócio.
- Não alterar banco de dados.
- Não alterar autenticação.
- Não mexer em arquivos gerados automaticamente.
- Não refatorar estrutura das páginas.
- Não alterar grids existentes, apenas estilos globais e classes visuais.
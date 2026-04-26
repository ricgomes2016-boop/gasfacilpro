Vou corrigir a desconfiguração visual mantendo a lógica de cores semânticas, mas aplicando de forma mais equilibrada: menos blocos sólidos grandes e mais cards modernos com acentos/contexto.

Escopo da revisão

1. Contas a Pagar
- Revisar os cards de KPI, filtros, resumo por fornecedor e lista principal.
- Trocar cards muito “chapados” por cards modernos com fundo neutro, borda arredondada e ícone/valor com cor semântica.
- Garantir que filtros e botões não quebrem no mobile/tablet.

2. Pedidos
- Revisar alertas, sugestão inteligente, filtros, cards de status, barra de seleção em lote e tabela/lista mobile.
- Reduzir excesso de cards sólidos com `bg-success/bg-warning/bg-info`; usar tons suaves e acentos coloridos.
- Padronizar altura, espaçamento e arredondamento dos cards de status.
- Corrigir áreas que ficaram muito fortes ou desalinhadas depois da última mudança.

3. Cadastro de Clientes
- Revisar toolbar, cards de estatísticas, filtros avançados e lista de clientes.
- Aplicar cards semânticos modernos para: total, ativos, residenciais e comerciais.
- Modernizar o painel de filtros para não parecer “remendado” ou quadrado.

4. Toda Gestão de Clientes
Vou revisar e ajustar, página por página, as rotas:
- `/clientes/cadastro`
- `/clientes/:id`
- `/clientes/promocoes`
- `/clientes/marketing`
- `/clientes/campanhas`
- `/clientes/fidelidade`
- `/clientes/crm`
- `/clientes/ranking`
- `/clientes/credito`
- `/clientes/contratos`
- `/clientes/indicacao`
- `/clientes/aplicativo`

Nessas páginas, vou:
- Corrigir cards com bordas quadradas ou estilos inconsistentes.
- Substituir cores hardcoded antigas (`green`, `blue`, `orange`, `primary` excessivo) por tokens semânticos.
- Evitar fundos sólidos em excesso; usar fundo neutro + ícones, badges e bordas coloridas.
- Ajustar headers de seções para cores que combinem com o conteúdo, sem deixar páginas inteiras “verdes”.
- Corrigir classes Tailwind dinâmicas inválidas, como `border-${cor}`, que podem não ser geradas corretamente.

5. Auditoria visual geral
- Procurar em `src/pages` e `src/components` por usos problemáticos de:
  - `bg-primary` em cards/headers grandes
  - `bg-success text-success-foreground` aplicado em muitos cards
  - classes hardcoded como `bg-green-*`, `text-green-*`, `border-blue-*`
  - headers sólidos sem contexto
- Ajustar apenas as páginas afetadas, sem refatorar estrutura global, rotas ou providers.

Diretriz visual

```text
Card principal: fundo neutro, borda suave, sombra moderna
Status/KPI: acento semântico por ícone, borda ou faixa lateral
Headers: cor semântica apenas quando fizer sentido
Evitar: telas inteiras verdes ou muitos cards sólidos lado a lado
```

Validação
- Rodar verificação TypeScript/build após as alterações.
- Conferir que não houve quebra em rotas, imports ou componentes compartilhados.
- Preservar a estabilidade do sistema: não alterar `App.tsx`, provider nesting nem rotas.
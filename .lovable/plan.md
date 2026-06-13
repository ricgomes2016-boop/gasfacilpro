## Toggle "Em sequência" no Bolão (Admin + Entregador)

Substitui o filtro de data por um toggle único. Quando ativo, lista todos os jogos em ordem cronológica agrupados por dia (11/06, 12/06, 13/06…). Quando inativo, mantém o agrupamento por fase atual.

### `src/pages/operacional/BolaoAdmin.tsx`
- Remover state `dataFiltro` e o `<Select>` de data.
- Adicionar state `modoSequencia: boolean` (default `false`).
- Adicionar `<Toggle>` (shadcn) com ícone `CalendarRange` + label "Em sequência" na barra de filtros, ao lado de Status/Fase.
- Quando `modoSequencia === true`: ignorar agrupamento por fase, ordenar `jogosFiltrados` por `data_jogo` ASC e renderizar grupos por dia (`dd/MM (EEE)`) com o mesmo sticky header visual já usado por fases. Busca + Status + Fase continuam aplicáveis.
- Quando `false`: mantém render atual por `FASE_ORDEM`/grupos sem alterações visuais.

### `src/pages/entregador/EntregadorBolao.tsx`
- Remover state `dataFiltro` e o `<Select>` de data.
- Adicionar state `modoSequencia: boolean` (default `false`).
- Adicionar `<Toggle>` compacto no topo da aba Jogos: ícone `CalendarRange` + "Em sequência".
- Quando `true`: lista cronológica única agrupada por dia (`dd/MM (EEE)`), cada grupo com cabeçalho de data acima dos `JogoCard`s.
- Quando `false`: mantém render atual por fase.

### Validação contra fonte oficial
Antes de implementar, abrir a página oficial da FIFA (`https://www.fifa.com/.../fifaworldcup`) para confirmar que a ordenação por `data_jogo` ASC reproduz a sequência oficial de jogos (11/06 abertura, depois 12/06, 13/06…). Sem mudanças em `fixture2026.ts` a menos que apareça divergência — nesse caso, reportar ao usuário antes de editar dados.

### Fora de escopo
Hooks, schema, abas Desempenho/Ranking, filtros existentes (busca, status, fase), `fixture2026.ts` (a menos que divergência seja detectada e aprovada).
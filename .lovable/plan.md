## Filtro por data nos jogos do Bolão

Adicionar um seletor de data nas duas telas, mantendo todos os filtros e layout atuais intactos.

### O que muda

**`src/pages/operacional/BolaoAdmin.tsx`** (admin)
- Novo estado `dataFiltro` (default `"todas"`).
- Lista `datasDisponiveis` derivada de `jogos`, ordenada crescente (11/06, 12/06, 13/06…), exibida como `dd/MM (qua)`.
- Incluir a condição no `useMemo` de `jogosFiltrados` comparando `yyyy-MM-dd` local.
- Renderizar `<Select>` ao lado dos filtros de Status/Fase, com `w-full sm:w-[170px]`.

**`src/pages/entregador/EntregadorBolao.tsx`** (app entregador)
- Mesma lógica: estado, `datasDisponiveis` ordenada crescente, filtro aplicado à lista, `<Select>` acima da lista de jogos com largura mobile-friendly.

### Fora do escopo
`fixture2026.ts`, hooks, banco, rotas, mata-mata, e qualquer alteração nos filtros/visual já existentes.



## Mostrar nomes dos entregadores no quadro de Cobertura Horária

### Problema
No heatmap da aba "Cobertura Horária", as células mostram apenas o **número** de entregadores ativos naquela hora, mas o usuário quer ver também os **nomes** diretamente — sem precisar passar o mouse para abrir o tooltip (especialmente no mobile, onde hover não funciona bem).

### Mudança

Em `src/pages/rh/Horarios.tsx`, dentro do componente `CoberturaTab`:

**1. Heatmap — exibir nomes na célula**
- Cada célula passa a mostrar:
  - Linha 1: número grande (contagem) + ícone 🔥 quando aplicável.
  - Linha 2+: **primeiro nome** de cada entregador, um por linha, em texto pequeno (`text-[10px]`), com `truncate`.
  - Se houver mais de 3 nomes, mostra os 3 primeiros + `+N` (ex.: "Bruno", "Samuel", "Giovanni", "+2").
- Largura mínima da célula aumenta para `min-w-[90px]` para caber os nomes.
- Tooltip continua mostrando a lista completa com nome + unidade (útil para ver quem é o "+2").
- Em telas pequenas (mobile, viewport atual 384px), os nomes ficam ocultos automaticamente (`hidden sm:block`) para não quebrar — fica só o número e o tooltip/clique.

**2. Modo "Lista por dia"** já mostra os nomes — sem alteração.

**3. Ajuste fino de cor**
- Texto dos nomes usa `text-muted-foreground` para não competir com o número da contagem.

### Arquivo
- **Editar**: `src/pages/rh/Horarios.tsx` (apenas render das células do heatmap em `CoberturaTab`).
- Sem migrations, sem novas queries.

### Critério de aceite
- Cada célula do heatmap mostra contagem + lista de primeiros nomes (até 3, com `+N` para o resto).
- Tooltip mantém lista completa nome + unidade.
- Em mobile a célula mostra apenas o número (sem quebrar layout).
- Demais funcionalidades (toggle cidade, lista por dia, picos ★, buracos de cobertura) permanecem intactas.


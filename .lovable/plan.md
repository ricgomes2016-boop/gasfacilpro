

## Ajustar largura da coluna "Entregador" na grade de escalas

### Problema
A primeira coluna (nome do entregador) está ocupando espaço demais na grade semanal, comprimindo as 7 colunas de dias e prejudicando a leitura dos turnos.

### Mudança

Em `src/pages/rh/Horarios.tsx`, no `<TableHead>` e `<TableCell>` da coluna do entregador (sticky left):

- Reduzir largura: de largura livre para **`w-40 max-w-[160px]`** (desktop) e **`w-32 max-w-[128px]`** (mobile).
- Reduzir padding lateral: `px-2` em vez do `p-4` padrão.
- Nome do entregador com `truncate` + `title={nome}` para mostrar completo no hover.
- Avatar/iniciais (se houver) ficam menores (`h-7 w-7`).
- Colunas dos dias passam a usar `min-w-[110px]` para aproveitar o espaço liberado.
- Manter `sticky left-0 bg-background z-10` para a coluna continuar fixa no scroll horizontal.

### Arquivo
- **Editar**: `src/pages/rh/Horarios.tsx` (apenas estilos da coluna entregador na grade de `EscalasTab`).

### Critério de aceite
- Coluna "Entregador" fica visivelmente mais estreita.
- Nomes longos truncam com `…` e aparecem por completo no hover.
- Colunas dos dias ficam mais largas e legíveis.
- Coluna do entregador continua fixa ao rolar horizontalmente.


## Objetivo
Remover o formato pílula (`rounded-full`) das badges para que sigam o raio do tema ativo, mantendo consistência com cards/tabelas (que já usam `var(--radius)`).

## Mudança
**`src/components/ui/badge.tsx`** — trocar `rounded-full` por `rounded-[var(--radius)]` na classe base do `badgeVariants`.

Isso afeta automaticamente todas as badges do sistema (incluindo a de Origem "🖥️ ERP" e a do entregador "Marcos Antônio" na tabela de Pedidos), sem precisar editar cada ocorrência.

## Por que apenas isso
- O wrapper global `.app-card` já normaliza inputs/elementos arredondados aninhados, mas badges são renderizadas em qualquer contexto — corrigir no componente base é o ponto único de verdade.
- Mantém o tema clássico/premium/clean coerentes: o raio passa a ser ditado pelo token `--radius` definido em cada brand-theme.
- Nenhuma alteração de cor, padding ou tipografia da badge.

## Verificação
Recarregar `/vendas/pedidos` e conferir que as badges de origem e entregador ficam com cantos no padrão do tema (não mais pílula), e que badges em outras telas (status, KPIs, etc.) continuam legíveis.
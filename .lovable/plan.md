## Mostrar todos os funcionários na aba Programação de Férias

### Causa do problema
A query atual de `funcionarios` em `src/pages/rh/Ferias.tsx` filtra por `unidade_id` da unidade selecionada no contexto global. Por isso a aba Programação só mostra funcionários da unidade ativa, e não "todos por loja" como o layout do PDF pede.

### Mudanças

**1. `src/pages/rh/Ferias.tsx`**
- Adicionar query `funcionariosTodos` (filtrada apenas por `empresa_id` via RLS, sem `unidade_id`) usada exclusivamente na aba Programação.
- Adicionar query `feriasTodos` (sem filtro de unidade) para cruzar gozo/abono de todos os funcionários.
- Manter as queries atuais (`funcionarios`, `ferias`) intactas para a aba Registros e o modal de cadastro.
- Ajustar o `useMemo` `programacao` (e `programacaoPorUnidade`) para consumir `funcionariosTodos` + `feriasTodos`.
- Adicionar empty state claro quando não houver funcionário com `data_admissao` preenchida.

**2. `src/components/ui/badge.tsx`**
- Converter `Badge` para `React.forwardRef<HTMLDivElement, BadgeProps>` para eliminar warnings de ref ao ser usado em células de tabela e tooltips densos.

### Sem mudanças
- Sem migrations, sem alteração em RLS, sem mudanças em outras páginas, sem tocar em `App.tsx`/providers.

### Critério de aceite
- Aba Programação lista **todos** os funcionários ativos da empresa, agrupados por unidade, com cabeçalho da loja e contagem de empregados.
- Trocar a unidade no seletor global **não** esconde funcionários na aba Programação.
- Aba Registros continua filtrada pela unidade atual (comportamento atual preservado).
- Console sem warning de ref do Badge.

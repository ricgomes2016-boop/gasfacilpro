## Aba "Programação de Férias" em RH/Férias

Refatorar `src/pages/rh/Ferias.tsx` para usar `Tabs` com duas abas:

### Aba 1: "Registros" (atual)
- Mantém integralmente o conteúdo existente: botão Registrar Férias, alertas de vencidas, cards de resumo, tabela de registros e impressão de recibo PDF.

### Aba 2: "Programação"
Nova tabela consolidada com 1 linha por funcionário ativo. Colunas:

1. **Funcionário** — nome
2. **Data Admissão** — `funcionarios.data_admissao` formatada
3. **Vencimento** — fim do período aquisitivo atual (admissão + N anos)
4. **Férias Vencidas** — badge vermelho se passou do limite concessivo (12 meses após fim aquisitivo)
5. **Férias Proporcional** — `(meses_trabalhados_no_ciclo_atual / 12) * 30` em dias
6. **Início Aquisitivo** — início do ciclo atual (último aniversário de admissão)
7. **Fim Aquisitivo** — início + 1 ano
8. **Início Gozo** — `data_inicio` do registro de férias do ciclo atual (se houver)
9. **Dias** — `dias_gozados` do registro
10. **Abono** — `dias_vendidos` do registro
11. **13º** — proporcional do 13º acumulado no ano (`(meses_no_ano / 12) * salario`)
12. **Dias Direito** — 30 (fixo CLT)
13. **Dias Gozo** — soma de `dias_gozados` no ciclo
14. **Dias Restantes** — `30 - dias_gozados - dias_vendidos`
15. **Limite p/ gozo** — fim do período concessivo (fim aquisitivo + 12 meses), com cor: vermelho (vencido), amarelo (<60 dias), verde (ok)

### Lógica de cálculo (client-side)
- Para cada funcionário ativo, calcular ciclo aquisitivo atual baseado em `data_admissao`:
  - `anos_completos = floor((hoje - admissao) / 365.25)`
  - `inicio_aquisitivo = admissao + anos_completos anos`
  - `fim_aquisitivo = inicio_aquisitivo + 1 ano`
  - `limite_concessivo = fim_aquisitivo + 1 ano`
- Cruzar com registros de `ferias` cujo `periodo_aquisitivo_inicio` bata com o ciclo atual.
- Proporcional: meses entre `inicio_aquisitivo` e hoje (cap em 12) × 2.5 dias.
- 13º proporcional: meses trabalhados no ano corrente × (salário / 12).

### UX
- Filtro de busca por nome no topo.
- Toggle "Mostrar apenas pendentes/vencidas".
- Scroll horizontal no `Table` (já vem do componente shadcn).
- Badges coloridos para status de cada coluna crítica.
- Botão "Exportar PDF" da programação completa (opcional, pode ser uma fase 2 — implementar agora apenas o botão chamando `window.print()` por simplicidade).

### Arquivos
- **Editar**: `src/pages/rh/Ferias.tsx` (envolver conteúdo atual em Tabs + criar aba Programação).

### Sem mudanças
- Sem migrations, sem novas tabelas, sem mudanças em outras páginas.

### Critério de aceite
- Página `RH/Férias` exibe duas abas no topo: Registros e Programação.
- Aba Programação lista todos os funcionários ativos com as 15 colunas calculadas corretamente.
- Filtro de busca e toggle funcionam.
- Aba Registros permanece 100% funcional como hoje.
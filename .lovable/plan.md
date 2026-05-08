## Melhorias na tela "Despesas" (Portal do Transporte)

Arquivo: `src/pages/transportadora/TranspLancamento.tsx`

### 1. Filtros no topo (acima da listagem)
- **Período**: presets `Mês atual` (default) · `Mês anterior` · `Últimos 30 dias` · `Personalizado` (campos `data inicial` e `data final`).
- **Tipo de despesa**: select com os mesmos `TIPOS_DESPESA` + opção "Todos".
- **Veículo**: select com placas ativas + "Todos" + "Sem veículo".
- **Busca**: input texto para descrição.
- **Botão "Limpar filtros"**.
- Remover o `.limit(50)` do query — paginar/filtrar no client a partir do período selecionado, ou filtrar direto na query por `data` (recomendado para performance: filtrar por intervalo no Supabase).

### 2. Cards de resumo (KPIs reativos aos filtros)
4 cards no topo:
- **Total no período** (R$)
- **Quantidade de lançamentos**
- **Ticket médio** (total ÷ qtd)
- **Maior despesa** (R$ + tipo)

### 3. Resumo por tipo de despesa
Card "Resumo por categoria" com tabela:
| Tipo | Qtd | Total (R$) | % do total |

Ordenado por valor desc, com barra de progresso visual no % (usando `bg-primary/20` + largura).

### 4. Resumo por veículo (quando houver despesas com `veiculo_id`)
Card "Resumo por veículo":
| Placa | Qtd | Total (R$) |

Inclui linha "Sem veículo" para despesas não atreladas.

### 5. Resumo mensal
Card "Resumo mensal" (aparece quando o período cobre >1 mês):
| Mês | Qtd | Total (R$) | Por tipo (badges resumidos) |

Ordenado desc por mês.

### 6. Conversão da listagem em tabela
Substituir o grid de cards atual por uma `Table` com colunas:
**Data · Tipo · Descrição · Veículo · Comprovante · Valor**
- Linha de rodapé (`TableFooter`) com totalizadores: qtd e soma de valores filtrados.
- Coluna "Comprovante" mostra ícone clicável quando `comprovante_url` existe (abre no storage).
- Manter o card mobile-friendly: tabela em desktop, cards empilhados em telas <640px (responsivo via classes Tailwind).

### 7. Preservar
- Botão "Nova Despesa" e fluxo de OCR não mudam.
- `TIPOS_DESPESA`, integração com Supabase, RLS e payload do insert permanecem iguais.
- Sem migração de banco.

### Detalhes técnicos
- Carregar `entregadores` ativos não é necessário (esta tela não tem motorista).
- Filtros via `useState`, derivados via `useMemo` sobre o array `despesas` retornado.
- Resumos: reduce agrupando por `tipo`, `veiculo_id` e `mes_referencia`/`data.slice(0,7)`.
- Manter tipagem `any` consistente com o restante do arquivo.

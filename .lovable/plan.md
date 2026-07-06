
## Objetivo

Permitir editar a **data** da movimentação de caixa dentro do diálogo de edição em **Caixa → Caixa do Dia**.

## Contexto técnico

A tabela `movimentacoes_caixa` não tem coluna `data` separada — a data exibida em todas as telas é o `created_at`. Portanto, editar a data = atualizar `created_at`. Como todas as telas que compartilham essa informação (Fluxo de Caixa, Despesas, Aprovar Despesas, Acerto Entregador, Fluxo Projetado, Previsão de Caixa, Exportação Contábil, Dashboards) já leem/filtram por `created_at`, elas passam a refletir a nova data automaticamente — nenhuma alteração adicional é necessária nessas telas.

## Alterações em `src/pages/caixa/CaixaDia.tsx`

1. **Estado**: adicionar `data` ao `editForm` (`{ tipo, descricao, valor, categoria, data }`).
2. **`openEditMov`**: preencher `data` com `format(new Date(mov.created_at), "yyyy-MM-dd'T'HH:mm")` para o input `datetime-local`.
3. **Diálogo de edição**: adicionar um campo `<Input type="datetime-local">` com rótulo "Data e hora", logo após o campo Tipo.
4. **`handleUpdateMov`**:
   - Validar a data.
   - Bloquear se a nova data cair em um dia com caixa fechado (`caixa_dia_bloqueado`) — mostra `toast.error` e cancela.
   - Incluir `created_at: new Date(editForm.data).toISOString()` no `update`.
5. Após salvar, recarregar a lista (já é feito) — a movimentação some/aparece conforme o filtro do dia atual da tela.

## Fora do escopo

- Não altero `Despesas.tsx`, `AprovarDespesas.tsx`, `EntregadorDespesas.tsx` nem qualquer relatório: eles já usam `created_at` e refletirão a nova data automaticamente.
- Não crio coluna nova no banco.
- Não mexo em regras de bloqueio do caixa — apenas respeito a existente para a nova data escolhida.

## Problema

A aba "Empenhos" hoje busca todos os registros da tabela `empenhos` sem filtrar pela unidade/empresa selecionada no topo do ERP. Resultado: o usuário enxerga empenhos de outras lojas/empresas misturados.

O mesmo vale para o filtro implícito ao criar/importar (parceiros e produtos já filtram, mas a listagem principal não).

## Correções

### 1. `src/components/licitacoes/EmpenhosPanel.tsx`
- Importar `useUnidade` (`@/contexts/UnidadeContext`) e `useEmpresa` (`@/contexts/EmpresaContext`) para pegar `unidadeAtual` e `empresa`.
- Trocar o `useQuery(["empenhos"])` por uma queryKey que inclua `unidadeAtual?.id` e `empresa?.id`, e aplicar filtros na consulta:
  - Se `unidadeAtual?.id` definido → `.eq("unidade_id", unidadeAtual.id)`.
  - Senão, se `empresa?.id` → `.eq("empresa_id", empresa.id)` (mostra todas as unidades da empresa ativa).
- Invalidar com a mesma key no `refresh()`.
- Trocar o botão "Novo Empenho" e "Importar Empenho" para `disabled` quando não houver `unidadeAtual` (evita inserir empenho sem unidade), com tooltip "Selecione uma unidade".

### 2. `src/components/licitacoes/EmpenhoDetalheDialog.tsx` (verificar)
- Se ele faz query separada de `vale_gas` vinculados, também filtrar por `unidade_id` para não vazar dados entre unidades. (Vou checar durante a implementação; ajuste só se necessário — RLS já protege, mas evitar request desnecessário.)

### 3. Sem mudanças de banco
- A tabela `empenhos` já tem `unidade_id` e `empresa_id` (trigger `fn_empenho_fill_empresa` preenche).  
- RLS já isola por empresa; o filtro extra é só para refletir o seletor de unidade do ERP.

## Fora de escopo
- Não alterar `NovoEmpenhoModal` (já usa `unidadeAtual` no insert).
- Não mexer em RLS nem migrações.
- Não tocar em `App.tsx`/rotas.

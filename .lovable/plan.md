## Correções no Cadastro de Clientes

### 1. Cards zerados (Total, Ativos, Residenciais, Comerciais)

**Causa**: A consulta usa `cliente_unidades` com embed `clientes!inner(...)` e filtros `eq("clientes.empresa_id", ...)` em `count: "exact", head: true`. Esse padrão de filtrar por colunas de tabela embedded com count head retorna 0 (limitação conhecida do PostgREST).

**Fix em `src/pages/clientes/CadastroClientes.tsx` (`fetchStats`)**:
- Quando há `unidadeAtual`: primeiro buscar `cliente_id`s de `cliente_unidades` para a unidade, depois fazer 4 contagens em `clientes` filtrando `.in("id", ids)` + `empresa_id` + tipo/ativo.
- Quando não há unidade: manter o caminho direto na tabela `clientes` (já funciona).
- Adicionar contagem `revendedores` (tipo = 'revendedor').

### 2. Novo card "Revendedores"

- Adicionar `revendedores: 0` no estado `stats`.
- Renderizar 5º card ao lado dos existentes (grid passa a 5 colunas em md+, mantendo 2 colunas no mobile).
- Ícone: `Store` (lucide).

### 3. Remover opção "Revenda" duplicada

- Em `CadastroClientes.tsx` linha 1087 (filtro) e 1538 (form): remover `<SelectItem value="revenda">Revenda</SelectItem>`.
- Em `src/components/clientes/ClienteFormDialog.tsx`: remover idem.
- Migration: `UPDATE clientes SET tipo = 'revendedor' WHERE tipo = 'revenda';` (2 registros) para consolidar.

### Arquivos alterados
- `src/pages/clientes/CadastroClientes.tsx` — fix stats, novo card, remoção do SelectItem duplicado
- `src/components/clientes/ClienteFormDialog.tsx` — remoção do SelectItem duplicado
- Nova migration SQL — consolidar `revenda` → `revendedor`

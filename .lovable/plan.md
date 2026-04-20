

## Melhorias: Busca de Cliente + Numeração Sequencial de Pedidos

### 1. Busca de cliente em Nova Venda — reconhecer endereço + número

**Problema atual:** `CustomerSearch.tsx` chama `autocomplete_clientes` que só pesquisa em `nome` e `telefone`. Não encontra clientes por endereço (rua) nem por "Rua X, 340".

**Solução:**
- Criar nova função RPC `autocomplete_clientes_v2` (security definer, stable) que aceita um único termo livre e procura em:
  - `nome` (ILIKE prefixo + contém)
  - `telefone` (dígitos)
  - `endereco` (ILIKE)
  - `bairro` (ILIKE)
  - `cidade` (ILIKE)
  - `numero` exato quando o termo contém dígitos
  - **Suporte combinado:** se o termo vier como `"Rua Brasil 340"` ou `"Brasil, 340"`, separa em parte textual + parte numérica e exige que **ambas** batam (rua contém "Brasil" E número = "340").
  - Usa `unaccent` + `pg_trgm` (extensões já instaladas) para tolerância a acentos e erros de digitação.
  - Filtra por `empresa_id` + opcionalmente `unidade_id` via `cliente_unidades`.
  - Ordena por score (telefone exato > nome prefixo > rua+número > similaridade).
  - Limite 12 resultados, retorna `id, nome, telefone, endereco, numero, bairro, cep, cidade`.

- Atualizar `CustomerSearch.tsx`:
  - Trocar `autocomplete_clientes` → `autocomplete_clientes_v2`.
  - Adicionar **terceiro campo de busca "Endereço/Nº"** ao lado de Telefone e Nome (mesmo dropdown de resultados unificado), opcional — ou usar o próprio campo "Endereço" já existente para também disparar busca em clientes.
  - Aumentar debounce para `350ms` (estava 300) e exigir mínimo `3` caracteres para campos textuais (mantém 2 para telefone) — reduz carga.

### 2. Pedidos — exibir número sequencial em vez do UUID curto

**Problema atual:** `Pedidos.tsx`, `PedidoViewDialog.tsx`, `usePedidos.ts` exibem `id.substring(0,8).toUpperCase()`. O campo `numero_sequencial` já existe na tabela e é preenchido pelo trigger `fn_assign_numero_pedido` (sequencial por empresa).

**Solução:**
- `src/hooks/usePedidos.ts`: incluir `numero_sequencial` no `select` e adicionar ao tipo `PedidoFormatado`.
- `src/types/pedido.ts`: adicionar `numero_sequencial: number | null`.
- `src/pages/vendas/Pedidos.tsx`:
  - Substituir `getIdCurto(p.id)` por `p.numero_sequencial ? '#' + p.numero_sequencial : '#' + getIdCurto(p.id)` (fallback para pedidos antigos sem número).
  - Aplicar nas linhas: header da lista, exportação CSV, impressão, mensagem WhatsApp, modal de detalhes.
- `src/components/pedidos/PedidoViewDialog.tsx`: mesmo tratamento.
- Adicionar busca por número sequencial no filtro da tela Pedidos (já existe filtro por texto — incluir match em `numero_sequencial`).

### 3. Cadastro de Cliente — busca por endereço + performance

**Problema atual:** RPC `buscar_clientes_paginado` só procura em `nome, telefone, cpf, codigo_cliente`. Adicionalmente, `fetchClientes` dispara **5 queries de count em paralelo a cada busca** — pesado em bases grandes.

**Solução:**
- Atualizar RPC `buscar_clientes_paginado` (via migração que recria a função) para incluir `OR endereco ILIKE '%termo%' OR bairro ILIKE '%termo%'` quando o termo tem ≥3 caracteres. Quando o termo contém dígitos isolados, também tentar match em `numero`.
- Em `CadastroClientes.tsx`:
  - **Performance**: Calcular as estatísticas (`stats` com 4 counts) **apenas no carregamento inicial e quando `unidadeAtual` muda** — não a cada digitação/paginação. Hoje recalcula a cada mudança de `debouncedSearch` e `currentPage`.
  - Aumentar debounce de `350ms` → `450ms`.
  - Aumentar mínimo de caracteres da busca para `2` (já é) mas **só dispara busca server-side** se `term.length === 0 || term.length >= 2`.
  - Adicionar placeholder no input: `"Buscar por nome, telefone, CPF, endereço, bairro ou número…"`.

### Detalhes técnicos / Arquivos

**Migrações SQL** (1 migration):
- `CREATE OR REPLACE FUNCTION autocomplete_clientes_v2(...)` — nova função
- `CREATE OR REPLACE FUNCTION buscar_clientes_paginado(...)` — recriação com endereço/bairro/número
- Garantir índices: `CREATE INDEX IF NOT EXISTS idx_clientes_endereco_trgm ON clientes USING gin (endereco gin_trgm_ops);` e equivalente para `bairro`. Acelera ILIKE em bases grandes.

**Arquivos a editar:**
- `src/components/vendas/CustomerSearch.tsx` — usar nova RPC, opcionalmente novo campo "Endereço"
- `src/hooks/usePedidos.ts` — incluir `numero_sequencial`
- `src/types/pedido.ts` — adicionar campo
- `src/pages/vendas/Pedidos.tsx` — usar `numero_sequencial` em todas as exibições + filtro
- `src/components/pedidos/PedidoViewDialog.tsx` — usar `numero_sequencial`
- `src/pages/clientes/CadastroClientes.tsx` — separar fetch de stats, ajustar debounce, atualizar placeholder

**Sem alterações em:** App.tsx, rotas, autenticação, RLS (apenas funções RPC SECURITY DEFINER novas/atualizadas).


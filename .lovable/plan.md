
## Diagnóstico

Verifiquei o banco e encontrei o motivo dos endereços "sumirem" na Forte Gás:

**Situação atual da unidade Forte Gás:**
- 55.288 clientes já vinculados via `cliente_unidades` (superset)
- 128 pedidos históricos na unidade
- **28 pedidos sem `cliente_id`** (vindos do WhatsApp) — o nome fica em `observacoes` e o endereço em `endereco_entrega` do próprio pedido. Se `endereco_entrega` estiver vazio, aparece "Endereço não informado".
- **7 pedidos com `cliente_id`** apontando para clientes da Central Gás que **não estão vinculados** à unidade Forte Gás em `cliente_unidades` (ex.: Ricardo Gomes #46, JANETE #14, CLIENTE ALFA #7 e #8, JOSE #15, MARIA #11 e #5). Como a tela de Clientes filtra por `cliente_unidades`, esses clientes não aparecem na lista da Forte Gás — logo endereço/telefone não são localizáveis a partir do cadastro.

Nenhum dado foi perdido — os pedidos, endereços salvos em `pedidos.endereco_entrega` e cadastros de clientes continuam intactos. Só falta o **vínculo** cliente↔unidade Forte Gás.

## Plano

### 1. Vincular todos os clientes da Central Gás à unidade Forte Gás
Rodar um único `INSERT ... SELECT` em `cliente_unidades` fazendo backfill:
- Para cada cliente com `empresa_id = Central Gas` (`f27e158e-7ab5-4617-9f66-c6b4a084d293`)
- Que ainda **não** possui vínculo com a unidade Forte Gás (`3a3dbca4-f9c5-4564-8f58-7ed5f6b7ed05`)
- Criar linha em `cliente_unidades (cliente_id, unidade_id)`

Isso resolve os 7 pedidos órfãos e garante que qualquer cliente antigo da Central Gás apareça também na Forte Gás (conforme pedido).

### 2. Backfill de endereço nos pedidos sem cliente_id
Para os 28 pedidos WhatsApp sem `cliente_id` cujo `endereco_entrega` esteja preenchido, nada a fazer — a tela já usa `endereco_entrega` diretamente.

Para os que estiverem com `endereco_entrega` vazio, tentar reconstruir a partir de `observacoes` (padrão "Pedido via WhatsApp - Nome (endereço)") **somente se** houver informação parseável — sem sobrescrever nada existente. Se não houver dado, mantemos "Endereço não informado" (não há como inventar).

### 3. Sem mudanças de código/UI
- `useClientes` e `usePedidos` continuam como estão.
- Nenhuma migração de schema, nenhuma alteração em RLS, `App.tsx`, rotas ou componentes.

## Detalhes técnicos

- Empresa Central Gás: `f27e158e-7ab5-4617-9f66-c6b4a084d293`
- Empresa Forte Gás: `c94c210b-8dbd-4d91-914e-2db146b8cf94`
- Unidade Forte Gás: `3a3dbca4-f9c5-4564-8f58-7ed5f6b7ed05`
- Operações via `supabase--insert` (INSERT ... ON CONFLICT DO NOTHING em `cliente_unidades`; UPDATE condicional em `pedidos.endereco_entrega`).
- `admin@fortegas.com` já é `gestor+admin`, então RLS permite leitura cross-empresa após o vínculo.

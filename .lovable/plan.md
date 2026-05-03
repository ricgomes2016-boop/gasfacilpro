## Problemas e Soluções

### 1. Bug: "Revendedor" volta para "Residencial" ao reabrir
A RPC `buscar_clientes_paginado` (usada para listar os clientes em `CadastroClientes.tsx`) **não retorna a coluna `tipo`**. Quando o usuário clica em editar, o objeto `cliente.tipo` chega como `undefined` e o form cai no fallback `"residencial"` (linha 447).

**Correção:** adicionar `tipo` (e também `cep`, `latitude`, `longitude`, `cadastro_app`) ao retorno da função SQL `buscar_clientes_paginado` via migração.

### 2. Cards zerados (Total/Ativos/Residenciais/Comerciais)
Os cards são preenchidos por `fetchStats()`, que só roda quando `empresa?.id` ou `unidadeAtual?.id` mudam. Em mobile no carregamento inicial às vezes a `unidadeAtual` chega depois e a tela mostra 0.

**Correção:** garantir refetch após salvar/excluir cliente e também quando `clientes` é carregado pela primeira vez com `totalCount > 0` mas `stats.total === 0`. Adicionar log e fallback para chamar `fetchStats` junto com `fetchClientes`.

### 3. Botão discreto "Lançar Venda" no card do cliente
Adicionar um ícone discreto (carrinho) na linha de ações de cada cliente em `CadastroClientes.tsx` que navega para `/vendas/nova?cliente_id=<id>`. Ajustar `NovaVenda.tsx` para ler o `cliente_id` da query string e pré-selecionar o cliente automaticamente.

### 4. Botão "Histórico de Compras" + "Repetir Última"
- Adicionar botão (ícone de relógio/histórico) na linha de ações de cada cliente que abre um novo dialog `HistoricoComprasDialog`.
- O dialog lista os últimos 20 pedidos do cliente (data, itens resumidos, valor, pagamento, status).
- Cada linha tem botão **"Repetir"** que navega para `/vendas/nova?cliente_id=<id>&repetir_pedido=<pedido_id>`.
- Em `NovaVenda.tsx`, quando `repetir_pedido` está presente, carregar os itens daquele pedido (de `pedido_itens`) e populá-los no carrinho.

### 5. Aba "Preço Negociado" no cadastro do cliente
Criar nova tabela `cliente_precos_negociados`:

```sql
CREATE TABLE public.cliente_precos_negociados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  preco_negociado numeric NOT NULL,
  unidade_id uuid,
  empresa_id uuid NOT NULL,
  observacao text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (cliente_id, produto_id)
);
```
Com RLS por `empresa_id`/`unidade_id` no padrão do projeto.

No modal de cadastro do cliente em `CadastroClientes.tsx`, transformar o conteúdo em **Tabs** (Radix Tabs):
- **Aba "Dados Cadastrais"** — formulário atual (nome, CPF, endereço, tipo etc.).
- **Aba "Preço Negociado"** — lista produtos da empresa com input de preço por produto. Salvar via upsert na tabela acima. Aba só fica habilitada para clientes já salvos (`editingCliente !== null`).

Em `NovaVenda.tsx` / componente `ProductSearch`, ao selecionar produto com cliente já escolhido, consultar `cliente_precos_negociados` e usar o preço negociado se existir (com badge visual indicando "Preço Negociado").

## Arquivos a Editar/Criar

**Migração SQL (nova):**
- `supabase/migrations/<timestamp>_cliente_precos_e_fix_tipo.sql` — recria `buscar_clientes_paginado` retornando `tipo`/`cep`/`latitude`/`longitude`; cria `cliente_precos_negociados` + RLS.

**Frontend:**
- `src/pages/clientes/CadastroClientes.tsx` — adicionar Tabs no modal, botões "Lançar Venda" e "Histórico" nas ações, refetch de stats após CRUD.
- `src/components/clientes/PrecosNegociadosTab.tsx` (novo) — componente da aba.
- `src/components/clientes/HistoricoComprasDialog.tsx` (novo) — dialog com pedidos + botão Repetir.
- `src/pages/vendas/NovaVenda.tsx` — ler `cliente_id` e `repetir_pedido` da URL, pré-selecionar cliente e carregar itens.
- `src/components/vendas/ProductSearch.tsx` — buscar e aplicar preço negociado quando houver cliente selecionado.

## Notas Técnicas
- A RPC tem `STABLE SECURITY DEFINER` — basta `CREATE OR REPLACE` para alterar o retorno (o `RETURNS TABLE` muda, então será necessário `DROP FUNCTION` antes).
- O `tipo` não estava sendo passado pela RPC, então o fix do bug do "revendedor" resolve para 100% das edições.
- Manter o memory rule: payloads continuam incluindo `unidade_id` e `empresa_id`.
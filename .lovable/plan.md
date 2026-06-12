## Problema

No `AcertoEntregador.tsx`, várias queries usam o padrão "filtra por `unidade_id` somente SE `unidadeAtual?.id` existir". Quando o componente monta e o `UnidadeContext` ainda não terminou de carregar (ou o usuário tem acesso a múltiplas unidades/empresas), as queries rodam SEM o filtro de unidade — e o RLS, para perfis admin/gestor, permite ver todas as unidades da empresa (e, em contas multi-empresa como contador, de outras empresas também). Resultado: os cards de "Entregadores com acerto pendente", "Entregadores ativos" e os totais por entregador misturam pedidos de outras lojas.

## Correções (arquivo único: `src/pages/caixa/AcertoEntregador.tsx`)

Tornar o filtro por unidade **obrigatório** em todas as queries da tela e impedir a execução enquanto `unidadeAtual` não estiver pronto.

1. **Query `entregadores-ativos`** (linha 186):
   - Adicionar `enabled: !!unidadeAtual?.id`.
   - Trocar `if (unidadeAtual?.id) query = query.eq(...)` por filtro sempre aplicado; se ausente, retornar `[]`.

2. **Query `acerto-entregas`** (linha 221):
   - Atualizar `enabled` para `buscar && !!selectedId && !!unidadeAtual?.id`.
   - Filtro `unidade_id` sempre aplicado (sem condicional).

3. **Query `acerto-entregadores-pendentes`** (linha 257) — principal vazamento, pois roda sem `enabled`:
   - Adicionar `enabled: !!unidadeAtual?.id`.
   - Filtro `unidade_id` sempre obrigatório; se ausente, retornar `[]`.

4. **Query `acerto-despesas`** (linha 291):
   - Atualizar `enabled` para `buscar && !!selectedId && !canalVirtual && !!unidadeAtual?.id`.
   - Filtro `unidade_id` sempre aplicado.

5. **Mutações `salvarEdicao` (linhas 454, 461) e `confirmarAcerto` (linha 688)**:
   - Adicionar guarda `if (!unidadeAtual?.id) { toast.error("Selecione uma unidade"); return; }` no início.
   - Nos `update` em `pedidos`, adicionar `.eq("unidade_id", unidadeAtual.id)` como defesa em profundidade (evita editar pedido de outra unidade caso o id vaze).

6. **Query interna de `pedidos` em `salvarEdicao` (linha 461)** que busca `cliente_id` e dados do cliente:
   - Adicionar `.eq("unidade_id", unidadeAtual.id)`.

## Fora do escopo

- Não mexer em RLS, schema ou Edge Functions — a correção é só no frontend, garantindo que toda chamada à tela carregue exclusivamente dados da unidade atual selecionada.
- Não alterar a lógica de status, finalização ou PDF (já corrigidos antes).

## Resultado esperado

Após buscar, todos os cards (entregadores pendentes, lista de entregas, despesas, totais por forma de pagamento e resumo de produtos) refletem **somente** a unidade atualmente selecionada no header. Trocar de unidade dispara refetch automático via `queryKey` que já inclui `unidadeAtual?.id`.
## Problemas identificados

**1. Pedido não aparece no histórico após finalizar**
- `ClienteCheckout.tsx` insere o pedido com `cliente_id = null` quando o cliente ainda não existe na tabela `clientes` da empresa (login por telefone, sem cadastro prévio). O pedido fica "órfão".
- `ClienteHistorico.tsx` busca o cliente **apenas por `email`** (sem `empresa_id`, sem telefone) e filtra pedidos por `cliente_id`. Se o usuário entrou por telefone ou o cliente nunca foi achado, retorna lista vazia mesmo havendo pedidos.

**2. Não há acompanhamento pós-checkout**
- Após "Pedido realizado com sucesso", o app redireciona para `/cliente/historico`. Já existe `/cliente/rastreamento/:orderId`, mas o cliente não é levado para lá nem avisado em tempo real das mudanças de status.

## Plano

### A) Corrigir vínculo do pedido com o cliente (`ClienteCheckout.tsx`)
- Antes de criar o pedido, garantir que existe um registro em `clientes` para `empresa_id` do usuário:
  1. Buscar por `empresa_id` + (`email` OU `telefone`) — o que estiver disponível no `user`.
  2. Se não existir, fazer `INSERT` mínimo: `empresa_id`, `nome` (de `user_metadata.nome` ou email/telefone), `email`, `telefone`, `tipo='varejo'`, `ativo=true`.
  3. Usar o `id` retornado como `cliente_id` do pedido (nunca enviar `null`).
- Manter resolução de `unidade_id` atual.

### B) Corrigir leitura do histórico (`ClienteHistorico.tsx`)
- Trocar a busca do cliente para: `empresa_id` (vindo de `profiles.empresa_id`) + `OR(email, telefone)`.
- Se ainda não existir, mostrar estado vazio normalmente (sem quebrar).
- Aplicar a mesma resolução em qualquer outro lugar que dependa disso (revisar `ClienteHome.tsx` e `ClienteCarteira.tsx` se usarem o mesmo padrão — apenas se necessário).

### C) Acompanhamento do pedido após finalizar

**C.1 Redirect pós-checkout**
- Em `ClienteCheckout.tsx`, após sucesso, redirecionar para `/cliente/rastreamento/:pedidoId` em vez de `/cliente/historico`.

**C.2 Melhorar `ClienteRastreamento.tsx`**
- Adicionar subscription Realtime no `pedidos` (filtrada por `id=eq.:orderId`) para atualizar status automaticamente.
- Garantir que a timeline mostre os 4 estados: **Recebido → Confirmado → A caminho → Entregue** com horário em cada etapa.
- Botão "Ver meus pedidos" para voltar ao histórico e "Pedir novamente" quando entregue/cancelado.
- Mensagem clara enquanto status = `pendente`: "Aguardando confirmação da loja".

**C.3 Card "Pedido em andamento" no `ClienteHome.tsx`**
- Quando existir pedido do cliente com status `pendente` ou `em_rota`, exibir card destacado no topo da Home com status atual e botão **"Acompanhar"** que abre `/cliente/rastreamento/:id`.
- Atualizar via Realtime para sumir quando entregue/cancelado.

### D) Validação
- Após implementar, finalizar um pedido de teste no app Forte Gás e confirmar:
  - Redirect leva ao rastreamento.
  - Pedido aparece em "Minhas Compras" com status correto.
  - Card de acompanhamento aparece na Home enquanto pendente.

## Detalhes técnicos

- Tabela `clientes` **não tem `user_id`**, então o vínculo continua sendo `empresa_id + email/telefone`.
- RLS de `pedidos` exige `unidade_id` e `cliente_id` corretos — por isso o upsert do cliente é obrigatório.
- Realtime: usar `supabase.channel().on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: 'id=eq.<orderId>' })`.
- Nenhuma migração de banco é necessária.

## Arquivos a alterar
- `src/pages/cliente/ClienteCheckout.tsx` — upsert do cliente + redirect para rastreamento.
- `src/pages/cliente/ClienteHistorico.tsx` — busca de cliente por email/telefone + empresa_id.
- `src/pages/cliente/ClienteRastreamento.tsx` — Realtime + timeline com 4 estados + textos.
- `src/pages/cliente/ClienteHome.tsx` — card "Pedido em andamento" com Realtime.

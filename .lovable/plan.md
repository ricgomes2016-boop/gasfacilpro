## Diagnóstico

Pedido 72 da Forte Gás (`f1a95446...`) está com `status = 'entregue'` e **sem `cliente_id`**. Foram vinculados 2 vales (#9 e #10) à mesma venda, ambos já com `status = 'utilizado'` mas com `cliente_id` nulo.

Causas:

1. **Acerto não baixa**: em `AcertoEntregador.tsx` (linhas 706‑728), a busca `.from("vale_gas").eq("venda_id", entrega.id).maybeSingle()` quebra (PGRST116) quando há mais de um vale na mesma venda. O erro é silenciado, `valeUsado` fica nulo, o check `temValeGasSemVinculo` dispara `throw` e o pedido vai para a lista de falhas — porém o vale já estava marcado como `utilizado` em outra etapa, dando a impressão de "concluído".
2. **Cliente não aparece no Vale Gás**: em `paymentRoutingService.ts` (linha 322‑328), o update do vale usa `.neq("status","utilizado")` — quando o vale já foi marcado utilizado antes do acerto (cenário comum quando a forma de pagamento é validada na venda/edição), o `cliente_id`/`cliente_nome` nunca é gravado. Além disso, o pedido 72 nem tem `cliente_id` salvo.
3. **Vínculo errado quando há vários vales**: o vale anterior (#9) não é desvinculado quando o usuário troca para #10 na edição do acerto, criando 2 vales para o mesmo pedido.

## Correções

### 1. `src/pages/caixa/AcertoEntregador.tsx`
- Trocar `.maybeSingle()` por consulta que aceita múltiplos vales:
  ```ts
  .select("...").eq("venda_id", entrega.id).order("data_utilizacao", { ascending: true })
  ```
  e mapear **todos** os vales encontrados na linha de pagamentos `vale_gas` (somando valores), em vez de pegar um só.
- Se mesmo assim não houver vale vinculado e a forma é Vale Gás, exibir mensagem clara ("abra o pedido e valide o número do vale") em vez de falhar silenciosamente.
- Ao salvar a edição com novo vale, **liberar o vale anterior** (status = `disponivel`, limpar `venda_id`/`cliente_id`/`data_utilizacao`) antes de marcar o novo como utilizado, evitando vales órfãos.

### 2. `src/services/paymentRoutingService.ts` (case `vale_gas`)
- Remover o `.neq("status","utilizado")`. Sempre atualizar `venda_id`, `cliente_id`, `cliente_nome` e `data_utilizacao` (mantendo `status = 'utilizado'`), para que o cliente final seja preservado mesmo quando o vale já foi marcado antes.
- Suportar lista de vales: se o pagamento trouxer `vales: [{id,...}]`, aplicar o update em todos.

### 3. Fallback de `cliente_id` no acerto
- Quando o pedido tem `cliente_id` nulo mas `clientes` (FK relacional) está vazio, tentar resolver pelo telefone/nome livre antes de rotear (ou ao menos passar `clienteNome` consistente) para que o vale guarde a referência textual mesmo sem FK.

### 4. Script de reparo dos vales 9 e 10
Migration única (data-only via insert tool) para preencher retroativamente o cliente nos vales utilizados sem `cliente_id`, usando o `cliente_id` do `pedido` quando existir; nos vales do pedido 72 (sem cliente) gravar `cliente_nome = 'Não informado'` apenas para padronizar a coluna.

### 5. Refletir status correto do pedido 72
Após a correção do código, basta o usuário reabrir o acerto e baixar — o update agora encontrará o vale e marcará `pedidos.status = 'finalizado'`. Não vamos forçar o status via SQL para preservar o fluxo financeiro (`rotearPagamentosVenda`) que cria/atualiza os registros corretamente.

## Resultado esperado

- Baixar o acerto do pedido 72 funciona em 1 clique, mesmo com múltiplos vales.
- Em `Financeiro › Vale Gás`, o cliente que utilizou o vale aparece.
- Trocar de vale na edição não deixa vale órfão "utilizado" sem venda real.

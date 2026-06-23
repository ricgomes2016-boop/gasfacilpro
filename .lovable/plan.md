## Plano para corrigir finalização de pedido no app do cliente

1. **Ajustar a origem da unidade no checkout**
   - Hoje o checkout tenta achar a unidade pela empresa do registro em `clientes`, mas a RLS obrigatória `tenant_isolation_pedidos` valida a unidade contra a empresa do usuário logado.
   - Vou alterar o fluxo para buscar a `empresa_id` do usuário autenticado em `profiles` e então selecionar uma unidade ativa dessa empresa.

2. **Garantir vínculo correto com o cliente**
   - Manter o `cliente_id` quando encontrado por e-mail/telefone, mas sem depender dele para descobrir a empresa.
   - Se não houver unidade ativa válida, mostrar erro claro antes de tentar inserir o pedido.

3. **Corrigir o payload do pedido**
   - Inserir `unidade_id` sempre preenchido e compatível com a empresa do usuário.
   - Manter `origem_pedido: "app_cliente"` e `canal_venda: "Aplicativo"`.
   - Evitar enviar campos inexistentes ou que possam quebrar a política.

4. **Validar o resultado**
   - Conferir que a inserção passa pela RLS esperada e que o pedido pode ser criado com itens.
   - Se necessário, ajustar apenas o `ClienteCheckout.tsx`; migração só será usada se a política estiver impedindo corretamente um caso que deveria ser permitido.

## Detalhe técnico

A política restritiva `tenant_isolation_pedidos` exige:

```text
has_role(auth.uid(), 'super_admin') OR unidade_belongs_to_user_empresa(unidade_id)
```

Então o pedido do cliente precisa ser criado com uma `unidade_id` pertencente à mesma `empresa_id` do usuário autenticado em `profiles`. O erro da imagem indica que esse vínculo não está batendo no insert atual.


## Diagnostico: Estoque do entregador nao aparecendo

### Causa raiz identificada

Verifiquei todos os dados no banco:
- O carregamento do Flavio Henrique **existe** com status `em_rota` e 600 P13
- O `user_id` esta vinculado corretamente
- As politicas RLS estao corretas
- O produto existe e e acessivel

O problema esta no **Realtime do componente `EntregadorEstoque.tsx`**: ele escuta mudancas nas tabelas `carregamento_rota_itens` e `pedidos`, mas **NAO escuta a tabela `carregamentos_rota`**. Quando um novo carregamento e criado no ERP (mudanca na tabela `carregamentos_rota`), o app do entregador nao detecta e continua mostrando "Nenhuma rota ativa".

O entregador so veria o estoque se:
1. Fizesse refresh manual (botao Atualizar)
2. Navegasse para outra tela e voltasse
3. Recarregasse o app

### Solucao

Adicionar a tabela `carregamentos_rota` ao listener de Realtime no `EntregadorEstoque.tsx`, para que quando um novo carregamento for criado ou atualizado, o estoque atualize automaticamente.

### Mudancas tecnicas

| Arquivo | Mudanca |
|---|---|
| `EntregadorEstoque.tsx` | Adicionar `.on("postgres_changes", { event: "*", schema: "public", table: "carregamentos_rota" }, () => fetchEstoque())` ao canal Realtime existente |

Mudanca de 1 linha no useEffect do Realtime (linha 94-98).


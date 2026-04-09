

## Plano: Importar 6.475 clientes para Japa Gas - Maria Madalena

### Contexto
- **Empresa**: Japa Gas - Maria Madalena de Moura (`fb256438-...`)
- **Unidade**: Matriz (`36e09f4a-...`)
- **CSV**: 6.475 registros com id, nome, cpf, telefone, email, endereço, etc.
- **Clientes atuais no banco**: 985

### O que será feito

1. **Script Python** para ler o CSV e inserir os clientes via Supabase API em lotes de 50
2. Para cada cliente:
   - Definir `empresa_id` = `fb256438-642d-42a3-ba8f-b3183aa13162`
   - Inserir na tabela `clientes`
   - Criar vínculo na tabela `cliente_unidades` com a unidade Matriz
3. Os IDs do CSV serão preservados (campo `id` já preenchido)
4. Campos importados: nome, cpf, telefone, email, endereco, bairro, cidade, cep, latitude, longitude, tipo, numero, ativo
5. Ao final, relatório com total importado e eventuais erros

### Detalhes técnicos
- Inserção via `supabase-py` ou chamadas REST diretas em lotes de 50
- Upsert pelo `id` para evitar duplicatas caso algum já exista
- Associação em `cliente_unidades` com `ON CONFLICT DO NOTHING`


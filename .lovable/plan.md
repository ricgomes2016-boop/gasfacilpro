## Plano: corrigir busca de endereço do cliente (Nova Venda e Cadastro)

### Diagnóstico
Examinei a função `autocomplete_clientes_v2` (usada pelo autocomplete em Nova Venda e por `VendedorClientes`) e o hook `useClientes` (Cadastro de Clientes), e cruzei com os dados reais no banco:

- 62.451 clientes ativos, mas só **40.678 têm `endereco`** preenchido na tabela `clientes` e apenas **7.759 têm `numero`**. Boa parte dos clientes do app armazena o endereço principal apenas em `cliente_enderecos` (tabela separada, com `rua`, `numero`, `bairro`, `cep`, `complemento`, `referencia`, `principal`).
- A função RPC `autocomplete_clientes_v2` **só lê e busca colunas da tabela `clientes`**. Resultado: para clientes que se cadastraram via app, a busca retorna o nome mas sem endereço, e endereços salvos no app não são localizados quando o operador digita rua/bairro.
- Em registros importados, o endereço inteiro foi colocado no campo `endereco` (ex.: `"Rua Pará, 160, Centro"`) e `numero`/`bairro` ficaram nulos — então a busca "número da casa" não casa.
- No `useClientes.ts` (Cadastro), a busca também ignora `cliente_enderecos` e usa apenas `ilike` em `endereco`/`bairro` da tabela `clientes`.

### Correções propostas

1. **Atualizar a RPC `autocomplete_clientes_v2` (migração SQL)**
   - Buscar também em `cliente_enderecos` (rua, numero, bairro, cep, cidade, complemento).
   - Fazer COALESCE para retornar o endereço principal de `cliente_enderecos` quando `clientes.endereco` estiver vazio.
   - Manter a lógica atual de "rua + número" funcionando tanto via `clientes.numero` quanto via `cliente_enderecos.numero`.
   - Considerar "rua + número" também quando `clientes.numero` for nulo mas o `endereco` contiver o número (regex sobre o próprio texto), cobrindo a base importada.
   - Score: dar peso extra quando o match vier do endereço principal.

2. **Atualizar `useClientes.ts` (tela Cadastro)**
   - Estender o filtro `or(...)` para também encontrar clientes cujo endereço principal (em `cliente_enderecos`) bata com o termo. Implementação: antes de montar a query, fazer um `select cliente_id from cliente_enderecos` filtrando por `rua/bairro/cep ilike` e juntar esses IDs no `.in("id", [...])` final junto com o filtro de unidade.
   - Ao listar, enriquecer cada cliente com o endereço principal de `cliente_enderecos` quando os campos da tabela `clientes` estiverem vazios, para que a coluna de endereço apareça corretamente na tabela.

3. **(Opcional, mesma migração) view auxiliar `clientes_endereco_resolvido`**
   - Materializar lógica "endereço efetivo = COALESCE(clientes.endereco_components, principal de cliente_enderecos)" para reaproveitar em outras telas (lista, perfil, kanban). Mantém o restante do app sem mudança imediata.

### Arquivos/objetos afetados
- `supabase/migrations/<novo>.sql` — recriar `autocomplete_clientes_v2` e (opcional) view auxiliar.
- `src/hooks/useClientes.ts` — filtro + enriquecimento com `cliente_enderecos`.
- Sem alteração em `ClienteAutocompleteInput.tsx` nem em `NovaVenda` (eles já consomem os campos que a RPC passar a retornar).

### Fora do escopo
- Não vou mexer no fluxo de criação/edição de cliente nem em RLS — apenas leitura.
- Não vou migrar dados em massa entre `clientes.endereco` e `cliente_enderecos`; a correção é de busca/exibição.

# Corrigir CEP da Nova Venda para usar corretamente a cidade da unidade selecionada

## Diagnóstico detalhado

Analisei o fluxo atual da tela de Nova Venda e encontrei o problema principal:

1. **A cidade da unidade selecionada está sendo carregada corretamente**
   - `CustomerSearch.tsx` usa `useUnidade()`
   - a busca usa `unidadeAtual?.cidade`
   - no banco, a unidade **Central Gas / matriz** está com:
     - cidade: **Cornélio Procópio**
     - estado: **PR**
     - cep: **86302-310**

2. **O erro não é “não achar a cidade”**
   - hoje a busca de endereço monta só um texto:
     - `"Rua Amazonas, Cornélio Procópio"`
   - isso vai para o Nominatim sem validação forte por cidade/UF
   - o Nominatim pode devolver uma rua com mesmo nome em outro bairro/faixa postal da cidade
   - no teste externo, ele retornou `postcode: 86300-000`, que é genérico/incorreto para o caso informado

3. **O sistema aceita o CEP errado sem corrigir**
   - `selectAddress()` usa o `postcode` do Nominatim como prioridade
   - o fallback no ViaCEP só roda **se o Nominatim não retornar CEP**
   - então, quando o Nominatim retorna um CEP errado mas preenchido, o sistema **não consulta o ViaCEP**
   - por isso a rua aparece correta, mas o CEP fica errado ou não confiável

4. **O blur do endereço também está frágil**
   - `handleAddressBlur()` monta o geocoding sem incluir claramente a cidade/UF da unidade
   - além disso, se já existir `latitude` e `longitude`, ele sai cedo e **não tenta revalidar o CEP**
   - isso impede correção quando o usuário digita/edita depois de uma sugestão anterior

5. **Diferença importante para o comportamento esperado**
   - o fluxo atual está “aceitando o primeiro resultado plausível”
   - o comportamento esperado “estilo Gasexpert” precisa ser:
     - priorizar a **cidade da unidade ativa**
     - validar o resultado retornado
     - usar **ViaCEP como fonte final do CEP**, não apenas como fallback quando vier vazio

## Melhor abordagem

Vou manter o campo de endereço com autocomplete no mesmo lugar, mas ajustar a lógica para ficar confiável:

### 1. Tornar a cidade/UF da unidade obrigatória no contexto da busca
**Arquivo:** `src/components/vendas/CustomerSearch.tsx`

Ajustar `searchAddress()` para:
- usar `unidadeAtual?.cidade` e `unidadeAtual?.estado`
- montar busca mais específica, por exemplo:
  - `Rua Amazonas, Cornélio Procópio, PR, Brasil`
- filtrar os resultados recebidos para aceitar somente os que realmente pertençam à cidade/UF da unidade ativa

Isso evita sugestões de ruas homônimas com CEP de outra região.

### 2. Parar de confiar cegamente no `postcode` do Nominatim
**Arquivo:** `src/components/vendas/CustomerSearch.tsx`

Alterar `selectAddress()` para:
- preencher rua, bairro e coordenadas pela sugestão
- resolver o CEP com prioridade assim:
  1. ViaCEP por `UF + cidade + logradouro`
  2. se ViaCEP não achar, usar o `postcode` do Nominatim
- opcionalmente, quando houver múltiplos resultados do ViaCEP, escolher o mais compatível com o bairro retornado

Esse é o ponto mais importante da correção.

### 3. Corrigir o blur para sempre usar a unidade ativa como referência
**Arquivo:** `src/components/vendas/CustomerSearch.tsx`

Ajustar `handleAddressBlur()` para:
- montar o endereço completo com:
  - endereço
  - número
  - bairro
  - **cidade da unidade**
  - **estado da unidade**
- não bloquear a revalidação do CEP apenas porque já existem coordenadas
- se o usuário editou o logradouro, reexecutar a validação do CEP

### 4. Extrair uma função única de resolução de CEP
**Arquivo:** `src/components/vendas/CustomerSearch.tsx`

Criar uma função central, algo como:
- `resolverCepDoEndereco({ logradouro, bairro, cidade, estado, cepNominatim })`

Ela será usada tanto em:
- seleção de sugestão
- blur do campo
- retorno do mapa

Assim o comportamento fica consistente em todos os fluxos.

### 5. Aplicar o mesmo padrão de consistência do cadastro de clientes
**Arquivos:**
- `src/components/vendas/CustomerSearch.tsx`
- opcionalmente revisar `src/pages/clientes/CadastroClientes.tsx`

O cadastro de clientes já usa a cidade da unidade como contexto inicial. Vou alinhar a Nova Venda para seguir a mesma lógica operacional, mas com validação de cidade/UF mais forte e CEP priorizado pelo ViaCEP.

## Resultado esperado após a implementação

Ao digitar na Nova Venda, estando na unidade **Central Gas matriz / Cornélio Procópio**:
- o autocomplete vai sugerir endereços da cidade correta
- ao selecionar **Rua Amazonas**, o sistema deve preencher:
  - endereço
  - bairro
  - coordenadas
  - **CEP correto: 86302-310**
- se o usuário apenas digitar e sair do campo, o CEP também deve ser validado com base na unidade selecionada

## Arquivos a ajustar

- `src/components/vendas/CustomerSearch.tsx` — correção principal
- `src/pages/clientes/CadastroClientes.tsx` — revisão opcional para manter padrão
- sem necessidade de mudança no `UnidadeContext`, porque a cidade/estado da unidade já estão vindo corretamente

## Observação

Não consegui comparar diretamente com um projeto chamado “gasexpert” porque ele não está acessível aqui, então baseei o plano no comportamento esperado que você descreveu e no fluxo atual do sistema publicado.

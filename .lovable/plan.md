

# Melhorias no Campo de Cliente e Endereço na Nova Venda

## Problemas Identificados

1. **Nome não grava**: Na `handleFinalizar` (linha 643), o campo `cidade` está sempre `null` (`cidade: customer.bairro ? null : null`). Além disso, o `CustomerSearch` não passa `cidade` no `CustomerData`, então o auto-cadastro nunca salva a cidade do cliente.

2. **Campo de busca/nome**: O campo "Nome do Cliente" já funciona como busca e nome ao mesmo tempo — busca enquanto digita, e se não encontrar, usa o texto como nome para auto-cadastro. Vamos manter assim (conforme sua preferência), mas melhorar o feedback visual.

3. **Endereço sem autocomplete**: O campo endereço atual usa apenas geocoding por coordenadas no blur. Não tem autocomplete com sugestões enquanto digita. A tela de Cadastro de Clientes já tem essa funcionalidade (Nominatim + cidade da unidade como contexto).

## Alterações Planejadas

### 1. Corrigir auto-cadastro do cliente (NovaVenda.tsx)
- Linha 643: trocar `cidade: customer.bairro ? null : null` por `cidade: unidadeAtual?.cidade || null`
- Garantir que o nome digitado no campo seja salvo corretamente no cadastro

### 2. Adicionar autocomplete de endereço no CustomerSearch
Replicar o padrão já existente em `CadastroClientes.tsx`:
- Ao digitar no campo endereço, buscar via Nominatim com a cidade da unidade como contexto padrão
- Mostrar dropdown com sugestões de endereço
- Ao selecionar, preencher automaticamente: endereço, bairro, CEP, latitude e longitude
- Debounce de 500ms para não sobrecarregar a API

### 3. Feedback visual no campo nome/busca
- Mostrar ícone de loading enquanto busca
- Mostrar mensagem "Nenhum cliente encontrado — será cadastrado automaticamente" quando a busca não retorna resultados e há texto digitado

### Arquivos modificados
- `src/components/vendas/CustomerSearch.tsx` — autocomplete de endereço via Nominatim + feedback no campo nome
- `src/pages/vendas/NovaVenda.tsx` — corrigir cidade no auto-cadastro (1 linha)


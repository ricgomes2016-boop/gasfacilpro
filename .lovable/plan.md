

# Aplicar lógica de endereço com autocomplete + CEP na tela Editar Pedido + atualizar cadastro do cliente

## Escopo

A tela Editar Pedido (`EditarPedido.tsx`) atualmente tem:
- Campo de busca de cliente simples (sem autocomplete de endereço, sem ViaCEP)
- Campo de endereço manual sem sugestões
- Ao salvar, atualiza apenas o pedido — **não atualiza o cadastro do cliente**

Precisa:
1. Aplicar a mesma lógica de autocomplete de endereço + resolução de CEP via ViaCEP que foi implementada no `CustomerSearch.tsx` da Nova Venda
2. Permitir edição do nome do cliente diretamente
3. Ao salvar, se o cliente foi alterado (nome, endereço, bairro, CEP, etc.), atualizar também a tabela `clientes`

## Alterações

### Arquivo: `src/pages/vendas/EditarPedido.tsx`

**1. Adicionar campo editável de nome do cliente**
- Substituir o título estático "Cliente: {nome}" por um `Input` editável com o nome
- Manter a busca existente abaixo para trocar de cliente

**2. Adicionar autocomplete de endereço com sugestões Nominatim**
- Replicar a lógica de `searchAddress` do `CustomerSearch.tsx`:
  - Debounce 500ms no campo logradouro
  - Buscar no Nominatim com cidade + estado da unidade como contexto
  - Mostrar dropdown de sugestões
  - Ao selecionar, preencher rua, bairro, coordenadas

**3. Adicionar resolução de CEP via ViaCEP**
- Replicar `resolverCepViaViaCEP` do `CustomerSearch.tsx`
- Na seleção de sugestão e no blur do endereço: priorizar ViaCEP para CEP, fallback no Nominatim
- No blur do endereço: incluir cidade/estado da unidade no geocoding

**4. Ao salvar, atualizar cadastro do cliente**
- Na função `handleSalvar`, após salvar o pedido, se `pedido.cliente_id` existir:
  ```typescript
  await supabase.from("clientes").update({
    nome: pedido.cliente_nome,
    endereco: enderecoFields.endereco || null,
    numero: enderecoFields.numero || null,
    bairro: enderecoFields.bairro || null,
    cidade: enderecoFields.cidade || null,
    cep: enderecoFields.cep || null,
    latitude: coords.lat,
    longitude: coords.lng,
  }).eq("id", pedido.cliente_id);
  ```

### Arquivos modificados
- `src/pages/vendas/EditarPedido.tsx` — todas as alterações acima (autocomplete, ViaCEP, nome editável, salvar cliente)


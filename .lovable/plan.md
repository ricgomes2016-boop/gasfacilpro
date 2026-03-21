

# Corrigir: CEP nao atualiza ao digitar/selecionar endereco

## Problemas encontrados

1. **`selectAddress`** (ao clicar sugestao): depende de `addr.postcode` do Nominatim, que frequentemente vem vazio para enderecos brasileiros
2. **`handleAddressBlur`** (ao sair do campo): faz geocoding mas nunca atualiza o CEP — so atualiza lat/lng e bairro

## Solucao

### Arquivo: `src/components/vendas/CustomerSearch.tsx`

**1. `handleAddressBlur`** — adicionar CEP do resultado do geocoding:
```typescript
onChange({
  ...value,
  latitude: result.latitude,
  longitude: result.longitude,
  bairro: value.bairro || result.bairro || "",
  cep: value.cep || (result.cep ? formatCEP(result.cep) : ""),
});
```

**2. `selectAddress`** — quando Nominatim nao retorna `postcode`, fazer fallback buscando CEP via ViaCEP usando o logradouro + cidade:
- Apos preencher endereco/bairro/lat/lng da sugestao
- Se `postcode` estiver vazio e tiver `road` + cidade, buscar CEP via ViaCEP search API (`https://viacep.com.br/ws/{UF}/{cidade}/{logradouro}/json/`)
- Preencher o CEP automaticamente com o primeiro resultado

**3. Criar funcao auxiliar `buscarCEPPorEndereco`**:
```typescript
const buscarCEPPorEndereco = async (logradouro: string, cidade: string) => {
  // usa API ViaCEP de busca por endereco
  // retorna o primeiro CEP encontrado
};
```

Isso garante que o CEP sera preenchido em todos os cenarios: clicando na sugestao, saindo do campo, ou via mapa.

### Resumo de alteracoes
- `src/components/vendas/CustomerSearch.tsx` — 3 pontos: handleAddressBlur, selectAddress, nova funcao buscarCEPPorEndereco


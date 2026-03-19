# Corrigir Parceiros no Mapa e Adicionar Localização no Cadastro

## Problemas Encontrados

1. **Query errada no mapa**: O `ConcorrentesMap.tsx` filtra parceiros por `.eq("empresa_id", empresaId!)`, mas a tabela `vale_gas_parceiros` **não tem coluna `empresa_id**` -- ela tem `unidade_id`. Resultado: nenhum parceiro aparece no mapa.
2. **Formulário sem localização**: A tela de cadastro de parceiros (`ValeGasParceiros.tsx`) não possui campos de endereço com geocodificação nem campos de latitude/longitude, impossibilitando definir a localização por ali.

## Etapas

### 1. Corrigir query de parceiros no mapa

Em `ConcorrentesMap.tsx`, trocar o filtro `.eq("empresa_id", empresaId!)` por uma lógica baseada em `unidade_id` (filtrar pela unidade atual, ou buscar todas as unidades da empresa via join/subquery). A abordagem mais simples: buscar parceiros pela mesma `unidade_id` da unidade atual, ou sem filtro de unidade se o parceiro não tiver uma associada.

### 2. Adicionar campos de localização no formulário de parceiros

Em `ValeGasParceiros.tsx`:

- Adicionar campo de endereço com botão de geocodificação (usando a função `geocodeAddress` já existente)
- Ao salvar, gravar `latitude` e `longitude` automaticamente a partir do endereço geocodificado
- Exibir indicador visual de "localizado" / "sem localização" na lista de parceiros

### 3. Ajustar `addParceiro` no contexto

Em `ValeGasContext.tsx`, incluir `latitude`, `longitude` e `unidade_id` nos campos aceitos pelo `addParceiro` para que o formulário consiga salvar as coordenadas.

4. Mesmo na tela de cadastro do cliente,  ao colocar tipo do cliente: revenda, revendedor. Ter opção de colocar no mapa de analise de clientes. 
  &nbsp;

### Detalhes Técnicos

- **Sem migração necessária** -- as colunas `latitude` e `longitude` já existem na tabela
- **Geocodificação**: reutilizar `geocodeAddress` de `@/lib/geocoding` (já usado no mapa de concorrentes)
- **Filtro corrigido**: `.or(\`unidade_id.eq.${unidadeId},unidade_id.is.null)` para pegar parceiros da unidade atual + parceiros sem unidade associada
- &nbsp;
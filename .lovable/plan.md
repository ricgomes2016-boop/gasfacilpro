

## Plano: Simplificar abas — Rotas Cidade + Carregamentos (com tipo atacado)

### Problema atual
Existem 3 abas confusas: "Rota Atacado" (RotaAtacadoDinamica com mapa/paradas), "Rotas Cidade" (CRUD de rotas definidas), e "Carregamentos" (controle de saída/retorno/venda). A "Rota Atacado" e "Carregamentos" se sobrepõem.

### Solução proposta
Manter **2 abas** apenas:

1. **Rotas de Entrega** — o CRUD de rotas (atual "Rotas Cidade"), mas com um campo **Tipo** ("cidade" ou "atacado"). Rotas atacado incluem cidades com KM calculado automaticamente via geocoding (Haversine × 1.3).

2. **Carregamentos** — o controle de carregamentos existente (saída, retorno, venda, transferência), que já funciona bem.

### Mudanças detalhadas

**1. Adicionar campo `tipo` na tabela `rotas_definidas`**
- Migration: `ALTER TABLE rotas_definidas ADD COLUMN tipo text NOT NULL DEFAULT 'cidade';`
- Valores: `'cidade'` (bairros) ou `'atacado'` (cidades com KM)

**2. Adicionar campo `cidades` na tabela `rotas_definidas`**
- Migration: `ALTER TABLE rotas_definidas ADD COLUMN cidades jsonb DEFAULT '[]';`
- Estrutura: `[{ "nome": "Londrina", "lat": -23.31, "lng": -51.16, "km": 45 }]`
- Para rotas atacado, o campo `bairros` fica vazio e `cidades` contém os pontos com KM

**3. Atualizar modal "Nova Rota" em `GestaoRotas.tsx`**
- Adicionar Select de tipo (cidade/atacado) no topo do formulário
- Se **cidade**: mostrar campo de bairros + distância manual (como hoje)
- Se **atacado**: mostrar campo para adicionar cidades (input + botão). Ao digitar uma cidade e confirmar, geocodificar via Nominatim, calcular KM entre cada cidade usando Haversine × 1.3, e exibir lista com KM acumulado
- O KM total é calculado automaticamente pela soma dos trechos

**4. Remover aba "Rota Atacado" (RotaAtacadoDinamica)**
- Remover a aba e o import de `RotaAtacadoDinamica` em `GestaoRotas.tsx`
- O componente permanece disponível para a página da Transportadora

**5. Renomear abas**
- "Rotas de Entrega" (todas as rotas, com badge de tipo)
- "Carregamentos" (controle de saída/retorno — mantém como está)

**6. Na listagem de rotas, mostrar tipo**
- Badge "Cidade" (azul) ou "Atacado" (laranja)
- Para atacado: mostrar cidades ao invés de bairros, e KM calculado

### Arquivos modificados

| Arquivo | Ação |
|---|---|
| `src/pages/operacional/GestaoRotas.tsx` | Remover aba "Rota Atacado"; renomear "Rotas Cidade" → "Rotas de Entrega"; adicionar campo tipo no modal; lógica de geocoding e KM para atacado |
| Migration SQL | Adicionar colunas `tipo` e `cidades` em `rotas_definidas` |

### Detalhes técnicos
- Geocoding usa Nominatim (já utilizado no projeto): `https://nominatim.openstreetmap.org/search?q=${cidade}&format=json`
- KM entre cidades: `haversineDistance(lat1, lng1, lat2, lng2) * 1.3` (fator rodoviário)
- A primeira cidade é o ponto de partida (sede); KM acumulado a partir dela
- O campo `distancia_km` da rota é preenchido automaticamente com o total calculado



## Objetivo

Consolidar no **Mapa Operacional** (`/operacional/centro`) todas as capacidades já existentes de inteligência logística, expondo numa única tela:

1. Rastreamento em tempo real dos entregadores
2. Trilha (polyline) do percurso no mapa
3. Detecção de paradas longas
4. Tempo de rota acumulado
5. Alertas inteligentes (parada longa, demora, risco de atraso)
6. ETA automático por pedido
7. Sugestão automática do melhor entregador para cada pedido pendente
8. Otimização de ordem de entregas
9. Base de produtividade (entregas/hora, paradas, tempo médio)

## Diagnóstico do que já existe

Já temos os blocos de lógica prontos, só precisam ser **plugados** na tela:

- `src/services/trackingService.ts` — grava posições em `localizacao_entregador`
- `src/services/operacionalService.ts` — `detectarParadas`, `calcularTempoRota`, `gerarAlertas`
- `src/services/iaOperacionalService.ts` — `escolherMelhorEntregador`, `calcularETA`, `detectarRiscoAtraso`, `otimizarOrdem`
- `src/hooks/useOperacional.ts` — orquestra tudo a partir de entregadores + pedidos + cache de pontos
- `src/pages/operacional/MapaOperacional.tsx` — tela já existe, precisa receber os widgets
- `mem://features/mapa-operacional` confirma o padrão (Haversine, refresh 15-30s, latência 5m offline)

Ou seja: **não vamos criar lógica nova**, vamos compor a UI que consome `useOperacional`.

## Plano de implementação (Etapa única, 1 tela)

### 1. Hook de dados em tempo real
Criar `src/hooks/useMapaOperacionalData.ts` que:
- Carrega entregadores ativos da empresa (com `localizacao` derivada da última linha de `localizacao_entregador`)
- Carrega pedidos `pendente` / `saiu_entrega` da unidade
- Para cada entregador, busca os pontos das últimas 4h em `localizacao_entregador` → monta `pontosCache`
- Assina realtime de `localizacao_entregador` e `pedidos` para refresh incremental (sem refetch completo)
- Devolve `{ entregadores, pedidos, pontosCache }` para alimentar `useOperacional`

### 2. Componentes de UI no Mapa
Em `src/pages/operacional/MapaOperacional.tsx`:

- **Polyline da trilha** por entregador (Leaflet `Polyline` com `pontosCache[id]`), cor por entregador, opacidade decrescente para pontos antigos
- **Marcador de parada** (`<CircleMarker>` vermelho) em cada item de `dados[entregador.id].paradas`, com tooltip "Parado X min"
- **Marcador do entregador** com badge de status (verde = em rota, amarelo = parado, vermelho = alerta)
- **Painel lateral direito** (drawer/sidebar colapsável) com 3 abas:
  - *Entregadores*: lista com tempo de rota, nº paradas, alertas
  - *Pedidos*: lista de pendentes com ETA, risco (alto/médio/baixo) e sugestão "Atribuir a {melhorEntregador.nome}"
  - *Produtividade*: cards com entregas/hora, tempo médio por entrega, % de pedidos no prazo (calculado a partir de `pedidos` entregues hoje)

### 3. Ações operacionais
- Botão **"Atribuir automaticamente"** em cada pedido pendente → executa `update pedidos set entregador_id = melhor.id`
- Botão **"Otimizar ordem"** por entregador → chama `otimizarOrdem(pedidosDoEntregador, posicaoAtual)` e persiste a nova ordem em `pedidos.ordem_entrega` (campo já existente conforme `gestao-rotas-conferencia`)
- Toast de **alertas inteligentes** quando `risco === 'alto'` ou nova parada > 5min é detectada (debounce por entregador)

### 4. Performance
- Refresh a cada 30s + realtime incremental (padrão `mapa-operacional`)
- `useMemo` na trilha e nas paradas (listas grandes)
- Filtro por unidade no topo (já existe `useUnidadeAtiva`)

## Arquivos tocados

```text
NOVO  src/hooks/useMapaOperacionalData.ts
NOVO  src/components/operacional/mapa/TrilhaPolyline.tsx
NOVO  src/components/operacional/mapa/ParadasLayer.tsx
NOVO  src/components/operacional/mapa/PainelLateral.tsx
NOVO  src/components/operacional/mapa/CardProdutividade.tsx
EDIT  src/pages/operacional/MapaOperacional.tsx
```

Nenhuma alteração de schema — `localizacao_entregador`, `pedidos`, `entregadores` já têm tudo que precisamos. Nenhum serviço/IA é alterado: apenas consumimos.

## O que NÃO vou fazer
- Não vou refatorar `App.tsx`, rotas, providers (regra de estabilidade)
- Não vou criar nova rota — tudo entra em `/operacional/centro`
- Não vou alterar `iaOperacionalService.ts` nem `operacionalService.ts`
- Não vou mexer em `useGeoTracking` do app entregador

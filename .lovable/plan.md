
## Problema identificado

Confirmei no banco: o entregador **Flavio Henrique** aparece como `em_rota` mas o `updated_at` é de **31 dias atrás** — sem GPS recente, sem rota ativa. O Mapa Operacional confia 100% na coluna `entregadores.status` (texto) que ninguém zera. Resultado: o card "Em Rota" mente, e o gestor não sabe quem está realmente trabalhando agora.

Hoje a tela mistura 3 fontes (`entregadoresData` cru, `entsOp` do hook, e `dadosOp` da IA) sem regra única de verdade. Os KPIs `totalEmRota` / `totalDisponivel` usam `e.status` direto, ignorando `updated_at` e `rotas` ativas.

## Solução — Presença derivada (single source of truth)

Calcular o status real no client a partir de 3 sinais objetivos, ignorando o campo `status` legado:

```text
                 ┌─ tem rota 'em_andamento' + ping <5min  → EM ROTA (verde pulsando)
ping GPS <2min ──┼─ sem rota ativa                        → ONLINE / DISPONÍVEL (azul)
                 │
ping 2-15min  ──── → INATIVO (amarelo, "GPS instável")
ping >15min ou nunca → OFFLINE (cinza, "Não logado")
```

Regras:
- "Em Rota" só conta se existir registro em `rotas` com `status='em_andamento'` E ping GPS recente (já temos `rotaIds` no hook).
- KPIs e badges passam a usar `presenca` derivada, nunca mais `e.status` cru.
- Entregador offline há mais de 24h fica oculto por padrão (toggle "Mostrar offline").

## Plano de mudanças (somente frontend + 1 hook)

### 1. Novo `src/hooks/useEntregadorPresenca.ts`
Recebe `entregadores`, `pontosCache` e a lista de rotas ativas (vem do `useMapaOperacionalData`, já exposta), devolve para cada entregador:
```ts
{ presenca: 'em_rota' | 'online' | 'instavel' | 'offline',
  ultimoPingMs: number, temRotaAtiva: boolean, pedidosAtivos: number }
```

### 2. Expor `rotasAtivas` em `useMapaOperacionalData.ts`
Pequena adição: já buscamos as rotas em andamento, basta retornar `rotasAtivasPorEntregador: Record<string, string>`.

### 3. Refactor `MapaOperacional.tsx`
- Remover `entregadoresData` paralelo — usar só `entsOp` do hook (uma fonte).
- KPIs reescritos a partir de `presenca`:
  - **Em Rota** = `presenca==='em_rota'`
  - **Online** = `presenca==='online'`
  - **Offline / Não logado** = `presenca==='offline'` (novo card, substitui "Em Andamento" duplicado)
  - **Pendentes** = pedidos sem entregador (mantém)
- Lista lateral de entregadores:
  - Bolinha colorida + texto da presença real ("Online há 12s", "Em rota · 3 entregas", "GPS instável há 7min", "Offline desde 14:30 de ontem").
  - Badge "Em Rota" só aparece quando presença é `em_rota` (corrige o bug do Flavio).
  - Toggle "Mostrar offline" (default off) no topo da lista.
- Marker do entregador no mapa fica esmaecido (opacity 40%) quando `instavel`, e some quando `offline`.

### 4. Foco em "monitoramento de produto" (entrega)
Adicionar mini-painel `ProdutoEmTransito` no painel lateral (acima de "Entregadores"):
- Lê `pedido_itens` dos pedidos em rota e agrega por produto: `P13 × 18 unidades · 4 entregadores`, `Água 20L × 6`.
- Por entregador selecionado: mostra o que ele está carregando agora (vem dos itens do pedido `em_rota` dele).
- Alerta visual quando entregador `em_rota` está parado há >10min com produto a bordo (já temos `dadosOp.paradas`).

### 5. Card de teste/saúde (canto inferior do painel)
"Saúde do rastreamento": % de entregadores ativos com ping <5min, último ping global, contagem de offline há >24h — para o gestor ver na hora se o app dos entregadores parou de enviar GPS.

## Fora de escopo
- Não mexer em `App.tsx`, providers, rotas, RLS ou backend.
- Não alterar a coluna `entregadores.status` (continua existindo para retrocompatibilidade do app do entregador).
- Não tocar no `DeliveryRoutesMap` em si — só nos dados que entram nele.

## Arquivos afetados
- `src/hooks/useMapaOperacionalData.ts` — expor rotas ativas
- `src/hooks/useEntregadorPresenca.ts` — **novo**
- `src/pages/operacional/MapaOperacional.tsx` — KPIs, lista, toggle offline
- `src/components/operacional/mapa/PainelLateral.tsx` — adicionar bloco "Produto em trânsito" e "Saúde do rastreamento"


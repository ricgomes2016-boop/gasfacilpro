

## Análise: Localização em Tempo Real no APK do Entregador

### Problemas Encontrados

**1. Bug crítico: GPS não inicia ao mudar status**
Quando o entregador muda de "offline" para "disponível" (via painel ou jornada), o listener de realtime atualiza `statusRef` mas **não inicia o tracking GPS**. O GPS só funciona se o entregador já estiver "disponível" no momento do carregamento do app. Isso significa que na maioria dos casos de uso real, o GPS nunca liga.

**2. Sem histórico de rota (`rota_historico`)**
O hook `useGeoTracking` atualiza apenas `entregadores.latitude/longitude` (posição atual), mas nunca insere registros em `rota_historico`. Isso significa que o "Trajeto do Dia" no Mapa Operacional fica sempre vazio.

**3. GPS não para ao ficar offline**
Quando o status muda para "offline", o watcher do GPS continua rodando em background — desperdiçando bateria e enviando dados desnecessários.

### Correções Propostas

**Arquivo: `src/hooks/useGeoTracking.ts`**

1. **Iniciar/parar GPS ao mudar status** — No listener de realtime (`postgres_changes`), chamar `startCapacitorTracking()` ou `startWebTracking()` quando status sai de "offline", e `stopTracking()` quando entra em "offline".

2. **Inserir em `rota_historico`** — Dentro de `updateLocation`, após atualizar `entregadores`, inserir também um registro na tabela `rota_historico` com `entregador_id`, `latitude`, `longitude` e `timestamp`, vinculado à rota ativa (se houver).

3. **Extrair função `stopTracking()`** — Criar uma função reutilizável que remove o watcher (Capacitor ou Web) para poder parar o GPS sem desmontar o componente.

### Detalhes técnicos

- A função `startCapacitorTracking` e `startWebTracking` precisam ser estáveis (extraídas para refs ou com cleanup antes de reiniciar) para evitar watchers duplicados
- A inserção em `rota_historico` requer buscar a `rota_id` ativa do entregador; será feita uma query inicial e cacheada em ref
- Nenhuma mudança no AndroidManifest, permissões ou Capacitor config — já estão corretos
- Nenhuma mudança no workflow de build do GitHub

### Escopo
- 1 arquivo modificado: `src/hooks/useGeoTracking.ts`
- Zero mudanças de banco (tabelas já existem)


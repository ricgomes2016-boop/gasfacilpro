

## Plano: KM individual por cidade + cidades opcionais na rota atacado

### Problema
O OSRM calcula a distância acumulada em cadeia (Origem→Bandeirantes→Itambaracá→Andirá), resultando em KM incorreto. O correto é calcular a distância rodoviária **da origem até cada cidade individualmente**. Além disso, algumas cidades são opcionais (o motorista nem sempre passa por todas).

### Solução

**1. KM individual origem→cidade (não acumulado em cadeia)**

Ao adicionar/remover uma cidade, fazer chamadas OSRM separadas para cada cidade:
- Origem → Bandeirantes = 37 km
- Origem → Itambaracá = 49 km  
- Origem → Andirá = 55 km

Cada cidade mostra seu KM independente da ordem. O KM total da rota = maior distância (cidade mais distante).

**2. Cidades opcionais (toggle)**

Adicionar um campo `opcional: boolean` em cada `CidadeRota`. Na listagem de cidades da rota, mostrar um ícone/toggle para marcar a cidade como opcional. Cidades opcionais aparecem com um badge "Opcional" e estilo visual diferenciado (opacidade reduzida ou badge).

Na hora do carregamento, o operador já vê quais são fixas e quais são opcionais — sem precisar de tela extra.

**3. Tempo estimado**

Calculado pela rota completa (ida e volta passando por todas as cidades fixas + opcionais ativas). Usar a rota Origem → todas as cidades ordenadas por distância → retorno à Origem.

### Mudanças técnicas

| Arquivo | Mudança |
|---|---|
| `RotaAtacadoMapPicker.tsx` | Substituir `getOSRMDistanceCumulative` por chamadas individuais Origem→Cidade. Adicionar toggle "opcional" em cada cidade. Calcular tempo estimado com rota completa. |
| `GestaoRotas.tsx` | Total KM = `Math.max(...cidadesRota.map(c => c.km))`. Interface `CidadeRota` ganha campo `opcional?: boolean`. |

### Estrutura CidadeRota atualizada
```text
{ nome: "Bandeirantes", lat: -23.11, lng: -50.35, km: 37, opcional: false }
{ nome: "Itambaracá", lat: -23.01, lng: -50.38, km: 49, opcional: true }
{ nome: "Andirá", lat: -23.05, lng: -50.23, km: 55, opcional: false }
```

### Lógica de KM
- Para cada cidade: OSRM `Origem → Cidade` (2 pontos apenas)
- Chamadas paralelas via `Promise.all` para performance
- KM total = maior valor de `km` entre todas as cidades
- Cidades ordenadas por KM na listagem automaticamente

### UI da cidade opcional
- Checkbox ou ícone ao lado de cada cidade na lista
- Badge "Opcional" ao lado do nome
- Não altera a tela nem adiciona abas — tudo no mesmo componente


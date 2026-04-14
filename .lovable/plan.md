

## Plano: Painel de Status do Rastreamento no App do Entregador

Adicionar um card informativo no Dashboard e na Jornada do entregador que exibe em tempo real:
- Endereço da localização atual (geocodificação reversa)
- Qualidade do sinal de internet
- Nível de bateria do dispositivo
- Precisão da localização GPS

### Arquitetura

**Novo componente**: `src/components/entregador/TrackingStatusCard.tsx`

Um card que aparece quando o entregador está online, mostrando os 4 indicadores:

1. **Endereço atual** — Usa a API gratuita do Nominatim (OpenStreetMap) para geocodificação reversa das coordenadas já capturadas pelo `useGeoTracking`
2. **Qualidade do sinal** — Usa `navigator.connection` (Network Information API) para exibir tipo de conexão (4G/WiFi) e qualidade estimada
3. **Nível de bateria** — Usa `navigator.getBattery()` (Battery Status API) para exibir percentual e se está carregando
4. **Precisão GPS** — Usa `position.coords.accuracy` já disponível no watchPosition para mostrar precisão em metros

### Mudanças no hook `useGeoTracking`

Refatorar para expor estado reativo (lat, lng, accuracy) via retorno do hook, em vez de apenas gravar no banco silenciosamente. Isso permite que componentes consumam a posição atual.

### Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `src/hooks/useGeoTracking.ts` | Refatorar para retornar `{ lat, lng, accuracy, isTracking }` como estado |
| `src/components/entregador/TrackingStatusCard.tsx` | **Novo** — Card com os 4 indicadores |
| `src/components/entregador/EntregadorLayout.tsx` | Passar dados do hook para children |
| `src/pages/entregador/EntregadorDashboard.tsx` | Integrar o `TrackingStatusCard` no card "Online e Rastreando" |

### Detalhes técnicos

**Geocodificação reversa** — Chamada ao Nominatim com debounce de 30s (respeitando rate limit):
```typescript
const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`);
```

**Battery API**:
```typescript
const battery = await (navigator as any).getBattery();
// battery.level (0-1), battery.charging (boolean)
```

**Network Information API**:
```typescript
const conn = (navigator as any).connection;
// conn.effectiveType ("4g", "3g", "2g", "slow-2g")
// conn.downlink (Mbps)
```

**GPS Accuracy**: Já disponível em `position.coords.accuracy` (metros).

### Visual

O card aparece logo abaixo do banner "Online e Rastreando" no Dashboard, com layout em grid 2x2:

```text
┌─────────────────────────────────────┐
│ 📍 Rua Example, 123 - Centro       │
├──────────────┬──────────────────────┤
│ 📶 4G Forte  │ 🔋 87% Carregando   │
├──────────────┴──────────────────────┤
│ 🎯 Precisão: 8m                    │
└─────────────────────────────────────┘
```




## Plano: Simulação de Viagem inspirada no QualP

### Análise do QualP

O QualP é uma calculadora de rotas e fretes com mapa em tela cheia. Principais diferenças em relação à simulação atual:

1. **Mapa integrado na página** (não em dialog/modal) -- origem e destino são campos de busca diretamente sobre o mapa
2. **Cálculo de pedágios automático** por rota
3. **Interface visual com rota desenhada** diretamente na tela principal

### Problema atual

O mapa dentro do Dialog/modal não renderiza os tiles corretamente (fica em branco). Isso é um problema recorrente do Leaflet dentro de modais Radix UI, onde o container tem dimensões zero no momento da inicialização.

### Solução proposta

**Eliminar o dialog do mapa e embutir o mapa diretamente na página de Simulação**, similar ao QualP. Isso resolve o bug de renderização e melhora a experiência.

### Layout novo da página

```text
┌─────────────────────────────────────────────┐
│  Simulação de Viagem                        │
├──────────────────┬──
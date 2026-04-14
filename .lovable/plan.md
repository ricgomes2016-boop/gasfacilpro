

## Plano: Mover Rota Atacado Dinâmica para Gestão Operacional / Rotas de Entrega

### Objetivo
Integrar o módulo de Rota Atacado Dinâmica (atualmente em `/transportadora/rota-atacado`) como uma nova aba dentro da página existente `/operacional/rotas` (GestaoRotas), mantendo as abas já existentes ("Rota Atacado" e "Rotas Cidade").

### Mudanças

**1. Adicionar nova aba "Rota Atacado Dinâmica" em `GestaoRotas.tsx`**
- Adicionar uma terceira tab `rota-dinamica` ao TabsList existente
- Dentro dessa tab, renderizar os componentes já criados: `RotaAtacadoMap`, `ParadaForm`, `CargaTimeline`, `RotaOptimizer`, `RotaSummaryCard`
- Adaptar o contexto de autenticação: substituir `useAuth` + `empresa_id` via profile por `useUnidade` (padrão do operacional)
- Manter as queries de veículos, funcionários, distribuidoras, clientes, unidades

**2. Criar componente wrapper `RotaAtacadoDinamica.tsx`**
- Novo arquivo: `src/components/operacional/RotaAtacadoDinamica.tsx`
- Extrair toda a lógica de `TranspRotaAtacado.tsx` (estado, queries, save, paradas) em um componente reutilizável que não depende do `TransportadoraLayout`
- Usar `useUnidade` para obter `empresa_id` via unidade atual

**3. Manter a página da Transportadora funcionando**
- `TranspRotaAtacado.tsx` passa a importar o mesmo componente wrapper, sem duplicação de código

**4. Arquivos modificados**

| Arquivo | Ação |
|---|---|
| `src/components/operacional/RotaAtacadoDinamica.tsx` | **Novo** — Componente wrapper com toda a lógica |
| `src/pages/operacional/GestaoRotas.tsx` | Adicionar aba "Rota Dinâmica" importando o wrapper |
| `src/pages/transportadora/TranspRotaAtacado.tsx` | Simplificar para usar o wrapper |

### Detalhes técnicos
- O wrapper recebe `empresaId` como prop, tornando-o agnóstico ao layout
- Na página operacional, `empresaId` vem de `unidadeAtual?.empresa_id` (via `useUnidade`)
- Na página transportadora, continua vindo do profile
- Todos os componentes existentes (mapa, timeline, otimizador, resumo, formulário de parada) são reutilizados sem alteração


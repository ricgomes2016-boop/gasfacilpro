# Mover status de rastreamento para o header do app entregador

## Mudanças

### 1. Ocultar o banner "Online e Rastreando"
Em `src/pages/entregador/EntregadorDashboard.tsx` (linhas 159-192), o bloco grande verde "Online e Rastreando / Sua localização está sendo atualizada" deixa de aparecer na tela Início.

O bloco laranja "Iniciar Jornada" continua aparecendo quando o entregador está offline (chama atenção pra ligar a jornada). Quando estiver online, esse espaço fica vazio (o card é removido) — a confirmação de que está online passa a vir do header (item 2 abaixo).

### 2. Mover o card de endereço + Sinal/Bateria/Precisão para o header
Em `src/components/entregador/EntregadorLayout.tsx`:
- Remover o bloco que renderiza `<TrackingStatusCard />` no `<main>` (linhas 155-159).
- Adicionar, dentro do `<header>` logo abaixo da linha do título, uma faixa compacta (somente quando `trackingState.isTracking` for true) com:
  - Linha 1: ícone de pino + endereço resumido (truncate) — fonte pequena.
  - Linha 2: 3 chips inline lado a lado, cada um com ícone + valor compacto: `4G` (sinal), `25%` (bateria, com ícone de carregando quando aplicável), `4m` (precisão GPS). Cores semânticas iguais às atuais (emerald/yellow/red conforme nível).
- A faixa usa fundo translúcido `bg-white/10` sobre o gradient-primary do header, com texto em `text-primary-foreground`, mantendo contraste.
- Quando `isTracking` for falso, a faixa não é renderizada (header volta ao tamanho original).

### 3. Reaproveitamento de lógica
A lógica de geocoding reverso, bateria e rede do `TrackingStatusCard` é movida para um componente novo enxuto `TrackingStatusHeader` em `src/components/entregador/TrackingStatusHeader.tsx`, com a mesma fonte de dados (props `tracking: GeoTrackingState`).
O arquivo `TrackingStatusCard.tsx` pode ficar como está (não é referenciado em mais nenhum lugar além do Layout) — apenas deixa de ser usado.

## Escopo
- `src/pages/entregador/EntregadorDashboard.tsx` — remover banner verde "Online e Rastreando".
- `src/components/entregador/EntregadorLayout.tsx` — remover render do card no main, embutir nova faixa no header.
- `src/components/entregador/TrackingStatusHeader.tsx` — novo componente.

Nenhuma alteração em rotas, providers, App.tsx, hooks de tracking ou lógica de negócio.

## Validação
Abrir `/entregador` no preview mobile:
- Online → header expande com endereço e chips Sinal/Bateria/Precisão; a tela Início não mostra mais o card verde grande.
- Offline → header volta compacto; tela Início mostra o card laranja "Iniciar Jornada".

## Redesign premium do App do Cliente

Aplicar o redesign aprovado (header limpo, stepper conectado no rastreamento, cards com gradiente e microinterações) mantendo toda a lógica atual intacta.

### 1. Header & Layout (`src/components/cliente/ClienteLayout.tsx`)
- Remover `ring-1`, `bg-white/15` e excesso de blur do header.
- Header sticky minimalista: logo/nome da unidade à esquerda, ações à direita.
- Bottom nav com indicador "pill" animado abaixo do item ativo, badge `animate-bounce` no carrinho, ícones com `transition-transform` no toque.
- Safe-area (`pb-[env(safe-area-inset-bottom)]`) e altura consistente em mobile.

### 2. Home (`src/pages/cliente/ClienteHome.tsx`)
- Saudação personalizada ("Bom dia, {nome}") + linha curta com a unidade.
- **Hero "Pedido em andamento"**: card com gradiente (`from-primary/15 to-accent/10`), ícone animado (`animate-pulse`), status atual e CTA "Acompanhar" → `/cliente/rastreamento/:id`. Usa `last_pedido_id` do localStorage como fallback enquanto a query não responde.
- Chips de categoria horizontais com scroll suave.
- ProductCard refinado: imagem `aspect-square`, preço com hierarquia clara, stepper compacto, botão "Adicionar" com `hover-scale` e feedback `scale-in` ao adicionar.
- Skeleton states em vez de spinner.

### 3. Histórico (`src/pages/cliente/ClienteHistorico.tsx`)
- Cards de pedido com gradiente sutil por status (pendente/em rota/entregue/cancelado) usando tokens semânticos.
- Linha do tempo compacta no card (data, itens, total) e CTA "Acompanhar" para pedidos ativos.
- Empty state ilustrado com CTA "Fazer primeiro pedido".

### 4. Rastreamento (`src/pages/cliente/ClienteRastreamento.tsx`)
- Stepper vertical conectado (linha que preenche conforme avança) com 4 estágios: Recebido → Em preparo → Em rota → Entregue.
- Card de status hero com ícone animado e ETA estimado.
- Botões prominentes "Ligar" e "WhatsApp" para a unidade, full-width em mobile.
- Inicializar `previousStatusRef` imediatamente para evitar toast falso na primeira carga.
- Resumo do pedido (itens, endereço, total) em card colapsável.

### 5. Tokens & animações
- Usar somente tokens semânticos (`bg-primary`, `text-foreground`, `bg-card`, etc.) — sem cores hardcoded.
- Animações via utilitários existentes (`animate-fade-in`, `animate-scale-in`, `hover-scale`, `animate-pulse`).
- Tipografia mantém Plus Jakarta Sans (memória do projeto).

### Fora de escopo
- Não tocar em `App.tsx`, rotas, providers, edge functions, schema do banco ou lógica de checkout/lookup já corrigida.
- Sem novas dependências.

### Arquivos a editar
- `src/components/cliente/ClienteLayout.tsx`
- `src/pages/cliente/ClienteHome.tsx`
- `src/pages/cliente/ClienteHistorico.tsx`
- `src/pages/cliente/ClienteRastreamento.tsx`

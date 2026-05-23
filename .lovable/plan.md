## Rodapé fixo motivacional em todas as telas internas

Hoje o rodapé com frase motivacional existe só em `/auth` (CircleAuthLayout). Vamos replicá-lo em todos os layouts internos (ERP + portais), mantendo o mesmo visual e a regra de "uma frase fixa por portal".

### 1. Novo `src/components/layout/SystemFooter.tsx`
- Detecta o `portalKey` (admin, painel, cliente, entregador, contador, transportadora, parceiro) via path/subdomínio.
- Usa `n(portalKey)` de `@/lib/motivationalQuotes` (mesma função do CircleAuthLayout), fixado com `useState` para não trocar em re-render.
- Render: `<footer>` `fixed bottom-0 left-0 right-0 z-40 border-t border-border/40 bg-background/80 backdrop-blur-md` com um dot colorido + frase em itálico `text-xs md:text-sm text-muted-foreground` centralizado.
- **Oculto no mobile** (`hidden md:flex`) para não conflitar com a `MobileBottomBar`.

### 2. Inclusão nos layouts (apenas render do `<SystemFooter />` no final + `md:pb-10` no container principal para não cobrir conteúdo)
- `src/components/layout/MainLayout.tsx` (ERP)
- `src/components/cliente/ClienteLayout.tsx`
- `src/components/entregador/EntregadorLayout.tsx`
- `src/components/contador/ContadorPortalLayout.tsx`
- `src/components/transportadora/TransportadoraLayout.tsx`
- `src/components/parceiro/ParceiroLayout.tsx`
- `src/components/admin/AdminLayout.tsx`

### 3. Critérios
- Rodapé fixo aparece em todas as telas internas (ERP + portais) no desktop.
- Oculto no mobile (não afeta MobileBottomBar).
- Frase varia por portal/subdomínio usando o mesmo gerador do `/auth`.
- Conteúdo não fica coberto pelo rodapé.
- Não altera `App.tsx`, providers ou rotas.

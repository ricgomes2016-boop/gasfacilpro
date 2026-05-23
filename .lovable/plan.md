## Problema

Na tela **Pedidos**, ao clicar em **Nova Venda**, navega para `/vendas/nova`. A sidebar, que estava recolhida, aparece **expandida** novamente.

## Causa raiz

`MainLayout` (`src/components/layout/MainLayout.tsx`) monta seu próprio `<SidebarProvider>` em cada página. Como o estado `collapsed` vive só na memória do provider (`useState(false)` em `src/contexts/SidebarContext.tsx`), toda navegação entre rotas remonta o provider e o estado volta para "expandido".

A regra de estabilidade proíbe refatorar `App.tsx`/aninhamento de providers, então **não vou mover** o `SidebarProvider` para cima.

## Solução

Persistir o estado `collapsed` em `localStorage` dentro do próprio `SidebarContext`, sem mexer em `App.tsx`, `MainLayout` ou em qualquer página.

### Mudanças em `src/contexts/SidebarContext.tsx`

- Chave: `"sidebar:collapsed"`.
- Inicializar `useState` com função leitora do `localStorage` (com `try/catch` p/ SSR / acesso negado).
- `useEffect` grava no `localStorage` sempre que `collapsed` muda.
- Sem alterar API pública (`collapsed`, `setCollapsed`, `toggle`).

### Efeito

Quando o usuário clica "Nova Venda" na tela de Pedidos (ou em qualquer outra navegação), o novo `MainLayout` lê o último valor salvo e a sidebar **permanece recolhida**.

## Fora de escopo

- Não tocar em `App.tsx`, providers globais, `MainLayout` ou rotas.
- Sem mudança visual ou de animação.

## Arquivo

- `src/contexts/SidebarContext.tsx` (único).

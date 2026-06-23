## Objetivo

Resolver 4 pontos no app do cliente (`clientes.gasfacilpro.com.br`):

1. Pedido feito/encerrado no ERP não aparece na tela "Minhas Compras".
2. Garantir que após o checkout abra a tela de acompanhamento com status em tempo real.
3. Mover o botão de menu (☰) para o lugar do "Perfil" na barra inferior — o perfil continua acessível dentro do menu.
4. Elevar o nível visual do app para um padrão "premium" (mobile-first, estilo iFood/99Food).

Sem mexer em `App.tsx`, providers, rotas, ou regras do backend além de leituras.

---

## 1. Pedido do ERP não aparece no app

### Diagnóstico

O lookup atual (`resolveClienteIdForUser`) retorna **um único** `cliente_id`. Se o ERP gravou o pedido em **outro registro de cliente** da mesma empresa (ex: cadastro manual com telefone formatado diferente, ou um cliente "espelho" criado pelo operador), o app filtra `pedidos.cliente_id = <id do app>` e o pedido fica invisível — mesmo sendo do mesmo usuário/telefone.

### Correção

Em `src/lib/clienteAppLookup.ts`, adicionar `resolveAllClienteIdsForUser(...)` que retorna **todos** os `cliente_id` da empresa cujo `telefone` (normalizado em dígitos) bata com o telefone do usuário, **mais** o que bata por e-mail, **mais** o do cache. Resultado: `string[]` deduplicado.

Em `ClienteHistorico.tsx` e `ClienteHome.tsx`, trocar `.eq("cliente_id", clienteId)` por `.in("cliente_id", ids)`. Se `ids.length === 0`, manter o estado vazio atual.

Isso resolve o caso clássico de "pedido criado pelo operador no ERP" aparecer no histórico do cliente sem precisar fundir os cadastros.

---

## 2. Tela de acompanhamento após checkout

Já existe `navigate(`/cliente/rastreamento/${pedido.id}`)` no `ClienteCheckout.tsx` e `ClienteRastreamento.tsx` já assina Realtime em `pedidos` (status) e `entregadores` (posição).

Ajustes pequenos para deixar 100% confiável:

- No checkout, antes de navegar, gravar `localStorage["last_pedido_id"]` para fallback.
- Em `ClienteRastreamento.tsx`: quando `pedido` carrega, inicializar `previousStatusRef.current = pedido.status` imediatamente (já existe, mas garantir ordem para não disparar notificação na primeira carga).
- Adicionar um card "Acompanhar último pedido" em `ClienteHome.tsx` (já existe `pedidoAtivo`) também olhando o `localStorage["last_pedido_id"]` enquanto o Realtime ainda não respondeu, para dar feedback imediato.

Nenhuma mudança na assinatura Realtime — só garantia de UX.

---

## 3. Barra inferior: menu no lugar do Perfil

Em `src/components/cliente/ClienteLayout.tsx`:

- Remover "Perfil" do `bottomNavItems`.
- Adicionar item "Menu" no mesmo lugar (último), que abre o `Sheet` lateral via `setMenuOpen(true)`.
- Remover o botão `Menu` flutuante do header (mantém o header limpo, só com logo + loja).
- Garantir que "Meu Perfil" continua listado dentro do `menuItems` do Sheet (já está).

Resultado: barra inferior fica `Início · Carrinho · Indicar · Carteira · Menu`. O Sheet continua sendo o mesmo, com perfil dentro.

---

## 4. UX/UI "premium" do app

Foco: mobile-first, hierarquia clara, microinterações, sem soluções genéricas. Sem mudar regras de negócio.

### Header
- Reduzir altura, manter gradiente sutil; trocar o "SUA LOJA / Forte Gás" por um título mais limpo: avatar/logo + nome da loja + chevron pequeno (quando há múltiplas lojas). Sem o `ring-1`/`bg-white/15` exagerado.
- Tipografia: peso 600 para o título, tracking ajustado.

### `ClienteHome.tsx`
- Saudação personalizada no topo ("Olá, {primeiro nome} 👋" + linha "Onde vamos entregar hoje?").
- Card hero do pedido ativo: gradiente sutil, ícone animado (pulse no `Truck`), CTA "Acompanhar entrega →".
- Categorias horizontais com chips arredondados (snap scroll).
- ProductCard: já compactado; refinar — sombra `shadow-sm` em vez de `shadow`, hover `scale-[1.01]`, badge "Mais pedido" quando aplicável (apenas visual, sem nova lógica).
- Skeletons com shimmer em vez do `Skeleton` padrão estático nas listas principais.

### `ClienteHistorico.tsx`
- Cards de status (Total / Entregas): adicionar gradiente sutil + ícone em pill colorida.
- Empty state com ilustração maior e CTA destacado.
- Item do pedido: borda esquerda colorida pelo status (amarelo/azul/verde), animação `fade-in` na entrada.

### `ClienteRastreamento.tsx`
- Status card com gradiente animado quando "em_rota".
- Stepper com linha conectando os 3 passos (não só barra de Progress).
- Botão "Ligar para entregador" e "WhatsApp" mais proeminentes (full width, gap melhor).

### Bottom nav
- Indicador ativo: pill `bg-primary/10` atrás do ícone+label, transição suave.
- Badge do carrinho com `animate-bounce` discreta quando muda.

### Tokens/estilo
- Usar exclusivamente tokens semânticos (`bg-primary`, `text-foreground`, `bg-card`) — nada de `text-white`/`bg-black`. Já é o padrão do projeto.
- Tipografia: continua Plus Jakarta Sans (memória do projeto).
- Spacing consistente: gap-3/4 em listas, p-4 em cards, rounded-2xl em destaques.

Sem mudanças em rotas, contextos, ou backend.

---

## Arquivos a editar

```
src/lib/clienteAppLookup.ts          (+ resolveAllClienteIdsForUser)
src/pages/cliente/ClienteHistorico.tsx (.in + UI refino)
src/pages/cliente/ClienteHome.tsx      (.in + saudação + hero ativo + UI refino)
src/pages/cliente/ClienteCheckout.tsx  (grava last_pedido_id)
src/pages/cliente/ClienteRastreamento.tsx (stepper + status premium)
src/components/cliente/ClienteLayout.tsx  (bottom nav Menu no lugar de Perfil; header limpo)
```

Nenhuma migration, nenhum novo provider, nenhuma alteração em `App.tsx`.

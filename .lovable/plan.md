## Objetivo

Replicar no tema **operacional-clean** o padrão de layout do GestãoClick mostrado no vídeo:

1. Header ocupa **toda a largura do topo** (já está, mas o sidebar atualmente "empurra" o conteúdo — vamos remover esse empurrão).
2. Menu lateral fica **fechado por padrão** em qualquer tamanho de tela e abre como **drawer off-canvas (esquerda → direita)** sobre o conteúdo, ao clicar no botão hambúrguer do header.
3. O sidebar aberto continua com o **seletor de loja no topo** seguido de uma **linha divisória**.
4. **Abaixo do header**, em cada página, renderizar uma **sub-barra** com o título da página à esquerda e o **breadcrumb** (ex.: `Início > Contas a receber > Listar`) à direita.

Mudanças restritas ao tema clean — o tema padrão continua exatamente como está hoje. Sem mexer em rotas, providers, App.tsx, lógica de negócio ou dados.

## Arquivos a alterar

### 1. `src/components/layout/MainLayout.tsx`
- No bloco `<main>`, quando `isCleanTheme` for true, **sempre** usar `xl:ml-0` (independente de `collapsed`). Isso faz o conteúdo ocupar a largura inteira e o sidebar virar overlay.

### 2. `src/components/layout/Sidebar.tsx`
- No tema clean, transformar o `<motion.aside>` em **drawer off-canvas em todas as larguras**:
  - Remover `hidden xl:flex` quando clean → usar `flex` sempre, com `translateX(-100%)` quando `collapsed` e `translateX(0)` quando aberto.
  - Ajustar animação: em vez de animar `width` entre 0 e 260, manter `width: 260` e animar `x` entre `-260` e `0`.
  - Adicionar um **overlay escuro** clicável (`bg-black/40`) atrás do sidebar quando aberto (clean), que chama `toggle()` ao clicar — para fechar o menu como no vídeo.
  - Manter `top-14` (logo abaixo do header) e o `UnidadeSelector` com a borda inferior já existente.

### 3. `src/components/layout/Header.tsx`
- No tema clean, o botão hambúrguer atual (`clean-header-menu`) hoje só aparece em `xl:inline-flex`. Trocar para `inline-flex` sempre, e remover o `<MobileNav />` paralelo (no clean) para evitar dois menus.
- Após o `<header>` fixo e o spacer `h-14`, **adicionar uma sub-barra** (apenas no tema clean) com:
  - Esquerda: ícone + `title` (prop existente).
  - Direita: breadcrumb gerado a partir de `useLocation().pathname` — primeiro item fixo "Início" → `/dashboard`, demais segmentos convertidos para rótulos legíveis (mapa simples de slugs → nomes; fallback: capitalizar e trocar `-` por espaço). Último item sem link.
  - Estilo: fundo `bg-card`, borda inferior sutil, `h-12`, `px-4`, texto pequeno, separador `>` em `text-muted-foreground`.

### 4. `src/styles/brand-themes.css`
- Pequenos ajustes no escopo `[data-brand-preset="operacional-clean"]`:
  - Garantir que `.clean-sidebar` tenha `box-shadow` de drawer (`shadow-2xl`) e fique acima do conteúdo (`z-50`).
  - Estilo da nova sub-barra `.clean-page-subbar` (cor de fundo, borda).

## Detalhes técnicos do breadcrumb

Mapa inicial mínimo (estende-se conforme necessário):

```
financeiro          → Financeiro
contas-a-receber    → Contas a receber
contas-a-pagar      → Contas a pagar
vendas              → Vendas
pedidos             → Pedidos
clientes            → Clientes
estoque             → Estoque
dashboard           → Início
```

Último segmento de listagem mostra "Listar" como item final (quando o path termina em uma rota de lista sem id).

## Fora do escopo

- Não alterar o tema padrão (não-clean).
- Não mexer em `App.tsx`, providers, rotas, hooks de dados.
- Não criar páginas novas nem alterar a navegação real (apenas leitura do `pathname`).

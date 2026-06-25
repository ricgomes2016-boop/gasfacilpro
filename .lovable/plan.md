## Visão geral

Adicionar um novo preset visual chamado **Operacional Clean** que muda a estrutura do Header + Sidebar quando ativo, sem afetar nenhum outro tema. Visual baseado nas imagens enviadas (estilo GestãoClick): header escuro, seletor de loja no topo do menu lateral (no lugar do logo grande), e abaixo do header uma faixa com título da tela + atalhos.

## 1. Registrar o tema

`src/lib/brandThemes.ts`
- Acrescentar novo preset `{ id: "operacional-clean", name: "Operacional Clean", className: "brand-theme-operacional-clean", … }`.
- Atualizar o tipo `BrandThemeId`.

`src/styles/brand-themes.css`
- Bloco `.brand-theme-operacional-clean` com tokens próprios:
  - `--sidebar-background` branco/cinza muito claro
  - `--sidebar-foreground` cinza escuro
  - `--sidebar-accent` cinza neutro (hover)
  - `--background` cinza claríssimo
  - `--header-bg` (var custom) preto/grafite (`#0F172A`-ish)
  - `--header-foreground` branco

`src/pages/config/PersonalizacaoVisual.tsx`
- Garantir que o card de seleção liste o novo preset (vem automático via `brandThemes`, só validar).

## 2. Header — só quando o tema está ativo

`src/components/layout/Header.tsx`
- Ler `useDashboardTheme()` e detectar `isClean = theme === "operacional-clean"`.
- Quando `isClean`:
  - Aplicar fundo escuro + texto claro (classe `app-header-clean`).
  - Esconder o bloco de título/subtitle dentro do header (vai para a faixa nova abaixo).
  - Mostrar à esquerda: botão menu (toggle do sidebar, já que o sidebar agora colapsa totalmente) + marca compacta "GasFácil" + logo pequena.
  - Mostrar à direita apenas os ícones da imagem 3 + IA: `CommandPalette` (busca), `BaseChatPanel` (telefone/chat), `NotificationCenter` (sino), `CalculatorPopover` (calculadora), botão da **Assistente IA** (sparkles roxo, igual imagem 4) e avatar do usuário.
  - **Não** renderizar `UnidadeSelector` aqui (vai para dentro do menu).
- Adicionar botão "menu" (ícone hamburger) só no clean, visível também em desktop, chamando `toggle()` do `SidebarContext` (mesmo que já existe para mobile/MobileNav).

## 3. Sidebar — adaptações para o tema clean

`src/components/layout/Sidebar.tsx`
- Quando `isClean`:
  - No header interno do sidebar, substituir o logo + "Gas Facil / ERP PRO" por `<UnidadeSelector variant="sidebar" />` (card com nome da loja, igual imagem 1 — "MATRIZ / CNPJ").
  - Permitir colapso total (não só ícone). Quando `collapsed === true` no clean, **não** renderizar o `<aside>` (retorna `null`), de modo que o conteúdo ocupe a tela inteira como na imagem 2.
  - Ajustar `MainLayout` para que `xl:ml-[260px]` vire `xl:ml-0` quando clean+collapsed (regra: `collapsed && isClean ? "xl:ml-0" : collapsed ? "xl:ml-16" : "xl:ml-[260px]"`).

`src/components/layout/UnidadeSelector.tsx`
- Adicionar prop opcional `variant?: "header" | "sidebar"`. No modo `sidebar`, renderiza um card vertical (avatar + nome MATRIZ + CNPJ + chevron) que abre o mesmo dropdown.

## 4. Faixa de título + atalhos abaixo do header

Novo arquivo `src/components/layout/CleanPageBanner.tsx`
- Componente que recebe `title`, `subtitle`, `badge?` e renderiza:
  - Linha 1: título grande + chip de build (igual imagem 5).
  - Linha 2: nome empresa · subtitle · chip da unidade (igual imagem 5).
  - Linha 3 (atalhos): breadcrumb estilo imagem 6 ("Início > Vendas de produtos > Listar") gerado a partir de `useLocation()` + map dos `menuItems`.

`src/components/layout/Header.tsx`
- Quando `isClean`, renderizar `<CleanPageBanner>` logo após o `<header>` (dentro do mesmo Fragment, antes do spacer).
- Ajustar a altura do spacer (`<div aria-hidden>`) para acomodar o banner.

## 5. CSS de suporte

`src/index.css`
- `.app-header-clean { background: hsl(var(--header-bg)); color: hsl(var(--header-foreground)); border-color: rgba(255,255,255,0.05); }` e variantes para os ícones ficarem brancos/roxos.
- Estilo do botão IA no header (gradiente roxo + sparkle, igual imagem 4).
- Estilo do `CleanPageBanner` (fundo branco/cinza-claro, divisor sutil, tipografia bold).

## Fora de escopo

- Não muda nada em outros temas (premium, gasfacil, gasmais, etc.).
- Não mexe em rotas, dados, edge functions, schema, KPIs nem cards.
- Mobile (`MobileNav`/`MobileBottomBar`) permanece igual.

## Aceitação

1. Selecionar "Operacional Clean" em /config/personalizacao aplica:
   - Header preto com busca, telefone, sino, calculadora, IA (sparkle) e avatar.
   - Sidebar claro com o card da unidade ocupando o topo (sem logo Gás Fácil).
2. Clicar no ícone de menu do header recolhe o sidebar por completo (some), e o conteúdo ocupa 100% da largura; header mantém só logo + nome + botão menu + ícones da direita.
3. Abaixo do header aparece a faixa com título da tela + breadcrumb de atalhos.
4. Outros temas continuam idênticos ao que são hoje.

## Problema

Em `/operacional/vendedores` não aparecem o **menu lateral** nem o **header** que existem nas demais páginas do ERP.

A causa não é o `MainLayout` (ele já está aplicado). É que:

- O `Sidebar` do ERP só fica visível em telas `xl` (≥ 1280px). Em viewports menores (o usuário está em 1070px) o acesso ao menu vem do componente `<Header />`, que renderiza o título + o `MobileNav` (botão hambúrguer que abre o menu lateral em sheet).
- Todas as outras páginas (`DRE`, `DashboardExecutivo`, `BolaoAdmin`, etc.) chamam `<Header title="..." subtitle="..." />` logo no topo do conteúdo.
- `src/pages/operacional/Vendedores.tsx` não usa o `<Header>`; tem apenas um `<h1>` inline, então o cabeçalho oficial e o gatilho de menu somem nessa rota.

## Mudança

Arquivo: `src/pages/operacional/Vendedores.tsx`

1. Importar `Header` de `@/components/layout/Header`.
2. Dentro de `VendedoresInner`, renderizar `<Header title="Vendedores" subtitle="Desempenho, metas e comissão por vendedor" />` como primeiro filho do wrapper.
3. Remover o bloco `<h1>` inline com ícone `Users` que servia de título (para evitar duplicação). Manter o badge de período (`Período: range.label`) logo abaixo do `Header`, dentro do container `p-4 md:p-6`.

Sem alterações em rotas, `App.tsx`, providers, `MainLayout`, ou no Sidebar/breakpoints — apenas alinhamento da página ao padrão das demais.

## Fora de escopo

- Não mexer no breakpoint `xl:` do Sidebar.
- Não alterar `operacionalRoutes.ts` nem qualquer outra página.
- Nenhuma mudança de lógica/consultas da página.

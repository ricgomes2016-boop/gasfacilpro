
## Diagnóstico definitivo

O problema persistente em mobile na tela `/vendas/nova` tem **três causas raiz** que ainda não foram atacadas corretamente:

### 1. Auto-zoom do navegador mobile (fonte "fica grande")
O componente `Input` em `src/components/ui/input.tsx` usa `text-base` (16px) por padrão, mas com `md:text-sm` (14px no desktop). Em mobile fica 16px — isso normalmente evita auto-zoom. **MAS**: vários inputs do `NovaVenda`, `ProductSearch`, `CustomerSearch` recebem `className="... text-sm h-7 ..."` ou `text-xs`, o que **sobrescreve** para <16px e dispara o **auto-zoom do iOS Safari / Android Chrome** ao focar — fazendo a página inteira parecer "esticar" e os inputs "mudarem de lugar".

### 2. Falta de `viewport meta` com `maximum-scale`
Sem `maximum-scale=1` no `<meta viewport>` em `index.html`, o navegador faz zoom automático ao focar inputs com fonte <16px, e o usuário **não consegue voltar** ao zoom original (sensação de "não consigo arrastar para o lado").

### 3. Containers sem `overflow-x: hidden` no nível da página
O `MainLayout` tem `overflow-x-hidden`, mas o `<main>` filho e o container de `NovaVenda` não. Quando o auto-zoom é acionado, o conteúdo fica "preso" zoomado e parece quebrado.

## Solução (3 frentes simultâneas)

### A. Forçar fonte ≥16px em TODOS os inputs/selects/textareas em mobile
Adicionar regra global em `src/index.css`:
```css
@media (max-width: 767px) {
  input, select, textarea {
    font-size: 16px !important;
  }
}
html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
```
Isso **elimina o auto-zoom** independentemente das classes Tailwind aplicadas em cada input.

### B. Bloquear zoom forçado no viewport
Atualizar `index.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
```

### C. Garantir overflow-x-hidden em cascata
- Adicionar `overflow-x-hidden` em `<html>` e `<body>` via `index.css`
- Adicionar `min-w-0 max-w-full overflow-x-hidden` no container raiz de `NovaVenda.tsx`

### D. Reduzir altura visual mantendo 16px
Para inputs que precisavam ser "compactos" (`h-7`, `h-8`), manter altura pequena mas garantir fonte 16px — a regra global cuida disso. Visualmente o input fica compacto, sem disparar zoom.

## Arquivos a editar
1. `src/index.css` — regra global de fonte ≥16px em mobile + overflow-x-hidden em html/body
2. `index.html` — meta viewport com `maximum-scale=1, user-scalable=no`
3. `src/pages/vendas/NovaVenda.tsx` — wrapper raiz com `overflow-x-hidden max-w-full min-w-0`

## Validação
Após implementar, vou abrir `/vendas/nova` em viewport 375x812 com o browser, focar em vários inputs (telefone, nome, endereço, quantidade de produto, preço), e tirar screenshots para confirmar:
- Nenhum auto-zoom ao focar inputs
- Nenhum elemento vaza horizontalmente
- Layout permanece estável após selecionar cliente
- Inputs mantêm posição e não "pulam"

Esta abordagem ataca a **causa raiz universal** (auto-zoom + viewport) ao invés de corrigir componente por componente, resolvendo o problema em **toda a aplicação** de uma vez.

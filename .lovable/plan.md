# Refinamento Premium — App do Cliente

Ajustes focados em 3 pontos pedidos + polimento geral de UX, sem mexer em rotas, providers ou App.tsx.

## 1. Header da loja (ClienteLayout.tsx)

Hoje o título "Forte Gás" aparece em branco sobre o fundo `primary` cheio, com peso visual desproporcional e o `LojaSelector` colado embaixo, deixando o header alto e "pesado".

Mudanças:
- Substituir o fundo chapado `bg-primary` por um header em **gradiente sutil** (`from-primary via-primary to-primary/85`) com leve sombra e borda inferior translúcida — combinando com o hero da Home.
- Título com tipografia refinada: `text-base font-semibold tracking-tight` + um chip pequeno acima ("Sua loja") em `text-[10px] uppercase opacity-70`. Cor do título: `text-primary-foreground` (mantém contraste em qualquer tema da unidade), com leve `drop-shadow` para destaque.
- Logo da unidade dentro de um círculo `bg-white/15 backdrop-blur` `h-9 w-9` para dar profundidade.
- Reduzir padding vertical (`py-2.5` no lugar de `py-3`) e enxugar o `LojaSelector` para ficar inline ao lado do nome quando houver mais de uma loja, ou esconder quando só existir uma.
- Botão Menu com `bg-white/10` para não sumir no gradiente.

Resultado: header mais baixo, elegante e coerente com o gradiente do hero da Home.

## 2. Espaçamento — não cobrir o botão flutuante "Ver carrinho"

Hoje há **dois botões flutuantes**: um no `ClienteLayout` (`bottom-[72px]`) e outro dentro de `ClienteHome` (`bottom-20`), e ambos podem cobrir conteúdo/duplicar.

Mudanças:
- Remover o botão flutuante duplicado do `ClienteHome` (manter apenas o do Layout, que é global).
- Ajustar o botão do Layout para `bottom-[76px]`, com `rounded-2xl`, `h-13`, sombra `shadow-xl shadow-primary/30` e leve animação de entrada (`animate-in slide-in-from-bottom-4`).
- Aumentar o `pb` do `<main>` para `pb-28` quando carrinho > 0 e `pb-20` quando vazio (condicional), para o último card de produto nunca ficar coberto.
- Adicionar `scroll-pb-28` no container para que rolagem por âncora respeite o espaço.

## 3. Fotos dos produtos (igual Nova Venda)

A query já é idêntica à do PDV (`image_url` incluído). O problema visual real:
- Quando `image_url` é nulo, hoje aparece só um ícone genérico — diferente da Nova Venda que mostra a foto cadastrada do produto.
- Cards usam `object-contain p-2` em fundo `bg-muted/30`, perdendo destaque.

Mudanças no `ProductCard` (ClienteHome.tsx):
- Aumentar a área da foto para `w-32 h-32` em telas estreitas, fundo `bg-gradient-to-br from-muted/40 to-muted/10`, `rounded-xl m-2` (foto "flutuando" dentro do card, estilo iFood/Uber Eats).
- `object-contain` mantido, com `drop-shadow-sm` para dar profundidade.
- Fallback inteligente: se não houver `image_url`, usar **a mesma imagem padrão do produto-pai** (consultar `produtos` na empresa quando a loja não tem imagem) — query secundária buscando por `nome` + `empresa_id` para preencher imagens faltantes. Sem alterar dados, só fallback em runtime.
- Badge "Mais pedido" 🔥 no produto de maior categoria gás (visual, sem regra nova).

## 4. Polimento geral premium (escopo enxuto)

- Hero banner: reduzir altura em ~20%, gradiente já existente mantido, mas com um `noise/grain overlay` muito sutil (CSS, sem assets).
- Cards de produto com `transition-transform active:scale-[0.98]` para feedback tátil.
- Tipografia das seções ("Gás", "Água & Outros") com divisor sutil à direita: `<h2>Gás</h2><div className="h-px flex-1 bg-border/60"/>`.
- Bottom nav com leve `backdrop-blur-md bg-background/80` para parecer flutuante.

## Arquivos afetados

- `src/components/cliente/ClienteLayout.tsx` — header, botão flutuante único, padding condicional, bottom nav blur.
- `src/pages/cliente/ClienteHome.tsx` — remover botão flutuante duplicado, refinar `ProductCard`, fallback de imagem, hero compacto, divisores de seção.

## Fora de escopo

- `App.tsx`, providers, rotas, autenticação, schemas/RLS.
- Páginas além de Home (Carrinho/Checkout/Perfil ficam para um próximo ciclo).
- Mudança de paleta de marca/tema da unidade.

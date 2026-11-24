# Cards da tela Produtos no estilo "Acesso Rápido"

## O que muda
Os 5 cards do topo da tela **Cadastros → Produtos** (Total, Gás, Água, Acessórios, Baixo Estoque) passam a ter o mesmo visual dos botões do Acesso Rápido do Dashboard:
- Fundo de cor sólida, cantos arredondados, sombra suave.
- Ícone branco no centro, número grande em branco e o nome embaixo.
- **Celular: 2 cards por linha** (como na imagem). Computador: 5 lado a lado.

## Cores (mesmas do Acesso Rápido)
- Total: azul
- Gás: laranja
- Água: azul
- Acessórios: verde
- Baixo estoque: vermelho

A lista de produtos abaixo e as contas dos números não mudam.

## Detalhes técnicos
- Arquivo: `src/pages/cadastros/Produtos.tsx` (linhas ~1079-1130).
- Trocar os `Card` por `div` com as classes do `quick-action-tile` de `QuickActions.tsx` (`rounded-xl min-h-[96px] flex-col items-center justify-center`, sombra igual, `!text-white` com `style={{color:"#fff"}}` para vencer as regras globais de `.system-surface`).
- Grid: `grid-cols-2 md:grid-cols-5 gap-3`; o quinto card no celular ocupa a linha inteira (`col-span-2 md:col-span-1`) para não ficar sozinho.
- Reaproveitar os mesmos tons hex do `QuickActions`.

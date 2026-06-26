## Problema

No APK do entregador, na tela **Finalizar Entrega**, o botão "Finalizar Entrega" fica parcialmente coberto pela barra de navegação inferior fixa (bottom nav do `EntregadorLayout`).

Causa: o `<main>` em `EntregadorLayout.tsx` usa `pb-20` (80 px), mas a bottom nav fixa soma sua altura + `env(safe-area-inset-bottom)` (gesture bar do Android), totalizando mais que 80 px. O conteúdo final é encoberto.

## Correção

1. **`src/components/layout/EntregadorLayout.tsx`**
   - Trocar `pb-20` do `<main>` por `pb-[calc(5.5rem+env(safe-area-inset-bottom))]` para garantir folga real abaixo do conteúdo em qualquer dispositivo (Android com barra de gestos / iOS com home indicator).

2. **`src/pages/entregador/FinalizarEntrega.tsx`**
   - Adicionar um espaçador final (`<div className="h-4" />`) após o botão Finalizar, dentro do container `space-y-4`, para garantir respiro visual mesmo em telas menores.

Apenas ajuste de presentation/CSS — sem alterações de lógica de negócio.
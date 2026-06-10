# Corrigir Assistente IA abrindo escondido

## Problema

Quando o usuário abre o assistente flutuante (no canto inferior direito), o painel aparece ancorado à esquerda e com a maior parte do conteúdo cortada abaixo da área visível — só dá para ler o cabeçalho e o "Olá. Como posso ajudar?".

Causas no `AiFloatingButton.tsx`:

1. O painel usa `left-0 right-0` (full-width) no mobile e só passa para `md:left-auto md:right-6 md:w-[380px]` a partir de 768px. Em viewports estreitos (~390px) o painel ocupa a tela toda, mas como `bottom-[52px]` coloca o topo logo acima da barra inferior, sobra pouca altura visível.
2. `h-[calc(80vh-52px)]` usa `vh`, que em mobile inclui a UI do navegador — o painel acaba “entrando” na barra de endereço/teclado e fica recortado.
3. No mobile não há ancoragem à direita visível porque o botão flutuante está escondido (`hidden md:flex`), então o painel é aberto pela barra inferior, mas continua se abrindo da base da viewport sem espaço suficiente.

## Mudanças (apenas `src/components/ai/AiFloatingButton.tsx`)

1. Trocar `h-[calc(80vh-52px)]` por uma altura baseada em `svh` (small viewport height) com teto seguro: `h-[70svh] max-h-[calc(100svh-120px)]`. Isso evita o corte pela UI do navegador mobile.
2. Aumentar o offset inferior no mobile de `bottom-[52px]` para `bottom-[64px]` para dar respiro acima da bottom-nav.
3. Adicionar `inset-x-2` no mobile (em vez de `left-0 right-0`) para o painel não colar nas bordas e mostrar a sombra/borda.
4. Manter desktop intacto: `md:bottom-16 xl:bottom-[136px] md:right-6 md:left-auto md:inset-x-auto md:w-[380px] md:h-[520px] md:max-h-[calc(100vh-6rem)]`.
5. Adicionar `rounded-2xl` no mobile (hoje só arredonda topo) para o painel ter cantos arredondados nos quatro lados quando flutuando.

## Resultado esperado

- Mobile: painel flutua acima da barra inferior, com margem nas laterais, altura ~70% da viewport visível, conteúdo totalmente legível.
- Desktop: comportamento atual preservado (canto inferior direito, 380×520).

Nenhuma mudança em lógica, rotas ou no `AiAssistantChat`.

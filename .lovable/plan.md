
## Objetivo
Redesenhar a página `/fortegas` (`src/pages/publico/ForteGas.tsx`) com estética moderna inspirada nas referências enviadas: ilustrações artísticas com manchas de aquarela/tinta, gradientes vibrantes (roxo/teal/rosa), tipografia editorial moderna, layouts assimétricos com sobreposição de camadas e elementos gráficos orgânicos.

## Conceito Visual "Fluid Energy"
- **Paleta**: gradientes vibrantes (laranja chama → magenta → roxo → teal) sobre base escura premium
- **Estilo**: manchas de tinta/aquarela como elementos de fundo, "blobs" orgânicos animados, splashes coloridos, glassmorphism
- **Tipografia**: títulos editoriais grandes com mix de pesos (display + thin), letras cursivas decorativas para palavras-chave
- **Layout**: assimétrico, com camadas sobrepostas (ilustração + texto + cards flutuantes), seções com bordas curvas/onduladas
- **Detalhes**: partículas, brilhos, micro-animações, ícones gradientes, cards com bordas iluminadas

## Mudanças por seção

### Hero
- Background com manchas de aquarela vibrantes (laranja + magenta + teal) sobrepostas, em vez dos blobs simples atuais
- Ilustração de chama estilizada (gerada via IA — Nano Banana) à direita em desktop, com efeito splash
- Título editorial em duas linhas, palavra "porta" em script cursivo dourado
- CTA com efeito de brilho animado

### Sobre
- Layout assimétrico com mancha de tinta de fundo
- Cards de produtos com gradientes vibrantes diferentes (laranja, magenta, teal, roxo) e ícones flutuantes

### Serviços
- Cards estilo "revista" com bordas iluminadas em hover, números grandes (01, 02, 03, 04) como elemento decorativo
- Splashes de cor entre cards

### Diferenciais
- Layout em zig-zag com ilustrações orgânicas
- Ícones com fundo gradiente vibrante e animação flutuante

### CTA Banner
- Banner com gradiente magenta→laranja→roxo, splash decorativo, tipografia editorial grande

### Contato
- Cards glassmorphism com bordas gradientes coloridas

### Footer
- Mais elegante, com gradiente sutil

## Recursos a gerar
1. **1 ilustração gerada via IA** (Nano Banana) — chama abstrata estilo aquarela vibrante para o hero, salva em `src/assets/forte-gas-hero-art.png`

## Arquivos
- `src/pages/publico/ForteGas.tsx` (reescrita visual completa, mantendo estrutura/links/WhatsApp/dados)
- `src/assets/forte-gas-hero-art.png` (novo asset gerado)

## Validação
- Build sem erros
- Página carrega em `/fortegas` mantendo todos os links (WhatsApp, telefone, endereço) intactos
- Responsivo no viewport mobile (384px) e desktop

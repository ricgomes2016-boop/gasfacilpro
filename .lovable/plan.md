
Vou criar um novo preset de tema "Fluid Energy Light" em `src/pages/config/PersonalizacaoVisual.tsx`, com fundo claro, gradientes vibrantes em azul/ciano e cards modernos com brilho.

## O que vou fazer

**1. Novo preset no arquivo `src/pages/config/PersonalizacaoVisual.tsx`**
- Adicionar um novo item na lista de presets: `forte-gas-light` (label: "Forte Gás · Fluid Light")
- Paleta clara:
  - Background: branco levemente azulado (`hsl(210 40% 98%)`)
  - Foreground: navy escuro para contraste (`hsl(222 47% 11%)`)
  - Card: branco puro com leve tom (`hsl(0 0% 100%)`)
  - Primary: azul vibrante (`hsl(210 100% 55%)`)
  - Accent: ciano elétrico (`hsl(190 95% 50%)`)
  - Gradient primary: 4 stops claros — `#dbeafe → #93c5fd → #38bdf8 → #06b6d4`
  - Shadow glow: azul suave para dar brilho (`0 0 30px hsl(210 100% 60% / 0.35)`)
- Swatches de preview atualizados com tons claros + acento ciano

**2. Cards modernos com brilho (escopo do tema)**
Adicionar regras CSS escopadas no mesmo preset (via `--gradient-card` e injetar uma classe utilitária no preset) para que cards usando `bg-card` ganhem:
- Borda sutil com gradiente
- Sombra azul suave (glow)
- Hover com leve elevação
- Topo com linha em gradiente azul→ciano

Como o sistema já aplica `PRESET_THEME_OVERRIDES` via CSS vars no `:root`, vou:
- Adicionar variáveis extras: `--gradient-card`, `--gradient-hero`, `--card-glow`
- Adicionar um pequeno bloco de CSS injetado (já existe padrão similar no arquivo) para o preset `forte-gas-light` que estiliza `.card`/`[data-theme-card]` com a sombra e gradiente quando o preset estiver ativo

**3. Sem mexer em outros temas**
Não vou alterar `forte-gas` (Fluid Energy escuro) nem `gasmais`. Apenas adicionar o novo preset claro.

## Resultado esperado
Um tema claro, arejado, com brilho azul/ciano nos cards e gradientes suaves no fundo de elementos hero — visual moderno tipo fintech/SaaS, alinhado ao site Forte Gás mas em modo light.


## Objetivo
Três ajustes visuais no site `/fortegas`:
1. Remover fundo branco da logo no header (deixar transparente, integrada ao tema escuro)
2. Modernizar visual da Bia (botão flutuante + avatar do header do chat)
3. Transformar os 3 cards "Pronto Agora / P13 / Entrega Expressa" do hero em botões que abrem a Bia

## Investigação rápida
Já tenho contexto de `BiaChatWidget.tsx`. Preciso confirmar:
- Como a logo está renderizada hoje em `ForteGas.tsx` (provavelmente `<img>` com bg branco)
- Onde estão os 3 cards informativos do hero
- Como expor um trigger externo para abrir o widget (hoje o `open` é state interno do widget)

## Mudanças

### 1. Logo header (Forte Gás)
- Remover qualquer `bg-white` / `rounded` do container da logo.
- Aplicar `mix-blend-mode: screen` ou usar a logo com fundo já transparente sobre o tema escuro.
- Caso a logo original tenha fundo branco "queimado" no PNG, gerar via IA (Nano Banana) versão sem fundo OU aplicar máscara CSS (`backdrop-filter` + `mix-blend-screen`) para integrar visualmente.
- Estratégia escolhida: aplicar `mix-blend-mode: screen` + leve drop-shadow — solução limpa sem regenerar asset.

### 2. Bia mais moderna
- **Botão flutuante**: substituir o ícone `Bot` genérico por um avatar circular com gradiente animado (anel rotativo com conic-gradient), iniciais "BIA" estilo neon, ou um ícone de IA mais sofisticado (Sparkles + Bot combinados). Adicionar partículas/glow ao redor.
- **Header do chat**: avatar maior com efeito de gradient ring animado, nome com tipografia editorial, badge "IA · Online" mais elegante.
- Opcional: gerar avatar próprio da Bia via IA (rosto estilizado/abstrato) — mas mantenho ícone vetorial pra ser leve e consistente com o tema "Fluid Energy".

### 3. Cards do hero → botões para a Bia
- Os 3 cards ("Pronto Agora", "P13", "Entrega Expressa") viram botões clicáveis.
- Ao clicar → abre o `BiaChatWidget` automaticamente E injeta uma mensagem inicial contextual:
  - "Pronto Agora" → "Quero gás agora!"
  - "P13" → "Quero pedir um P13"
  - "Entrega Expressa" → "Preciso de entrega expressa"
- Bia já responde direto pedindo o telefone, encurtando o funil.

### 4. Refatoração técnica para integrar cards ↔ widget
- Expor controle externo no `BiaChatWidget` via props opcionais:
  - `openSignal?: number` (incrementa para forçar abrir)
  - `prefilledMessage?: string` (mensagem pré-preenchida no input ao abrir)
- Em `ForteGas.tsx`, manter um state `{ openSignal, prefill }` e os 3 botões disparam esse state.

## Arquivos a editar
- `src/pages/publico/ForteGas.tsx` — logo (mix-blend), cards viram botões, state de controle da Bia
- `src/components/publico/BiaChatWidget.tsx` — novo visual do botão flutuante + avatar do header, props `openSignal` e `prefilledMessage`

## Validação
- Header: logo aparece sem retângulo branco, integrada ao fundo escuro
- Botão da Bia: visual mais "premium" (gradient ring animado, glow)
- Clicar em qualquer um dos 3 cards do hero abre a Bia já com a frase pronta no input
- Mobile (384px) continua responsivo



## Atualizações no site Japa Gás

### 1. Remover menção a "filial Central Gás"
- Header: remover badge "Filial Central Gás"
- Footer: remover "Filial Central Gás"
- Sobre: reescrever sem mencionar Central Gás

### 2. Atualizar contatos
- WhatsApp: `5543999892022` (display: `(43) 99989-2022`)
- Telefone: `(43) 3542-3003`
- Endereço: `Rua Gilberto Freire, 340 — Vila Maria, Bandeirantes, PR`

### 3. Atualizar imagem do hero (botijões padrão brasileiro)
- Copiar `user-uploads://image-79.png` como nova imagem dos botijões
- Usar Lovable AI (`google/gemini-2.5-flash-image`) **apenas para corrigir o fundo** — substituir o fundo azul atual por um fundo coerente com a paleta da página (off-white/teal sutil) preservando os botijões idênticos
- Salvar como `src/assets/japa-gas/botijoes.png` e usar na seção Sobre (substituindo `hero.jpg`)

### 4. Integrar a Bia (mesmo padrão Forte/Central)
- Importar `BiaChatWidget` de `@/components/publico/BiaChatWidget`
- Hero recebe `onAskBia(msg)`; converter os 3 quick-actions em botões que disparam a Bia com mensagens:
  - "Pronto agora" → "Quero gás agora!"
  - "Gás P13" → "Quero pedir um P13!"
  - "Entrega expressa" → "Preciso de entrega expressa, por favor!"
- Adicionar legenda discreta "Falar com a Bia →" nos cards
- No componente raiz `JapaGas`, adicionar estado `biaState` e renderizar:
  ```tsx
  <BiaChatWidget
    unidadeSlug="japagas"
    nomeLoja="Japa Gás"
    gradient="from-teal-600 via-teal-500 to-orange-400"
    accent="teal-600"
    openSignal={biaState.openSignal}
    prefilledMessage={biaState.prefill}
  />
  ```

### Arquivos
- **Editar**: `src/pages/publico/JapaGas.tsx`
- **Criar**: `src/assets/japa-gas/botijoes.png` (gerado via IA a partir da imagem enviada, apenas trocando o fundo)


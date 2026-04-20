

## Site Institucional — Japa Gás (filial Central Gás)

Criar uma nova página pública `/japagas` no mesmo padrão estrutural de `CentralGasCP` e `ForteGas`, porém com identidade visual inspirada na imagem de referência (teal/cyan + coral, toques japoneses) e uma seção dedicada de **Dicas de Segurança com fotos**.

### 1. Nova página `src/pages/publico/JapaGas.tsx`

Estrutura (mesma arquitetura do CentralGasCP — Header fixo, Hero, Sobre, Serviços, Dicas, Contato, Footer + WhatsApp flutuante):

- **Paleta** (extraída da imagem):
  - Primário teal: `#2d8a8a` / `#0d7377`
  - Acento coral: `#e07856` / `#d96846`
  - Fundo claro: `#f4f1ea` (off-white com toque de papel washi)
  - Texto escuro: `slate-800`
  - Gradientes hero: `from-teal-700 via-teal-600 to-orange-400`

- **Identidade Japa Gás**: emoji/ícone 🔥 com nome em fonte semi-serifada, badge "Filial Central Gás" sutil no header, motivos sutis (círculo vermelho/sol, linhas finas tipo nankin) como elementos decorativos.

- **Hero**: título "Energia que aquece sua casa", subtítulo bilingue leve ("Tradição e confiança · 信頼"), CTAs WhatsApp + Telefone, 3 quick-actions (Pronto agora / Gás P13 / Entrega expressa).

- **Contatos**: usar mesmos placeholders editáveis no topo do arquivo (`WHATSAPP_NUMBER`, `PHONE`, `ENDERECO`) — valores iniciais reaproveitados da Central Gás, fáceis de trocar depois.

### 2. Seção "Dicas de Segurança com Fotos"

Grid de 6 cards, cada um com **foto gerada por IA** (estilo fotográfico realista, paleta coerente), título e descrição curta:

1. Verificação do lacre do botijão
2. Instalação em área ventilada
3. Teste de vazamento com água e sabão
4. Mangueira e regulador dentro da validade
5. O que fazer em caso de vazamento (não acender luz, abrir janelas)
6. Manter botijão sempre em pé, longe do calor

Banner vermelho no topo da seção com **telefones de emergência** (193 Bombeiros, 192 SAMU) — mesmo padrão usado em `ClienteDicas.tsx`.

Imagens geradas via Lovable AI (`google/gemini-2.5-flash-image`) e salvas em `src/assets/japa-gas/seguranca-{1..6}.jpg`, importadas como módulos ES6.

### 3. Roteamento

`src/App.tsx`: adicionar
```tsx
const JapaGas = lazy(() => import("./pages/publico/JapaGas"));
<Route path="/japagas" element={<JapaGas />} />
```

### 4. Integração com tela de divulgação

`src/pages/config/SiteInstitucional.tsx`: adicionar entradas no mapa
```ts
"japa-gas": { path: "/japagas", nome: "Japa Gás" },
"japa gas": { path: "/japagas", nome: "Japa Gás" },
```
Assim, ao selecionar a filial Japa Gás no seletor de unidade, o card de divulgação carrega o link automaticamente.

### Arquivos

- **Criar**: `src/pages/publico/JapaGas.tsx`, `src/assets/japa-gas/seguranca-1.jpg` ... `seguranca-6.jpg`, `src/assets/japa-gas/hero.jpg`
- **Editar**: `src/App.tsx` (rota lazy), `src/pages/config/SiteInstitucional.tsx` (mapa de sites)

### Observações técnicas

- Página totalmente client-side, sem dependência de backend — segue exatamente o padrão de CentralGasCP/ForteGas.
- Imagens geradas uma vez via script temporário e commitadas como assets estáticos (não há chamada de IA em runtime).
- Mobile-first, header com menu hambúrguer, botão WhatsApp flutuante fixo no canto inferior direito.


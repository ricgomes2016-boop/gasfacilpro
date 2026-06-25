## Objetivo
Mover o stepper para o rodapé fixo (apenas em Nova Venda) e ancorar os botões flutuantes (Assistente IA e WhatsApp) também no rodapé fixo em todas as telas.

## Mudanças

### 1. Rodapé global fixo (barra inferior do app)
- Localizar a barra que hoje exibe a frase motivacional ("Quem mede, melhora…") — provavelmente em `src/components/layout/` (StatusBar/Footer).
- Transformar em container `fixed bottom-0` com 3 slots:
  - **Esquerda:** ícone de calendário / contexto existente
  - **Centro:** slot dinâmico (Stepper da Nova Venda OU frase motivacional como fallback)
  - **Direita:** botões Assistente IA + WhatsApp (movidos do flutuante)
- Adicionar `padding-bottom` no layout principal para não cobrir conteúdo.

### 2. Slot do Stepper via Portal
- Criar `src/components/layout/FooterSlotContext.tsx` com um Portal target (`<div id="footer-center-slot" />`) dentro do footer.
- Em `src/pages/vendas/NovaVenda.tsx`: remover o sticky footer atual do stepper e renderizar o `VendaStepper` via `createPortal` no slot central somente enquanto a rota for `/vendas/nova`. Quando desmontar, volta a frase motivacional.

### 3. Botões flutuantes → rodapé
- `src/components/ai/AiFloatingButton.tsx`: remover wrapper `fixed bottom-* right-*` e exportar somente o botão (ícone Sparkles). Renderizá-lo dentro do slot direito do footer global.
- `src/components/atendimento/WhatsAppFloatingChat.tsx`: mesma mudança — botão trigger vai para o footer; o painel/drawer continua abrindo por cima.
- Manter comportamento atual (drawer/dialog inalterados, evento `nova-venda:open-ai` preservado).

### 4. Regras de exibição
- Stepper no footer: somente em `/vendas/nova` (e `/vendedor/nova-venda` se aplicável).
- Botões IA + WhatsApp: em todas as telas autenticadas do ERP (mesma regra que já controla os flutuantes hoje — telas públicas/cliente/entregador permanecem sem).

## Detalhes técnicos
- Usar `react-dom` `createPortal` para o stepper, evitando prop drilling.
- Altura do footer fixa (~48px desktop, ~56px mobile); ajustar `main` com `pb-[var(--footer-h)]`.
- Z-index: footer `z-40`, drawers IA/WhatsApp `z-50` (já são).
- Sem mudanças de lógica de negócio, apenas apresentação/posicionamento.

## Arquivos afetados
- `src/components/layout/` (footer/status bar — identificar arquivo exato ao implementar)
- `src/components/ai/AiFloatingButton.tsx`
- `src/components/atendimento/WhatsAppFloatingChat.tsx`
- `src/pages/vendas/NovaVenda.tsx`
- Novo: `src/components/layout/FooterSlotContext.tsx` (ou util com portal)

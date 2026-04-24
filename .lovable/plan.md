## Objetivo
Tornar o chat WhatsApp acessível em qualquer tela do sistema (estilo WhatsApp Business), com badges de não-lidas na lista de conversas e toasts ao receber mensagens novas — sem quebrar a responsividade do `/atendimento`.

## Arquivos

### 1. ➕ Novo: `src/contexts/WhatsAppNotificationContext.tsx`
- Context global que escuta `ai_mensagens` via Supabase Realtime (canal único, montado uma vez)
- Mantém:
  - `unreadByConversation: Record<string, number>`
  - `totalUnread: number`
  - `markAsRead(conversaId)` — zera contagem e grava timestamp em `localStorage` (`wa_last_read_<id>`)
  - `selectedConversaId` / `setSelectedConversaId` — para evitar contar como "não lida" a conversa aberta
- Ao receber INSERT com `role` diferente de `assistant`/`human` (mensagem do cliente):
  - Se conversa NÃO está aberta no widget: incrementa contagem + dispara `toast` (sonner) com nome + preview
  - Se está aberta: marca como lida automaticamente
- Beep curto opcional via Web Audio API (sem asset)
- Inicializa contagens ao montar comparando `created_at` com `wa_last_read_<id>` do localStorage

### 2. ➕ Novo: `src/components/atendimento/WhatsAppFloatingChat.tsx`
- FAB fixo no canto inferior direito com ícone WhatsApp + badge `totalUnread`
- Desktop (≥md): clique abre `Sheet` lateral direito (~720px, 80vh) renderizando `<WhatsAppInbox />`
- Mobile (<md): `Sheet` full-screen
- Esconder em rotas: `/auth`, `/cliente`, `/entregador`, `/contador`, `/transportadora`, `/centralgascp`, `/fortegas`, `/japagas`
- Conecta ao context para sincronizar `selectedConversaId`

### 3. ✏️ Editar: `src/components/atendimento/WhatsAppInbox.tsx`
- Consumir `useWhatsAppNotifications()`:
  - Badge com `unreadByConversation[id]` ao lado de cada conversa
  - Ordenar: não-lidas primeiro, depois por `updated_at`
  - Ao selecionar conversa: `setSelectedConversaId(id)` + `markAsRead(id)`
  - Ao desmontar: `setSelectedConversaId(null)`
- Lógica de envio e Realtime da conversa aberta permanece igual

### 4. ✏️ Editar: `src/App.tsx` (mudança MÍNIMA)
- Importar `WhatsAppNotificationProvider` e `WhatsAppFloatingChat`
- Adicionar 1 provider dentro de `UnidadeProvider` (igual padrão dos outros)
- Renderizar `<WhatsAppFloatingChat />` ao lado de `<CallerIdPopup />`
- **NÃO** mexer em rotas, helpers ou estrutura

### 5. ✏️ Editar: `src/pages/atendimento/CentralAtendimento.tsx`
- Manter painel embutido `<WhatsAppInbox />` já existente
- Adicionar nota "Disponível também via botão flutuante em qualquer tela"

## Garantias
- ✅ Sem refatorar `App.tsx`/providers/rotas — apenas adicionar 1 provider + 1 widget
- ✅ Sem migrations (estado de "lido" via `localStorage`, pois `ai_mensagens` não tem coluna `lida`)
- ✅ Sem mexer em banco, RLS, edge functions, token Meta
- ✅ Mobile: FAB visível, Sheet full-screen, lista colapsa ao abrir conversa
- ✅ Desktop: FAB canto, Sheet lateral 720px, layout `/atendimento` intacto
- ✅ Toasts via `sonner` (já no projeto)
- ✅ Realtime global único, sem duplicar canais
- ✅ FAB escondido em portais cliente/entregador/contador/transportadora/auth/públicos
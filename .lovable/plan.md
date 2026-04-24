## Objetivo
Permitir responder conversas WhatsApp diretamente dentro da página `/atendimento`, sem abrir WhatsApp Web externo, reaproveitando a lógica já pronta de `CaixaDeEntrada.tsx` (que usa Meta Cloud API + Realtime).

## Mudanças

### 1. ➕ Novo componente reutilizável
**Arquivo:** `src/components/atendimento/WhatsAppInbox.tsx`
- Extrai toda a lógica de chat de `CaixaDeEntrada.tsx` (lista de conversas, mensagens, envio via edge `whatsapp-send`, Realtime)
- Sem `MainLayout` — recebe prop `className` para se adaptar ao container pai
- Altura ajustável via prop (não fixa em `100vh-3.5rem`)

### 2. ✏️ Refatorar página `/chat`
**Arquivo:** `src/pages/atendimento/CaixaDeEntrada.tsx`
- Vira wrapper fino: `<MainLayout><WhatsAppInbox className="h-[calc(100vh-3.5rem)]" /></MainLayout>`
- Rota `/chat` continua funcionando igual

### 3. ✏️ Embutir em `/atendimento`
**Arquivo:** `src/pages/atendimento/CentralAtendimento.tsx`
- Adicionar seção "Chat WhatsApp" com `<WhatsAppInbox />` embutido (altura ~600px com card)
- Trocar botão atual "Abrir WhatsApp" (link `wa.me`) por **"Abrir Chat"** que rola até o painel embutido (`scrollIntoView`)
- Manter um link discreto secundário para `web.whatsapp.com` (opcional)

## Garantias de estabilidade
- Não toca em `App.tsx`, providers, rotas
- Não mexe em edge functions (`whatsapp-send` já funciona)
- Não mexe em banco/RLS/token Meta (já permanente)
- Mensagens em tempo real via canal Supabase já existente
- Mobile: lista colapsa quando conversa selecionada (comportamento atual preservado)

## Arquivos afetados
- ➕ `src/components/atendimento/WhatsAppInbox.tsx`
- ✏️ `src/pages/atendimento/CaixaDeEntrada.tsx`
- ✏️ `src/pages/atendimento/CentralAtendimento.tsx`

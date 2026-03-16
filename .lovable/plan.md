

# Notificação Desktop para Novos Pedidos

## Problema
Quando a aba do sistema não está visível, o atendente não vê o popup do CallerIdPopup e perde pedidos.

## Solução
Usar a **Notification API do navegador** para exibir notificações nativas do sistema operacional quando um novo pedido chega e a aba não está em foco.

## Implementação

### 1. Criar hook `useDesktopNotification`
- Gerencia permissão da Notification API
- Função `notify(title, body, onClick)` que dispara notificação nativa
- Só dispara quando `document.hidden === true` (aba não visível)
- Ao clicar na notificação, foca a aba e executa callback

### 2. Alterar `CallerIdPopup.tsx`
- Importar o novo hook
- Na função `handleNovaChamada`, além do popup e áudio, disparar notificação desktop:
  - Título: "🚚 Novo Pedido - [nome do cliente]"
  - Body: detalhes do pedido (produto, endereço)
  - onClick: foca a janela do sistema

### 3. Banner de permissão na Central de Atendimento
- Se `Notification.permission === "default"`, mostrar um banner discreto pedindo para ativar notificações desktop
- Botão "Ativar notificações" chama `Notification.requestPermission()`

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/hooks/useDesktopNotification.ts` | Criar |
| `src/components/atendimento/CallerIdPopup.tsx` | Adicionar chamada de notificação nativa |
| `src/pages/atendimento/CentralAtendimento.tsx` | Adicionar banner de permissão |


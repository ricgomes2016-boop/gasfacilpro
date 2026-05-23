## Objetivo

Hoje o botão "Nova Venda" no topo da própria tela de Nova Venda abre um modal em tela cheia que bloqueia tudo (e só permite uma instância). Vamos transformar isso num **sistema de janelas flutuantes**, onde você pode:

- Abrir **várias** janelas de Nova Venda ao mesmo tempo, sem perder o que está digitando na tela principal.
- **Minimizar** cada janela para uma barra inferior (fica como uma "aba").
- **Fechar** cada janela com o X (com confirmação se tiver dados não salvos).
- Reabrir a mesma lógica automaticamente quando a **Bina** reconhecer um cliente ou quando chegar um **pedido novo** que precise editar.

## Como vai funcionar (visão do usuário)

```text
┌────────────────────────────────────────────────────────────┐
│ Tela principal: Nova Venda (continua intocada)             │
│                                                            │
│              ┌──────────────────────────┐                  │
│              │ Nova Venda • Cliente A  _ X│ ← janela 1     │
│              │  [conteúdo Nova Venda]    │                 │
│              └──────────────────────────┘                  │
│   ┌──────────────────────────┐                             │
│   │ Nova Venda • (telefone) _ X│ ← janela 2 (veio da Bina) │
│   └──────────────────────────┘                             │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ [▢ Cliente A]  [▢ Pedido #1234]  [▢ João Silva]   ← tray   │
└────────────────────────────────────────────────────────────┘
```

- Cada janela tem header arrastável com título dinâmico (nome do cliente, telefone da Bina ou nº do pedido), botão **minimizar (_)** e botão **fechar (X)**.
- Janelas minimizadas viram chips numa barra fixa no rodapé; clicar restaura.
- A janela ativa fica em foco (z-index maior); clicar em outra traz pra frente.
- A tela principal continua editável enquanto janelas estão abertas (não-bloqueante, sem overlay escuro).

## Mudanças técnicas

### 1. Novo contexto global `NovaVendaWindowsContext`
Arquivo novo: `src/contexts/NovaVendaWindowsContext.tsx`.

- Estado: `windows: Array<{ id: string; clienteId?: string | null; pedidoId?: string | null; title?: string; minimized: boolean; zIndex: number }>`.
- API: `openWindow({ clienteId?, pedidoId?, title? }) → id`, `closeWindow(id)`, `minimizeWindow(id)`, `restoreWindow(id)`, `bringToFront(id)`, `updateWindowTitle(id, title)`.
- IDs únicos (`crypto.randomUUID()`), z-index incremental.
- Provider montado **uma vez** dentro de `MainLayout` (logo abaixo do `SidebarProvider`), pra sobreviver à navegação entre rotas.

### 2. Novo componente `NovaVendaFloatingWindow`
Arquivo novo: `src/components/vendas/NovaVendaFloatingWindow.tsx`.

- Janela `position: fixed`, dimensões padrão ~`min(1100px, 95vw) × min(85vh, 800px)`, posicionada com offset crescente por janela aberta (cascade).
- Header com:
  - Ícone + título dinâmico (atualizado via `updateWindowTitle` quando o cliente é selecionado dentro).
  - Botões: minimizar (`Minus`), fechar (`X`).
  - `onMouseDown` no header inicia drag (sem libs externas — handler simples com `pointermove`/`pointerup`).
- Corpo: `<Suspense>` + lazy `NovaVenda` em modo `embedded`, recebendo `initialClienteId`/`initialPedidoId` e `onClose` (que chama `closeWindow(id)`).
- Quando `minimized === true`, oculta o corpo (`hidden`), mantendo a instância montada (não perde o que foi digitado).
- Confirmação ao fechar se houver alteração não salva (reaproveita flag interna se já existir, senão `window.confirm` simples).

### 3. Renderizador global `NovaVendaWindowsHost`
Arquivo novo: `src/components/vendas/NovaVendaWindowsHost.tsx`.

- Lê `windows` do contexto e renderiza todas as `NovaVendaFloatingWindow`.
- Renderiza a barra de minimizadas (`NovaVendaWindowsTray`) fixa no rodapé (acima do `MobileBottomBar`).
- Montado uma vez em `MainLayout`, fora do `<main>` para não ser afetado por overflow.

### 4. Edição mínima em `NovaVenda.tsx`
- Trocar `setShowNovaVendaModal(true)` (linha 1239) por `openWindow({})` vindo do contexto.
- Remover o estado local `showNovaVendaModal` e o `<NovaVendaModal />` na linha 1386 (substituídos pelo host global).
- Adicionar `initialPedidoId` ao props (`NovaVendaProps`) e usar pra carregar pedido em edição quando vier de "editar pedido".
- Quando o cliente for selecionado/alterado dentro de uma janela, chamar `updateWindowTitle(windowId, cliente.nome)` via prop opcional `onTitleChange` passada pelo `NovaVendaFloatingWindow`.

### 5. Integração com Bina e novo pedido
- `src/components/atendimento/CallerIdPopup.tsx`: ao clicar em "Abrir Nova Venda", chamar `openWindow({ clienteId, title: nomeOuTelefone })` em vez do fluxo atual de navegar/abrir modal.
- `src/hooks/useNovoPedidoNotifier.ts`: ao acionar "editar pedido", chamar `openWindow({ pedidoId, title: '#' + numero })`.
- Esses dois passam a funcionar mesmo se o usuário não estiver na rota `/vendas/nova` — abre a janela flutuante sobre qualquer tela do ERP.

### 6. `NovaVendaModal` antigo
- Mantém o arquivo por compatibilidade, mas deixa de ser usado pelo botão do topo. Pode ser removido num passo posterior se nada mais o referenciar (verificar com `rg`).

## Fora do escopo

- Não mexer em `App.tsx`, providers globais, rotas, nem em `SidebarContext` / `MainLayout` além de montar o novo provider + host.
- Não mudar a lógica de negócio de Nova Venda (formulários, validação, salvar).
- Sem libs novas de janela/drag — implementação enxuta com handlers nativos.

## Critérios de aceite

1. Clicar em "Nova Venda" no topo abre uma janela flutuante; a tela principal continua editável.
2. Posso abrir 2+ janelas simultaneamente, cada uma com seu próprio estado.
3. Minimizar manda pra barra inferior; restaurar volta com o que estava digitado preservado.
4. Fechar (X) pede confirmação se houver dados preenchidos.
5. Bina e novo pedido abrem usando o mesmo sistema de janela.
6. Sidebar e header não são afetados; nada de mudança de layout da tela principal.

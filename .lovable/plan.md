

## Plano: Corrigir Chat do Header — Espaço, Leitura e Modernização

### Problemas identificados

1. **Botão "Chat Entregadores" ocupa espaço demais** — usa `variant="outline" size="sm"` com texto visível, empurrando os botões de perfil e tema para fora da tela
2. **Badge de não lidas não limpa ao visualizar** — o `markAsRead` no `ChatOperador` não filtra por `destinatario_tipo=base`, marcando mensagens erradas; no `BaseChatPanel` a lógica está correta mas o `loadThreads` pode não atualizar o state local do thread selecionado
3. **Visual datado** — sem indicadores de leitura (check/double-check), sem busca de entregador, design básico

### Alterações

**Arquivo: `src/components/chat/BaseChatPanel.tsx`**

1. **Trigger compacto** — trocar de `Button variant="outline" size="sm"` com texto para `Button variant="ghost" size="icon" className="h-9 w-9"` (apenas ícone), igual aos outros botões do header. Badge de unread fica como bolinha sobreposta.

2. **Busca de entregador** — adicionar um campo de busca no topo da lista de threads para filtrar por nome, permitindo escolher rapidamente o entregador desejado.

3. **Corrigir leitura (badge persistente)** — após `markAsRead` + `loadThreads`, também atualizar o `selectedThread` local para `unread: 0`, garantindo que a badge suma imediatamente sem esperar re-fetch.

4. **Visual moderno** — adicionar ícones de check/double-check nas mensagens enviadas (já existe no código mas confirmar funcionamento), avatar com iniciais coloridas na lista, timestamp mais elegante.

5. **Header do Sheet** — redesenhar com gradiente primário, ícone moderno (MessagesSquare), e visual consistente com o resto do app.

**Arquivo: `src/components/chat/ChatOperador.tsx`**

6. **Corrigir markAsRead** — adicionar filtro `destinatario_tipo.eq.base` na query de update para não marcar mensagens de outros contextos como lidas.

7. **Atualizar estado local** — após marcar como lido, atualizar o entregador selecionado e a lista local imediatamente.

### Resultado esperado
- Botões de perfil e tema sempre visíveis no header
- Badge de não lidas desaparece ao abrir conversa
- Busca rápida de entregador no painel
- Visual moderno e consistente


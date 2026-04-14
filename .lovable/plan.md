

## Plano: Redesign do Chat do Entregador estilo WhatsApp

### Resumo
Redesenhar o componente `ChatBase.tsx` para ter visual e UX idênticos ao WhatsApp, com última mensagem na lista de contatos, busca de conversas e indicadores de leitura aprimorados.

### Alterações

**Arquivo: `src/components/entregador/ChatBase.tsx` (reescrita significativa)**

**1. Lista de conversas estilo WhatsApp**
- Cada contato mostra: avatar com iniciais coloridas, nome, preview da última mensagem (truncada), horário da última mensagem, badge de não lidas
- Ordenar contatos por última mensagem (mais recente primeiro)
- Query adicional para buscar a última mensagem de cada peer ao carregar a lista
- Campo de busca no topo para filtrar contatos por nome

**2. Tela de conversa estilo WhatsApp**
- Header com avatar, nome do contato e botão voltar
- Fundo com padrão sutil (WhatsApp-style background)
- Bolhas: verde/teal para minhas mensagens (lado direito), branco/cinza para recebidas (lado esquerdo)
- Caudas nas bolhas (rounded corners diferenciados: `rounded-br-sm` / `rounded-bl-sm`)
- Horário dentro da bolha, alinhado à direita
- Ticks: ✓ cinza (enviado), ✓✓ cinza (entregue), ✓✓ azul (lido)
- Separadores de data entre mensagens de dias diferentes ("Hoje", "Ontem", data)

**3. Busca de contatos**
- Input de busca no topo da lista de conversas
- Filtro local por nome do peer
- Ícone de lupa, limpar com X

**4. Última mensagem na lista**
- Ao carregar peers, buscar a última `chat_mensagem` de cada conversa
- Exibir texto truncado (max 40 chars) e horário formatado ("10:45", "Ontem", "12/04")
- Ordenar lista por horário da última mensagem

### Detalhes técnicos

- Nova query ao carregar peers: para cada peer, buscar a última mensagem via `supabase.from("chat_mensagens").select(...).order("created_at", {ascending: false}).limit(1)`
- Batch com Promise.all para performance
- Interface `PeerWithLastMsg` extends `Peer` com `lastMessage`, `lastMessageTime`
- Separadores de data: agrupar mensagens por dia, inserir divider com label
- Realtime: ao receber nova mensagem, atualizar também o preview na lista
- Manter toda a lógica existente de IA (aba Assistente) sem alterações
- CSS: cores WhatsApp adaptadas ao tema do app (usar variáveis CSS existentes)

### Arquivos modificados
- `src/components/entregador/ChatBase.tsx` — redesign completo da UI de conversas


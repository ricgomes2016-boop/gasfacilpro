## Painel "Dados do contato" no Chat WhatsApp

Adicionar um painel lateral direito (drawer) que abre ao clicar no nome/avatar do cliente no header do chat, replicando a experiência do WhatsApp Web.

### Onde

Arquivo: `src/components/atendimento/WhatsAppInbox.tsx`

### Comportamento

- Clicar no avatar **ou** no nome no header do chat abre o painel lateral à direita (largura ~380px desktop, full-screen no mobile).
- Botão X no topo do painel para fechar.
- Painel desliza sobre a coluna de mensagens (não empurra layout em telas pequenas).

### Conteúdo do painel

1. **Cabeçalho visual**: avatar grande (foto de `ai_conversas.foto_url` com fallback de iniciais), nome (`titulo`), telefone formatado (`+55 43 ...`).
2. **Ações rápidas** (3 botões em linha, estilo WhatsApp):
   - "Buscar" (placeholder por ora — abre search interno da conversa).
   - "Silenciar" (toggle local, salvo em `localStorage` por conversa).
   - "Editar" (abre `ClienteFormDialog` se já vinculado; senão abre diálogo de vincular cadastro — reaproveita `openEditCliente` / `handleOpenLinkDialog`).
3. **Bloco "Cadastro"**:
   - Se vinculado: nome, endereço principal e link "Ver no cadastro de clientes" (`/clientes?focus={id}`).
   - Se não vinculado: botão "Vincular ao cadastro".
4. **Bloco "Pedidos recentes"**: últimos 5 pedidos do cliente vinculado (consulta `pedidos` por `cliente_id` da unidade atual; mostra data, valor, status). Linha clicável vai para `/pedidos?id={id}`.
5. **Bloco "Mídia, links e docs"**: contagem de mensagens com `media_url` na conversa + miniaturas das 4 últimas imagens (consulta `ai_mensagens` filtrando `media_url` não nulo).
6. **Bloco "Ações"**:
   - "Atualizar foto do perfil" (chama `whatsapp-refresh-profile` manualmente).
   - "Apagar conversa" (vermelho, reusa `setConfirmDeleteId`).

### Estado e dados

- Novo state `contactPanelOpen: boolean`.
- Hook local `useContactPanelData(conversaId, clienteId)` que carrega pedidos recentes + mídias quando o painel abre (lazy, com `useEffect`).
- Reaproveita `clienteByConv`, `selectedConversa`, `profileSyncStatus` já existentes.

### UI / estilo

- Cores WhatsApp Web já usadas no arquivo (`#f0f2f5`, `#667781`, `#111b21`, `#00a884`).
- Sem novas dependências; usa `Dialog`/`Sheet` do shadcn — preferir `Sheet` (side="right") por ser drawer lateral nativo.
- Animação slide-in já vem do `Sheet`.

### Não inclui (fora de escopo)

- Funções "Voz" e "Vídeo" do WhatsApp Web (não temos VoIP no contexto deste chat).
- Mensagens favoritas / mensagens temporárias / privacidade avançada.
- Edição de notas livres ("Recado") — pode ser proposto depois se necessário.

### Arquivos tocados

- `src/components/atendimento/WhatsAppInbox.tsx` (header clicável + render do `Sheet` + carregamento dos blocos).
- Possível extração para `src/components/atendimento/ContactDetailsPanel.tsx` se ultrapassar ~150 linhas, para manter `WhatsAppInbox` legível.

Sem migrações de banco e sem mudanças de RLS.
## O que vamos resolver

Na inbox WhatsApp (`WhatsAppInbox.tsx`):
1. Carregar foto de perfil do cliente (igual WhatsApp normal).
2. Tirar o prefixo "WhatsApp:" do nome/número.
3. Adicionar ações por conversa: **apagar conversa**, **editar cliente** e **vincular ao cadastro**.

## Diagnóstico

- Hoje todas as conversas são salvas como `titulo = "WhatsApp: <nome|telefone>"` em 3 lugares: `evolution-webhook/index.ts:123`, `meta-webhook/index.ts:208` e `NovaConversaDialog.tsx:111`.
- A coluna `ai_conversas.foto_url` já existe e há a função `whatsapp-refresh-profile` que busca a foto via Evolution/Meta — mas só é chamada **quando a conversa é aberta**. Por isso `has_foto = false` em todas as linhas.
- Não existe policy `DELETE` em `ai_conversas` — precisa criar para permitir apagar.
- `ai_mensagens` já tem `ON DELETE CASCADE` apontando para `ai_conversas`, então apagar a conversa apaga as mensagens automaticamente.

## Mudanças

### 1. Remover prefixo "WhatsApp:"

- `supabase/functions/evolution-webhook/index.ts` (linha 123) e `supabase/functions/meta-webhook/index.ts` (linha 208): trocar `\`WhatsApp: ${...}\`` por apenas `${cliente.nome || senderName || normalized}`.
- `src/components/atendimento/NovaConversaDialog.tsx` (linha 111): salvar `titulo: titulo || phone` (sem prefixo).
- Migration de backfill: `UPDATE ai_conversas SET titulo = regexp_replace(titulo, '^WhatsApp:\s*', '') WHERE titulo LIKE 'WhatsApp:%'`.
- Redeploy: `evolution-webhook`, `meta-webhook`, `gateway-webhook`, `uazapi-webhook`, `zapi-webhook` (todos importam `bia-core`).

### 2. Carregar foto do cliente automaticamente

Estratégia: buscar a foto **uma vez por conversa**, em background, sem travar a renderização — e guardar em `foto_url` para reuso.

- No `WhatsAppInbox.tsx`, após carregar a lista de conversas, disparar `whatsapp-refresh-profile` (em fila, com pequeno delay entre chamadas — ex: 300ms) **somente** para conversas onde `foto_url IS NULL` e `unidade_id IS NOT NULL`. Atualizar o estado local conforme cada resposta retorna.
- Limitar a, por exemplo, 30 fotos por carga inicial para não estourar rate limit do provedor; o resto preenche conforme o usuário seleciona a conversa (já existe esse caminho).
- A função `whatsapp-refresh-profile` já persiste em `ai_conversas.foto_url`, então nas próximas aberturas a foto vem direto do banco e é mostrada pelo `ChatAvatar`.

### 3. Apagar conversa, editar cliente, vincular ao cadastro

- **Migration**: criar policy `DELETE` em `ai_conversas` para `admin`/`gestor`/`operacional` da mesma `empresa_id` (mesmo padrão das policies já existentes).
- **UI** em `WhatsAppInbox.tsx`:
  - Em cada linha da lista, botão "⋮" (DropdownMenu do shadcn) com:
    - **Apagar conversa** → confirmação (AlertDialog) → `supabase.from("ai_conversas").delete().eq("id", c.id)` → remove do estado local + toast.
  - No header do chat aberto (à direita), mesmo "⋮" com:
    - **Vincular ao cadastro** (aparece quando o telefone não bate com nenhum cliente): abre dialog de busca em `clientes` por nome/telefone com opção "criar novo cliente" (já temos `NovoClienteDialog` reutilizável). Ao selecionar/criar, gravar o `telefone` no cliente para que futuras mensagens identifiquem.
    - **Editar cliente** (aparece quando há cliente vinculado): abre o modal padrão de edição de cliente (`ClienteFormDialog` já usado em `/clientes`).
    - **Apagar conversa** (mesma ação acima).
- Detecção do vínculo: `select id from clientes where telefone = <normalizado> and unidade_id = <conv.unidade_id>` ao abrir a conversa.

## Fora de escopo

- Não vou mexer em rotas, `App.tsx`, providers, nem em outras páginas.
- Não vou alterar a lógica do bot (`bia-core.ts`) além da string do `titulo` nos webhooks.
- Não vou criar um novo cadastro de cliente automaticamente sem o usuário clicar — só via "vincular ao cadastro".

## Detalhes técnicos

- Componente afetado: `src/components/atendimento/WhatsAppInbox.tsx` (apenas adições — header, dropdown, dialogs, fila de fotos).
- Edge functions: `evolution-webhook/index.ts`, `meta-webhook/index.ts` (1 linha cada).
- Component: `src/components/atendimento/NovaConversaDialog.tsx` (1 linha).
- Migration: 1 update para limpar títulos antigos + 1 policy `DELETE`.
- Reutilizar `ClienteFormDialog`/`NovoClienteDialog` existentes — não criar novos formulários.

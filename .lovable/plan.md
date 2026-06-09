## Problemas identificados

1. **"Não autorizado" no chat IA** — Em `AiAssistantChat.tsx` (linha 247) o fetch envia `VITE_SUPABASE_PUBLISHABLE_KEY` como Bearer em vez do JWT do usuário logado. A edge function `ai-assistant` chama `auth.getUser()` com esse token e falha com 401.
2. **IA não agenda pedidos** — A tool `criar_pedido` não aceita `data_entrega` / `hora_entrega`, e o insert não usa as colunas `agendado`, `data_agendamento`, `data_entrega` existentes em `pedidos`.
3. **Busca de cliente fraca** — `criar_pedido` faz só um `ilike` no nome (não usa telefone, não traz endereço cadastrado para `endereco_entrega`).
4. **Botão flutuante desktop ausente** — `AiFloatingButton.tsx` tem o botão flutuante comentado ("hidden, now in bottom bar"); no desktop não há mais entrada visível para abrir o chat fora da página /assistente-ia.
5. **Botão IA da bottom bar inerte na página /assistente-ia** — `MainLayout` faz `onOpenAi={() => { if (!isAiPage) setAiOpen(true); }}` → na própria página não acontece nada quando o usuário toca em "IA".

## Mudanças

### 1. `src/components/ai/AiAssistantChat.tsx` — autenticação correta
- Obter `session` via `supabase.auth.getSession()` antes do fetch.
- Enviar `Authorization: Bearer ${session.access_token}` (fallback para publishable key apenas se não houver sessão, mostrando erro amigável).
- Mostrar erro claro se usuário não estiver logado.

### 2. `supabase/functions/ai-assistant/index.ts` — agendamento + cliente
- Atualizar a tool `criar_pedido`:
  - Adicionar parâmetros `data_entrega` (YYYY-MM-DD), `hora_entrega` (HH:MM) e `cliente_id` (opcional).
  - Atualizar `description` para deixar claro que aceita agendamento futuro.
- No handler `case "criar_pedido"`:
  - Busca de cliente em duas etapas: por telefone (digits-only) e por `ilike` em nome, retornando `id`, `endereco`, `numero`, `bairro`, `telefone`.
  - Se `endereco_entrega` não vier, montar a partir do cadastro do cliente.
  - Se `data_entrega` fornecida: setar `agendado=true`, `data_agendamento` = `data_entrega + hora_entrega` (timestamp), e `data_entrega`. Sem data → comportamento atual.
  - Mensagem de retorno inclui data/hora agendada e cliente resolvido.
- Atualizar o `systemPrompt` para instruir: ao receber pedido com data, sempre usar `criar_pedido` com `data_entrega`/`hora_entrega`; nunca inventar cliente, sempre tentar localizar pelo nome/telefone informado.

### 3. `src/components/ai/AiFloatingButton.tsx` — botão flutuante desktop
- Reativar o botão flutuante (versão desktop apenas: classes `hidden md:flex`), canto inferior direito, abrindo o chat quando clicado. Mobile continua usando a bottom bar.

### 4. `src/components/layout/MainLayout.tsx` — botão IA mobile na própria página
- Quando `isAiPage` for true e o usuário tocar em "IA" na bottom bar, fazer scroll para o topo do chat (focar input) em vez de no-op. Manter o comportamento de abrir o drawer fora dessa página.

## Detalhes técnicos

- Deploy automático da função `ai-assistant` após edição.
- Colunas confirmadas em `pedidos`: `data_agendamento` (timestamp), `agendado` (bool), `data_entrega`.
- Sem mudanças de schema, sem migrations, sem novos componentes.
- Não alterar `App.tsx`, providers ou rotas.

## Validação

1. Logar como admin, ir em /assistente-ia, digitar "agende 1 P20 para Supermercado Borelli amanhã às 8h" → deve criar pedido com `agendado=true` e data correta, e mostrar resumo com cliente encontrado.
2. No desktop, fora da página /assistente-ia, confirmar botão flutuante visível e funcional.
3. No mobile, dentro de /assistente-ia, tocar em "IA" deve focar o input do chat.
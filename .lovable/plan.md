# Corrigir horário das conversas no Atendimento WhatsApp

## Problema

Na lista de conversas (`src/components/atendimento/WhatsAppInbox.tsx`), o horário exibido ao lado de cada conversa vem de `ai_conversas.updated_at`. Esse campo é atualizado por vários eventos que não são "nova mensagem do cliente":

- Resposta automática da BIA
- Atualização de foto/perfil em background (`whatsapp-refresh-profile`)
- Mudanças de status, título, vínculo de cliente
- Triggers internos do banco

Resultado: o operador não consegue distinguir qual conversa tem a mensagem mais recente do cliente, e parece que "só de clicar a hora muda" (clicar não escreve no banco, mas eventos paralelos atualizam a linha logo depois).

## Solução

Passar a usar o `created_at` da **última mensagem real** da conversa, tanto para exibição quanto para ordenação. Esse dado já é buscado no `fetchConversas` — só não está sendo guardado nem usado.

## Mudanças (apenas em `src/components/atendimento/WhatsAppInbox.tsx`)

1. **Tipo `Conversa`**: adicionar campo opcional `last_message_at?: string | null`.

2. **`fetchConversas` (~linha 192-208)**: ao montar o `lastByConv`, guardar também `created_at`. Atribuir `c.last_message_at = last?.created_at ?? null`.

3. **Ordenação**: ordenar a lista final no cliente por `last_message_at` desc (com fallback para `updated_at`), já que a query atual ordena só por `updated_at`. Manter o `.order("updated_at", ...)` do Supabase como pré-ordenação (a re-ordenação final acontece no `useMemo` que já existe na linha 622).

4. **Exibição (linha 855)**: trocar `format(new Date(c.updated_at), "HH:mm")` por `format(new Date(c.last_message_at ?? c.updated_at), "HH:mm")`.

## Fora de escopo

- Não mexer em triggers, RLS, edge functions ou webhook.
- Não alterar `WhatsAppNotificationContext`, envio de mensagem, vínculo de cliente, painel de contato.
- Não mudar a query principal (continua trazendo 200 conversas ordenadas por `updated_at` — suficiente como filtro inicial).

## Resultado esperado

O horário ao lado de cada conversa passa a refletir a **última mensagem trocada** (cliente ou BIA), e a ordem da lista também. Eventos colaterais (foto, status) deixam de "mexer" no horário visível.

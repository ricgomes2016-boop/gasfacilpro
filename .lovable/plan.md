## Objetivo

Garantir que a foto do contato seja exibida no `WhatsAppInbox` usando `ai_conversas.foto_url` e, quando vazia, chamar `whatsapp-refresh-profile` em background e atualizar o avatar assim que a foto retornar — tanto na lista de conversas quanto no header do chat aberto.

## Estado atual

O arquivo `src/components/atendimento/WhatsAppInbox.tsx` já tem boa parte da lógica:

- Tipo `Conversa` inclui `foto_url`.
- `fetchConversas` já seleciona `foto_url` de `ai_conversas`.
- Existe um `useEffect` (linhas 218–240) que percorre conversas sem `foto_url` e chama `whatsapp-refresh-profile` em fila throttled (350ms), atualizando o estado quando retorna `contato_foto_url`.
- Ao abrir uma conversa (linha 255–261), já dispara `whatsapp-refresh-profile` em background.
- `ChatAvatar` faz fallback para iniciais quando a URL falha.

## Gaps a corrigir

1. **Header do chat aberto não atualiza com a foto retornada**: o invoke nas linhas 255–261 não usa a resposta. Precisa atualizar `conversas` quando vier `contato_foto_url`.
2. **Realtime de `ai_conversas` UPDATE**: hoje qualquer evento em `ai_conversas` chama `fetchConversas()` inteiro. OK, mas em paralelo o webhook que grava `foto_url` deveria refletir no estado. Manter o refetch é suficiente — verificar que o subscribe cobre `UPDATE` (já cobre com `event: "*"`).
3. **Conversas sem `unidade_id`**: o filtro `c.unidade_id` exclui essas do refresh. Como o inbox já filtra por `unidadeAtual.id`, podemos usar `unidadeAtual.id` como fallback para o invoke.
4. **Limite de 30 conversas**: aumentar a fila para cobrir mais resultados visíveis (ex.: 60) e priorizar as do topo da lista (que já estão ordenadas por `updated_at desc`).
5. **Evitar refetch infinito**: o efeito de background depende de `conversas.map(c=>c.id).join(",")`. Quando uma foto é atualizada via setState, o set de IDs não muda → seguro. Manter.

## Mudanças

### `src/components/atendimento/WhatsAppInbox.tsx`

- Atualizar o invoke do header (efeito do `selectedId`) para consumir `contato_foto_url` e fazer `setConversas` preservando o restante:
  ```ts
  supabase.functions.invoke("whatsapp-refresh-profile", {
    body: { unidade_id: conv.unidade_id || unidadeAtual?.id, conversa_id: selectedId },
  }).then(({ data: r }: any) => {
    if (r?.contato_foto_url) {
      setConversas((prev) => prev.map((x) =>
        x.id === selectedId ? { ...x, foto_url: r.contato_foto_url } : x
      ));
    }
  }).catch(() => {});
  ```
- No efeito de background fetch (linhas 218–240):
  - `const pending = conversas.filter((c) => !c.foto_url).slice(0, 60);`
  - usar `unidade_id: c.unidade_id || unidadeAtual?.id` no body.
- Garantir que `ChatAvatar` no header do chat aberto receba `conv.foto_url` atualizado (já recebe via `conversas.find`, mas confirmar que o JSX do header consome do estado mais recente).

### Sem mudanças em

- `supabase/functions/whatsapp-refresh-profile/index.ts` — já grava `foto_url` em `ai_conversas` e retorna `contato_foto_url`.
- Webhook / `bia-core.ts` — não tocar.
- `App.tsx`, rotas, providers — não tocar.

## Validação

1. Abrir Chat com unidade Central Gás Matriz selecionada.
2. Conversas com `foto_url` preenchida devem exibir foto imediatamente.
3. Conversas sem foto devem renderizar iniciais e, em poucos segundos, trocar para a foto real conforme o background concluir.
4. Ao abrir uma conversa específica, header passa de iniciais → foto sem precisar recarregar a página.
5. Conferir no console que não há loop de invokes (cada conversa é chamada no máximo 1x por sessão até ganhar `foto_url`).

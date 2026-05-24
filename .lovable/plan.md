## Problema
A busca atual em `searchLink` (WhatsAppInbox.tsx) usa múltiplos `.or()` encadeados com `ilike` em vários campos. Isso falha em casos comuns:

- "rua cambara, 260" — vira 3 tokens (`rua`, `cambara`, `260`) e cada um precisa casar em algum campo. Endereços salvos como "Cambará" (sem prefixo "Rua") quebram o filtro.
- Não trata acentos (`cambara` vs `Cambará`).
- Não trata telefone normalizado (só dígitos).
- Lógica de "logradouro + número" não existe — número entra como token isolado.

Já existe a função RPC `autocomplete_clientes_v2(_empresa_id, _unidade_id, _termo, _limite)` que resolve exatamente isso: usa `unaccent`, separa parte textual de número (ex: "Rua Brasil 340"), normaliza telefone, faz score e retorna `id, nome, telefone, endereco, numero, bairro, cep, cidade`. O `NovaConversaDialog` já usa essa RPC.

## Mudanças

Arquivo: `src/components/atendimento/WhatsAppInbox.tsx`

1. **`searchLink`** (linhas ~504-565): substituir toda a lógica de `.or()` por uma chamada à RPC:
   ```ts
   supabase.rpc("autocomplete_clientes_v2", {
     _empresa_id: empresa.id,
     _unidade_id: unidadeAtual?.id ?? null, // se disponível no escopo
     _termo: t,
     _limite: 30,
   })
   ```
   - Quando `t` estiver vazio, manter o comportamento atual (listar primeiros 200 por nome via `.from("clientes")`).
   - Aplicar debounce de ~250ms (igual ao NovaConversaDialog) para evitar spam de queries enquanto o usuário digita.

2. **`handleOpenLinkDialog`** (linhas ~488-502): manter como está (load inicial dos 200 primeiros). Apenas garantir que o tipo de `linkResults` aceite os campos retornados pela RPC.

3. **Tipo de `linkResults`** (linha ~119): expandir para incluir `endereco, numero, bairro, cidade, cep` (já é renderizado na UI).

4. **UI do modal** (linhas ~1400-1430): nenhuma mudança visual — apenas continuar exibindo `Rua, Nº · Bairro · Cidade` como já implementado.

## Fora de escopo
- Não mexer em `ContactDetailsPanel`, lógica de WhatsApp, envio de mensagens, ou qualquer outra parte do inbox.
- Não criar/alterar funções no banco — a RPC já existe.
- Não alterar o `NovaConversaDialog`.

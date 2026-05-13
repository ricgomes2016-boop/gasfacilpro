## Diagnóstico

Investiguei o backend e encontrei sinais claros de que **o envio nem chegou ao servidor**:

- A tabela `whatsapp_test_envios` está **vazia** (nenhum envio registrado).
- A edge function `meta-test-send` **não tem nenhum log** — nunca foi executada com sucesso.
- A `meta-webhook` e a `whatsapp-send` (usada no `/chat`) também sem logs recentes.
- Credenciais Meta da unidade Central Gás estão corretas no banco (`meta_phone_number_id = 1085213844678248`, `meta_waba_id = 2166317874121379`, `status_conexao = conectado`).

Ou seja: o problema **não é** com a Meta API ou com o número — é com a chamada da função do navegador → Supabase.

### Causa provável

Em `supabase/functions/meta-test-send/index.ts` a autenticação usa:

```ts
const { data: claimsData } = await userClient.auth.getClaims(
  authHeader.replace("Bearer ", "")
);
```

`auth.getClaims(token)` com argumento string não é a assinatura suportada pelo `@supabase/supabase-js@2.45` — ela retorna erro/`null` e a função responde **401 Unauthorized** sem deixar log de execução (e sem inserir linha em `whatsapp_test_envios`). Por isso a UI parece "enviar" mas nada chega ao WhatsApp e nada aparece na lista de envios.

A função `whatsapp-send` (usada no Inbox `/chat`) também pode estar afetada porque resolve config com `unidade_id: null` — vou validar.

## Plano de correção

### 1. Corrigir autenticação em `meta-test-send`
Trocar para o padrão validado do projeto:

```ts
const { data: { user }, error } = await userClient.auth.getUser();
if (error || !user) return json({ ok: false, error: "Unauthorized" }, 401);
const userId = user.id;
```

E garantir que **toda** falha (auth, validação, Meta API) grave uma linha `failed` em `whatsapp_test_envios` com `error` legível, para a UI mostrar o motivo em vez de ficar silenciosa.

### 2. Logar e devolver erro detalhado da Meta
Sempre que a Meta API responder erro, salvar `metaJson.error` completo (code, type, message, error_subcode) no campo `error` e em `status_history` — facilita identificar problemas como "número não está na lista de testes", "template required (24h window)", etc.

### 3. Validar a regra das 24h da Meta Cloud API
A Meta Cloud API só permite enviar **mensagens de texto livre** se o destinatário tiver enviado uma mensagem nas últimas 24h. Caso contrário, exige template aprovado. Vou:
- Adicionar suporte opcional a envio via **template `hello_world`** (template padrão sempre aprovado) na tela de Teste de Envio.
- Mostrar aviso na UI: "Para números que nunca falaram com você, use o template hello_world".

### 4. Garantir que o número de teste está autorizado
Em contas Meta novas (não verificadas), só é possível enviar para até 5 números cadastrados na lista "Recipient phone number" do WhatsApp Manager. Vou adicionar um link/aviso na tela explicando isso.

### 5. Validar `whatsapp-send` do Inbox `/chat`
- Confirmar que `resolveConfig` consegue achar a integração `meta` quando `unidade_id` chega `null` (hoje passa `null` direto).
- Se não achar, fazer fallback resolvendo pela `empresa_id` do usuário autenticado.

### 6. Redeploy e teste end-to-end
- Deploy de `meta-test-send` e (se alterada) `whatsapp-send`.
- Disparar via `curl_edge_functions` autenticado para o número `5543999661816` com template `hello_world` e confirmar:
  - linha em `whatsapp_test_envios` com `wamid` retornado;
  - log da função sem erro;
  - webhook `meta-webhook` recebendo `sent → delivered` e atualizando a linha.

### 7. Reportar resultado
Mostrar para você: `wamid` gerado, status final (sent/delivered/failed), e erro detalhado da Meta caso ainda falhe — assim você sabe exatamente o que ajustar (autorizar número, abrir janela 24h, ou trocar template).

## Detalhes técnicos (referência)

Arquivos tocados:
- `supabase/functions/meta-test-send/index.ts` — auth fix, registro de erro, suporte a template.
- `supabase/functions/whatsapp-send/index.ts` — fallback de resolução de config por empresa.
- `src/pages/WhatsAppTesteEnvio.tsx` — toggle "texto livre / template hello_world", aviso sobre 24h e lista de números autorizados.

Sem mudanças no `App.tsx`, providers ou rotas.

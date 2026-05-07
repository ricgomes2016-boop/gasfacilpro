## Objetivo

Concluir a integração do segundo número Twilio (**+55 43 2398-0020**) ao webhook da Bia, garantindo que chamadas para esse DID sejam atendidas em nome da **Forte Gás** (mesma empresa do +554337717463).

## Situação atual

- Webhook `twilio-voice-webhook` já implantado e funcional.
- Tabela `did_empresa_routing` possui apenas o DID `+554337717463` mapeado para Forte Gás.
- Usuário já configurou no console Twilio o **Voice URL** do número `+554323980020` apontando para o webhook.
- O webhook resolve a empresa via RPC `resolver_empresa_por_did(_did)`. Sem mapeamento, ele cai no fallback (Forte Gás), mas o ideal é cadastrar explicitamente para auditoria, logs e futuro multi-empresa.

## O que vou fazer

### 1. Cadastrar o novo DID em `did_empresa_routing`
Inserir registro:
- `did = '+554323980020'`
- `empresa_id = c94c210b-8dbd-4d91-914e-2db146b8cf94` (Forte Gás)
- `unidade_id = NULL` (resolverá unidade matriz por padrão, igual ao DID atual)
- `ativo = true`

### 2. Validar o webhook com payload simulado
Chamar `twilio-voice-webhook` via `curl_edge_functions` simulando uma requisição POST form-urlencoded da Twilio:
```
From=+5543999990000&To=+554323980020&CallSid=TEST_DID_2398
```
Esperado:
- HTTP 200
- TwiML retornado pelo ElevenLabs (`<Response>...<Connect><Stream>...`)
- `empresa_nome="Forte Gas"` nos logs do edge function
- Registro inserido em `chamadas_recebidas` com `empresa_id` = Forte Gás

### 3. Verificar logs
Ler `supabase--edge_function_logs` para `twilio-voice-webhook` e confirmar que o DID foi resolvido corretamente.

## O que NÃO vou alterar

- Não vou tocar em `App.tsx`, rotas ou no código do webhook (`supabase/functions/twilio-voice-webhook/index.ts`) — ele já trata múltiplos DIDs via RPC.
- Não vou criar UI nova de configuração agora (pode virar tarefa futura se você precisar gerenciar vários DIDs pelo painel).

## Teste final manual (depois do deploy)

Você liga para **+55 43 2398-0020** e:
1. A Bia atende dizendo o nome "Forte Gás".
2. A chamada aparece em `chamadas_recebidas` (Bina/popup).
3. Twilio Console → Monitor → Logs → Calls registra a ligação como `completed`.

Se quiser, depois posso adicionar uma página em `/admin` para CRUD de DIDs (mapear novos números sem precisar de migration).
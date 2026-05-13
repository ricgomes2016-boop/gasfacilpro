## Diagnóstico

Verifiquei os logs e o banco:

- **Bia respondeu sim** à Janaina (16:10:13 UTC: *"Oie! Tudo ótimo por aqui..."*) e a Meta confirmou `sent → delivered → read` às 16:11. Ou seja, a entrega no WhatsApp da Janaina **funcionou**.
- O problema real é que a Bia **não se apresenta como "Central Gás"** — o `buildSystemPrompt` em `supabase/functions/_shared/bia-core.ts` usa apenas *"assistente virtual da empresa de gás"*, sem injetar o nome da empresa (`empresas.nome`). A integração Meta do número `554335241094` ESTÁ corretamente vinculada à unidade **Central Gas** (`empresa_id` confirmado), só falta usar esse nome no prompt.
- O `WhatsAppInbox.tsx` hoje só lista conversas existentes — não tem o botão "nova conversa" do WhatsApp Web.

## O que vou fazer

### 1. Bia responde como "Central Gás"
- Em `checkBusinessHours` (bia-core.ts) já buscamos `empresas.nome` via join — vou expor `empresaNome` no retorno.
- Atualizar a assinatura de `buildSystemPrompt` para receber `empresaNome` e usar em todas as variantes do prompt: *"Você é a Bia, atendente da **Central Gás**..."*, incluindo a primeira saudação.
- Atualizar as 3 chamadas (`meta-webhook`, `gateway-webhook`, e qualquer outra que use `buildSystemPrompt`) para passar o novo parâmetro.

### 2. Botão "Nova conversa" no WhatsAppInbox
- Adicionar ícone de lápis no header da sidebar (igual WhatsApp Web).
- Abre um `Dialog` com:
  - Campo de busca que faz autocomplete em `clientes` (RPC `autocomplete_clientes_v2` já existe).
  - Opção "Novo número" → input de telefone livre.
- Ao selecionar: cria/atualiza a `ai_conversas` com o telefone e seleciona a conversa. O envio segue pelo `whatsapp-send` existente.
- Importante: WhatsApp Cloud API só permite enviar mensagem livre se o cliente conversou nas últimas 24h — fora disso precisa template. Vou exibir um aviso no modal quando o número for novo.

### 3. Teste end-to-end
Após implementar, vou disparar via `whatsapp-send` para o número `554399692765` (Janaina) com texto tipo *"Olá Janaina, aqui é a Bia da Central Gás 👋 teste"* e checar o status no webhook (`sent/delivered`).

## Arquivos afetados

- `supabase/functions/_shared/bia-core.ts` (expor `empresaNome`, ajustar `buildSystemPrompt`)
- `supabase/functions/meta-webhook/index.ts` e `gateway-webhook/index.ts` (passar o nome)
- `src/components/atendimento/WhatsAppInbox.tsx` (botão + dialog "nova conversa")
- 1 componente novo `NovaConversaDialog.tsx` para manter o inbox enxuto

Sem mudanças de banco e sem mexer em RLS, App.tsx ou rotas.

Posso prosseguir?
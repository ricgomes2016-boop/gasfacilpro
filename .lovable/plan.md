

## Plano: Fazer deploy da meta-webhook neste projeto

### Problema
A Edge Function `meta-webhook` existe no código mas **não está deployada** no backend Lovable Cloud (`scqenurznkatvrqxqjmt`). Chamadas à URL retornam 404.

### Correção

**Passo 1 — Deploy da `meta-webhook`**
Fazer deploy da função usando a ferramenta de deploy de Edge Functions do projeto. Isso inclui a função principal e suas dependências em `_shared/bia-core.ts`.

**Passo 2 — Deploy da `whatsapp-send`**
Garantir que a função de envio manual também esteja deployada para o Inbox funcionar.

**Passo 3 — Verificar funcionamento**
Testar o webhook com uma chamada GET de verificação (`hub.mode=subscribe`) e confirmar resposta 200.

**Passo 4 — Atualizar webhook na Meta (se necessário)**
Se o webhook da Meta ainda aponta para `gcrdftnnbgsogoqcmcxo`, o usuário precisará atualizar a URL no painel Meta para:
```
https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/meta-webhook
```

### Observação importante
Os secrets necessários (`META_WHATSAPP_TOKEN`, `LOVABLE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) já estão configurados neste projeto.


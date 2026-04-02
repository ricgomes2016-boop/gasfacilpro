

## Diagnostico: BIA + Meta WhatsApp API (Central Gas)

### O que foi encontrado

**1. Conflito de merge no codigo (CRITICO)**

O arquivo `supabase/functions/meta-webhook/index.ts` contem um conflito de merge git nao resolvido nas linhas 155-169:

```text
<<<<<<< HEAD
  await saveMessage(...)
=======
  await saveMessage(...)
  // Hard block: off-hours
  if (bh.isOffHours) { ... }
>>>>>>> d40740467e...
```

Isso causa erro de sintaxe no deploy. A versao correta e a do branch `d40740...` que inclui o bloco de horario comercial e o campo `tipo_contato`.

**2. Meta API retornando erro 133010: "Account not registered"**

O teste de envio de mensagem retornou:
```json
{"error":{"message":"(#133010) Account not registered","type":"OAuthException","code":133010}}
```

Isso significa que o **numero de telefone da Meta** (`phone_number_id: 935310426342230`) ainda nao completou o registro no WhatsApp Business. Possiveis causas:
- O numero nao concluiu a verificacao no Meta Business Manager
- O app Meta ainda esta em modo Sandbox (nao passou pelo App Review)
- O token de acesso expirou ou nao tem permissao `whatsapp_business_messaging`

**3. Configuracao no banco esta OK**

| Campo | Valor |
|---|---|
| Provedor | meta |
| Ativo | true |
| Unidade | Central Gas (Matriz) |
| Phone Number ID | 935310426342230 |
| WABA ID | 2512580879177377 |
| Token | Configurado |
| Verify Token | gasfacil_meta_verify |

A verificacao do webhook (GET com hub.challenge) funciona corretamente.

### Plano de correcao

**Passo 1: Resolver conflito de merge no `meta-webhook/index.ts`**
- Remover marcadores `<<<<<<<`, `=======`, `>>>>>>>`
- Manter a versao completa (com off-hours block e tipo_contato)
- Linhas 155-169

**Passo 2: Re-deploy da edge function**
- Deploy `meta-webhook` apos correcao

**Passo 3: Orientacao sobre a Meta API (requer acao manual do usuario)**

O erro 133010 e externo ao sistema. Para resolve-lo voce precisa:
1. Acessar o [Meta Business Manager](https://business.facebook.com) e verificar se o numero associado ao Phone Number ID `935310426342230` esta com status **Connected/Verified**
2. Confirmar que o App Meta esta em modo **Live** (nao Development/Sandbox)
3. Verificar se o token de acesso permanente foi gerado corretamente com a permissao `whatsapp_business_messaging`
4. Se o token for temporario (expira em 24h), gerar um token permanente via System User no Business Manager

### Detalhes tecnicos

- **Arquivo editado**: `supabase/functions/meta-webhook/index.ts` (resolver merge conflict linhas 155-169)
- **Deploy**: `meta-webhook`
- **Sem alteracao no banco de dados**


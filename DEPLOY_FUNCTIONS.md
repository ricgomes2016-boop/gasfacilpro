# Guia de Deploy das Supabase Edge Functions

Como as funções da BIA e os webhooks de integração residem em seu ambiente de produção do Supabase (vinculado ao Lovable), utilize os comandos abaixo para aplicar as últimas correções e funcionalidades.

## Pré-requisitos
1. Ter o [Supabase CLI](https://supabase.com/docs/guides/cli) instalado.
2. Estar logado na sua conta: `supabase login`.
3. Certificar-se de que o projeto está linkado: `supabase link --project-ref seu-id-do-projeto`.

## Comandos de Deploy

Execute os comandos abaixo no terminal da raiz do projeto para atualizar os webhooks principais com as correções da BIA:

### Webhooks de Mensageria (Essenciais para a BIA)
```powershell
# Evolution API
supabase functions deploy evolution-webhook --no-verify-jwt

# Z-API
supabase functions deploy zapi-webhook --no-verify-jwt

# Gateway API
supabase functions deploy gateway-webhook --no-verify-jwt

# Meta (WhatsApp Cloud API)
supabase functions deploy meta-webhook --no-verify-jwt

# UaZapi
supabase functions deploy uazapi-webhook --no-verify-jwt
```

### Outros Webhooks Relacionados
```powershell
# Vapi (Assistente de Voz)
supabase functions deploy vapi-webhook --no-verify-jwt

# Bina
supabase functions deploy bina-webhook --no-verify-jwt
```

---
> [!TIP]
> O parâmetro `--no-verify-jwt` é necessário para webhooks externos (WhatsApp, Vapi, etc.) que não enviam um token JWT da Supabase Auth no cabeçalho.

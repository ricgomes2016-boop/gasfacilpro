

## Problema identificado

A rota `/chat` (Caixa de Entrada / Inbox WhatsApp) **nao esta registrada** nas listas de rotas permitidas para o subdominio ERP em `src/lib/subdomain.ts`.

Quando o usuario acessa `/chat` no dominio `app.gasfacilpro.com.br`:
1. `isRouteAllowedForSubdomain("erp", "/chat")` retorna `false`
2. `SubdomainGuard` redireciona para `/dashboard` (rota padrao do ERP)

## Correcao

**Arquivo:** `src/lib/subdomain.ts`

1. Adicionar `"/chat"` ao array `erpPrefixes` (linha ~152) para que `inferAppFromPath` reconheca a rota como pertencente ao ERP
2. Adicionar `matchesRouteSegment(pathname, "/chat")` na checagem do case `"erp"` em `isRouteAllowedForSubdomain` (linha ~214)

Sao duas addicoes de uma linha cada, no mesmo arquivo.


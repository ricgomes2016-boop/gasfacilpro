

# Fix: Marketing Dashboard redireciona para Dashboard do sistema

## Problema

O arquivo `src/lib/subdomain.ts` contém uma lista `erpPrefixes` que define quais rotas pertencem ao ERP. O prefixo `/marketing` não está nessa lista, então o `SubdomainGuard` não reconhece a rota e redireciona para o dashboard padrão.

## Correção

**Arquivo:** `src/lib/subdomain.ts` (linha ~166)

Adicionar `"/marketing"` à lista `erpPrefixes`.

Resultado: ao clicar em "Gestão de Marketing > Dashboard", o sistema vai carregar corretamente `/marketing` (DashboardMarketing) em vez de redirecionar para `/dashboard`.


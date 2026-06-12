
## Diagnóstico (com base no print)

A produção em `app.gasfacilpro.com.br` ainda está batendo no **projeto Supabase antigo** `gcrdftnnbgsogoqcmcxo.supabase.co`. Todas as URLs no console (`/rest/v1/pedidos`, `/rest/v1/plano_modulos`, `/rest/v1/push_subscriptions`, `/rest/v1/vw_conferencia_caixa`) apontam para esse host antigo. O erro `column pedidos.numero_sequencial does not exist` confirma: aquele projeto antigo não tem o schema atual — o schema novo está em `scqenurznkatvrqxqjmt`, que é o backend ativo no Lovable Cloud e o que o preview usa.

Ou seja, **não é schema drift, não é RLS, não é falta de coluna**. É o bundle de produção apontando para o Supabase errado. O `.env` da sandbox e o fallback do `vite.config.ts` já estão corretos (corrigi na mensagem anterior), mas:

1. A produção ainda serve um **bundle antigo** (`client-DdhliiW5.js`), provavelmente do service worker PWA cacheado.
2. Pode existir também um build publicado anterior à correção do `vite.config.ts`.

Todos os outros "erros" do print (400 em `pedidos`, `plano_modulos`, `push_subscriptions`, 404 em `vw_conferencia_caixa`) são consequência disso — o app está conversando com o projeto errado. **Não vão sumir mexendo em schema, policy ou migration.**

## O que fazer (escopo mínimo e seguro)

### 1. Republicar a produção
- Garantir que o bundle publicado contém o `vite.config.ts` corrigido (fallback `scqenurznkatvrqxqjmt`).
- Nenhuma alteração de código adicional necessária para isso.

### 2. Invalidar o service worker / cache do PWA
O projeto tem PWA com `VitePWA` + `forceAppUpdate` (mem `technical/maintenance/forced-update-mechanism`). Bumpar o build id força `SKIP_WAITING` + cache busting nos clientes que já têm o app instalado.

- Incrementar uma constante de versão usada pelo SW / `forceAppUpdate`, ou
- Confiar no `buildVersion = new Date().toISOString()` já presente em `vite.config.ts` (cada novo build já gera id diferente) — então só republicar deve resolver para a maioria, mas usuários com SW antigo precisam de um hard reload.

Instrução para o usuário: após publicar, abrir `app.gasfacilpro.com.br` e fazer **Ctrl+Shift+R** uma vez (ou DevTools → Application → Service Workers → Unregister).

### 3. Verificação pós-publish (sem alterar código)
Abrir `app.gasfacilpro.com.br` no console e confirmar que as requests `/rest/v1/...` agora vão para `scqenurznkatvrqxqjmt.supabase.co`. Se sim, todos os erros do print desaparecem juntos.

## O que NÃO faço neste plano (intencionalmente)

A lista de 10 frentes do pedido (schema drift de profiles/empresas/unidades/clientes/pedidos/contas_*, revisão de RLS, redeploy genérico de todas as edge functions, DNS, landing page) **não é a causa do problema visível**. As regras de memória são explícitas:

- `Stability over aesthetics. Maintain existing code structures unconditionally.`
- `NEVER refactor App.tsx, provider nesting, or routes.`
- `Nunca resolver erro desativando RLS globalmente` — e por simetria, nunca rodar migration "preventiva" em massa sem erro reproduzível, porque já quebrou produção antes.

Rodar migration genérica em `pedidos`, `clientes`, `contas_pagar`, etc. agora seria criar problemas no projeto **certo** (`scqenurznkatvrqxqjmt`) para tentar resolver erros que vêm do projeto **errado** (`gcrdftnnbgsogoqcmcxo`). Depois do republish, se sobrar algum erro real no Supabase correto, eu trato pontualmente, um por um, com evidência.

## Detalhes técnicos

- `vite.config.ts` (já editado na mensagem anterior): `currentSupabaseProjectId = "scqenurznkatvrqxqjmt"`, `legacySupabaseProjectId = "gcrdftnnbgsogoqcmcxo"`. Qualquer env var residual com o id legado é descartado e cai no fallback correto.
- `.env` da sandbox: já aponta para `scqenurznkatvrqxqjmt` (confirmado).
- `src/integrations/supabase/client.ts`: lê `import.meta.env.VITE_SUPABASE_URL` / `_PUBLISHABLE_KEY` — não precisa tocar.
- `src/contexts/AuthContext.tsx`: já usa `.maybeSingle()` para `profiles` (corrigido antes).
- PWA: `VitePWA` com `registerType: "autoUpdate"` — novo build invalida automaticamente, mas SW já instalado pode demorar 1 reload pra trocar.

## Critério de aceite

Após publicar e dar Ctrl+Shift+R:
- Console não tem mais nenhuma request para `gcrdftnnbgsogoqcmcxo.supabase.co`.
- `column ... does not exist` desaparece.
- 400/404 em `pedidos`, `plano_modulos`, `push_subscriptions`, `vw_conferencia_caixa` desaparecem.
- Seletor de loja mostra "Central Gas" com as 7 unidades.

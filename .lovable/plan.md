## Controle de acesso por plano (Básico / Starter / Enterprise)

Nova área no admin para mapear cada página/módulo do sistema a um ou mais planos do SaaS, usando checkboxes. O plano da empresa (`empresas.plano`) já existe — vamos usar a mesma chave (`basico`, `starter`, `enterprise`).

### 1. Banco de dados (migration)

Criar tabela `public.plano_modulos` para guardar a matriz de acesso:

```
plano_modulos
- id (uuid, pk)
- modulo_key (text, ex: "vendas.pdv")  -- identificador único da página/submenu
- modulo_label (text, ex: "PDV")
- modulo_grupo (text, ex: "Vendas")    -- para agrupar na UI
- path (text, nullable)                 -- rota usada para gate em runtime
- planos (text[])                       -- ex: {'starter','enterprise'}
- updated_at, updated_by
```

- Índices: `unique(modulo_key)`, `gin(planos)`.
- GRANTs: `SELECT` para `authenticated` (todo usuário logado precisa ler para o sidebar/guard); `ALL` para `service_role`; INSERT/UPDATE/DELETE só via política de super_admin.
- RLS:
  - SELECT: `authenticated` (público interno, sem dados sensíveis).
  - INSERT/UPDATE/DELETE: `has_role(auth.uid(),'super_admin')`.
- Seed inicial: popular com **todos os itens** de `src/components/layout/menuItems.ts` (cada submenu vira uma linha) + páginas do `/admin/*` ficam de fora (admin não é gated por plano). Default: todos os módulos liberados para `{'basico','starter','enterprise'}` para não quebrar nada na largada.

### 2. Nova página admin: `/admin/planos-modulos`

- Adicionar item "Planos & Módulos" no `AdminLayout` (ícone `Lock`/`Package`).
- Layout: tabela agrupada por `modulo_grupo` com:
  - Coluna "Módulo" (label + path em cinza).
  - 3 colunas de checkbox: **Básico**, **Starter**, **Enterprise**.
  - Checkbox no header de cada plano para marcar/desmarcar a coluna inteira.
- Toolbar: busca por nome, filtro por grupo, botão "Salvar alterações" (faz upsert em batch).
- Edição puramente client-side até clicar em salvar (evita ruído com toggles individuais).
- Toast de sucesso/erro e `fetchData()` após salvar.

### 3. Runtime: aplicar o gate

Criar `src/hooks/usePlanoAccess.ts`:
- Busca `empresas.plano` da empresa do usuário (cache via React Query).
- Busca `plano_modulos` (cache 5 min) e expõe:
  - `canAccess(moduloKey | path): boolean`
  - `planoAtual: 'basico' | 'starter' | 'enterprise'`
  - Super_admin sempre `true`.

Pontos de integração (mínimos, sem refatorar):
1. **Sidebar (`menuItems.ts` + `Sidebar.tsx`)**: filtrar submenu items cujo `path` não esteja liberado para o plano atual. Itens de grupo cujos submenus ficam todos bloqueados são ocultados.
2. **Rotas**: criar `<PlanoGuard>` wrapper leve usado em `App.tsx` apenas como fallback — se o usuário acessar uma URL direta de módulo não liberado, mostra tela "Módulo não incluído no seu plano — faça upgrade" com CTA para WhatsApp/contato. **Não vamos refatorar App.tsx**: o guard é opt-in, aplicado só onde quisermos depois; o filtro do sidebar já cobre 99% dos casos.

### 4. O que NÃO muda agora

- `App.tsx`, providers e rotas existentes permanecem intactos.
- Páginas do `/admin/*`, `/contador/*`, `/cliente/*`, `/entregador/*`, `/transportadora/*` não entram no controle (são portais separados).
- Não mexemos em RLS de outras tabelas — o gate é só de UI/rota.
- Nada bloqueia retroativamente: seed começa com todo mundo liberado em todos os planos.

### 5. Ordem de execução

1. Migration: tabela + RLS + GRANTs + seed completo dos módulos.
2. Página `/admin/planos-modulos` + item no `AdminLayout`.
3. Hook `usePlanoAccess` + filtro no `Sidebar`.
4. Componente `PlanoGuard` (sem aplicar em rotas ainda — fica disponível).

Quer que eu siga assim? Posso ajustar a granularidade (ex: marcar página inteira vs. submenu individual) ou trocar o default do seed (liberar tudo só no enterprise, por ex.) antes de começar.
## Diagnóstico

O `admin@gasfacil.com` tem `profiles.empresa_id = Central Gas`. Mesmo com acesso à unidade Forte Gás via `user_unidades`, o seletor de empresa/unidade do ERP considera a empresa do profile como principal — por isso ao tentar trocar para Forte Gás "nada acontece". A forma limpa de resolver é ter um usuário admin dedicado por empresa.

## Plano

### 1. Criar usuário admin dedicado para Forte Gás
- **Email:** `admin@fortegas.com`
- **Senha:** `123456`
- Criar em `auth.users` via edge function administrativa (usa `service_role`), com `email_confirmed_at` preenchido (sem etapa de confirmação).
- `raw_user_meta_data` = `{ full_name: "Admin Forte Gás" }`.

### 2. Configurar perfil, papéis e acesso
- `profiles`: `full_name = "Admin Forte Gás"`, `email = admin@fortegas.com`, `empresa_id = c94c210b-8dbd-4d91-914e-2db146b8cf94` (Forte Gás).
- `user_roles`: inserir `gestor` **e** `admin` (mesmo padrão do admin atual).
- `user_unidades`: vincular à unidade **Forte Gás** (`3a3dbca4-f9c5-4564-8f58-7ed5f6b7ed05`).

### 3. Isolar `admin@gasfacil.com` na Central Gas
- Remover de `user_unidades` a linha que dá a esse usuário acesso à unidade Forte Gás, mantendo intactos os vínculos com as 9 unidades da Central Gas.
- Não altera senha, roles nem profile — segue como gestor+admin da Central Gas.

### 4. Como executar
- Criar edge function pontual `admin-create-forte-gas` (Deno + `SERVICE_ROLE_KEY`) que faz `auth.admin.createUser`, retorna o novo `user_id` e persiste profile/roles/unidade em uma única execução.
- Invocar a função uma única vez a partir do chat (via `supabase.functions.invoke` no console, ou eu chamo direto pelo teste de edge function).
- Rodar um `UPDATE`/`DELETE` no `user_unidades` para desvincular o admin antigo da unidade Forte Gás.
- Validar consultando `profiles`, `user_roles` e `user_unidades` do novo usuário.

## Fora de escopo
- Nenhuma alteração em telas, guards, contexts ou `App.tsx`.
- Nenhuma nova política RLS (as existentes já cobrem gestor/admin por unidade).
- Recomendação: alterar a senha `123456` após o primeiro login (senha fraca, apenas para bootstrap).
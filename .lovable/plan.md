Garantir que todo parceiro tenha `profiles.empresa_id` igual à empresa da unidade do cadastro de parceiro — sem isso, as RLS de tenant negam acesso e o portal mostra "conta não vinculada".

## Causa raiz

- `vale_gas_parceiros` está corretamente vinculado a `unidade_id` (Central Gas) e indiretamente a uma `empresa_id` via `unidades.empresa_id` (Central Gás).
- A RLS RESTRICTIVE `tenant_isolation_vale_gas_parceiros` exige `unidade_belongs_to_user_empresa(unidade_id)`, que compara com `profiles.empresa_id` do usuário.
- O perfil do `amigao2` está com `empresa_id = NULL`, então a query do dashboard não retorna nada e o portal mostra a mensagem "Sua conta não está vinculada".

## O que o plano faz

1. **Backfill imediato** — atualizar `profiles.empresa_id` de todos os usuários que já são parceiros (`vale_gas_parceiros.user_id`) com a `empresa_id` da unidade do cadastro de parceiro. Isso destrava o amigao2 e qualquer outro parceiro na mesma situação.

2. **Trigger no `vale_gas_parceiros`** — sempre que um cadastro de parceiro for criado/atualizado com `user_id` e `unidade_id`, sincronizar `profiles.empresa_id` desse usuário com a empresa da unidade. Garante que nunca mais um parceiro fique sem empresa associada.

3. **Isolamento entre empresas mantido** — não altero nenhuma RLS. A regra "vales acessíveis em todas as filiais da mesma empresa, mas nunca em outra empresa do SaaS" continua sendo enforçada pelas policies atuais (`tenant_isolation_vale_gas` e `tenant_isolation_vale_gas_parceiros`).

4. **Sem mudanças no frontend** — o `useParceiroDados` e o dashboard continuam iguais; com a RLS passando, o parceiro carrega normalmente.

## Detalhes técnicos

- Migration SQL:
  - `UPDATE profiles SET empresa_id = u.empresa_id FROM vale_gas_parceiros vp JOIN unidades u ON u.id = vp.unidade_id WHERE profiles.user_id = vp.user_id AND profiles.empresa_id IS NULL;`
  - Função `sync_parceiro_profile_empresa()` + trigger `AFTER INSERT OR UPDATE OF user_id, unidade_id ON vale_gas_parceiros` que faz o mesmo `UPDATE` para o parceiro afetado.
- Nenhuma alteração em `App.tsx`, providers ou rotas.
- Nenhuma alteração em `vale_gas_parceiros`, `vale_gas` ou em suas RLS (a regra de cross-filial e isolamento entre empresas permanece).
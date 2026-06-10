## Problema

Em `/config/unidades` aparecem várias "Matriz" vazias — são unidades de OUTRAS empresas (outros tenants) vazando para o usuário atual.

## Causa

A tabela `unidades` tem uma política RLS permissiva sem filtro de tenant:

```
"Admin/Gestor can manage unidades"
FOR ALL TO authenticated
USING (has_role(admin) OR has_role(gestor))
```

Como políticas PERMISSIVE são combinadas com OR, qualquer admin/gestor enxerga unidades de TODAS as empresas, ignorando `empresa_id`. Os cards vazios "Matriz" são as matrizes-padrão das demais empresas do banco (CNPJ nulo).

As demais políticas já cobrem o caso correto:
- `tenant_isolation_unidades` — super_admin OU mesma empresa OU contador autorizado
- `Admins can update/delete/insert unidades` — exigem `empresa_id = get_user_empresa_id()`
- `Staff can view empresa unidades` — mesma empresa

## Correção

Migração única que substitui a política vazada por uma versão com escopo de empresa:

```sql
DROP POLICY "Admin/Gestor can manage unidades" ON public.unidades;

CREATE POLICY "Admin/Gestor can manage own empresa unidades"
  ON public.unidades
  FOR ALL TO authenticated
  USING (
    empresa_id = get_user_empresa_id()
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'))
  )
  WITH CHECK (
    empresa_id = get_user_empresa_id()
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'))
  );
```

Super admin continua vendo tudo pelas políticas dedicadas; contadores continuam com `contador_has_empresa`.

## Verificação

Após a migração, recarregar `/config/unidades`: deve listar apenas as unidades da empresa "Central Gas" (Matriz + filiais Japa Gás, Temgas, Sertaneja, ABMF, Forte Gás, Morumbi Gás). Nenhum card "Matriz" vazio de outras empresas.
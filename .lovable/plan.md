# Corrigir erro RLS ao criar conversa WhatsApp

## Causa
A tabela `ai_conversas` tem uma policy **RESTRICTIVE** chamada `tenant_isolation_ai_conversas` que exige `user_id = auth.uid()` (ou `super_admin`). Como policies restritivas são combinadas com AND, ela bloqueia inserts feitos pelos operadores usando o UUID de sistema (`00000000-0000-0000-0000-000000000000`) — mesmo a nova policy permissiva sendo válida.

## Correção (1 migration)
Recriar a policy restritiva de forma que também aceite as conversas de WhatsApp da plataforma quando o usuário tem role `admin`, `gestor` ou `operacional`:

```sql
DROP POLICY "tenant_isolation_ai_conversas" ON public.ai_conversas;

CREATE POLICY "tenant_isolation_ai_conversas"
ON public.ai_conversas
AS RESTRICTIVE
FOR ALL
TO public
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR user_id = auth.uid()
  OR (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gestor'::app_role)
      OR has_role(auth.uid(), 'operacional'::app_role)
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR user_id = auth.uid()
  OR (
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gestor'::app_role)
      OR has_role(auth.uid(), 'operacional'::app_role)
    )
  )
);
```

Sem mudanças de código frontend. Após aplicar, o botão "Iniciar" no diálogo Nova Conversa funciona para Janaina e demais clientes.

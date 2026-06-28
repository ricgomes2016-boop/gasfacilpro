ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS app_scope text NOT NULL DEFAULT 'erp',
  ADD COLUMN IF NOT EXISTS portal_host text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'push_subscriptions_app_scope_check'
  ) THEN
    ALTER TABLE public.push_subscriptions
      ADD CONSTRAINT push_subscriptions_app_scope_check
      CHECK (app_scope IN (
        'erp',
        'atendimento',
        'entregador',
        'vendedor',
        'cliente',
        'parceiro',
        'transportadora',
        'contador'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_push_subs_scope_empresa_unidade
  ON public.push_subscriptions(app_scope, empresa_id, unidade_id);

UPDATE public.push_subscriptions
SET app_scope = CASE
  WHEN lower(coalesce(user_agent, '')) LIKE '%app=entregador%' THEN 'entregador'
  WHEN lower(coalesce(user_agent, '')) LIKE '%app=cliente%' THEN 'cliente'
  WHEN lower(coalesce(user_agent, '')) LIKE '%app=vendedor%' THEN 'vendedor'
  WHEN lower(coalesce(user_agent, '')) LIKE '%app=parceiro%' THEN 'parceiro'
  WHEN lower(coalesce(user_agent, '')) LIKE '%app=transportadora%' THEN 'transportadora'
  WHEN lower(coalesce(user_agent, '')) LIKE '%app=atendimento%' THEN 'atendimento'
  WHEN provider = 'fcm' THEN 'entregador'
  ELSE app_scope
END;

UPDATE public.push_subscriptions ps
SET
  app_scope = 'entregador',
  unidade_id = coalesce(ps.unidade_id, e.unidade_id)
FROM public.entregadores e
WHERE e.user_id IS NOT NULL
  AND ps.user_id = e.user_id
  AND ps.app_scope = 'erp';

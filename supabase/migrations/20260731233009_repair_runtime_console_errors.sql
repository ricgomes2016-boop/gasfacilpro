-- Repair runtime console errors seen in production after dashboard load.
-- Safe to run more than once: every schema change uses IF NOT EXISTS or replaces objects.

-- 1) Web push registration: production is missing columns used by the client.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  unidade_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  subscription jsonb,
  provider text NOT NULL DEFAULT 'web',
  fcm_token text,
  app_scope text NOT NULL DEFAULT 'erp',
  portal_host text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS subscription jsonb,
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS fcm_token text,
  ADD COLUMN IF NOT EXISTS app_scope text NOT NULL DEFAULT 'erp',
  ADD COLUMN IF NOT EXISTS portal_host text,
  ADD COLUMN IF NOT EXISTS p256dh text,
  ADD COLUMN IF NOT EXISTS auth text,
  ADD COLUMN IF NOT EXISTS endpoint text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS empresa_id uuid,
  ADD COLUMN IF NOT EXISTS unidade_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.push_subscriptions
  ALTER COLUMN endpoint DROP NOT NULL,
  ALTER COLUMN p256dh DROP NOT NULL,
  ALTER COLUMN auth DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'push_subscriptions_app_scope_check'
      AND conrelid = 'public.push_subscriptions'::regclass
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

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_unique
  ON public.push_subscriptions(endpoint);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint_unique
  ON public.push_subscriptions(endpoint);

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_fcm_token_key
  ON public.push_subscriptions(fcm_token)
  WHERE fcm_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_subs_user
  ON public.push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_push_subs_scope_empresa_unidade
  ON public.push_subscriptions(app_scope, empresa_id, unidade_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Usuários gerenciam suas próprias assinaturas push (select)" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Usuários inserem suas próprias assinaturas push" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Usuários atualizam suas próprias assinaturas push" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Usuários removem suas próprias assinaturas push" ON public.push_subscriptions;

CREATE POLICY "push_subscriptions_select_own"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  OR (
    empresa_id = public.get_user_empresa_id()
    AND (
      public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
      OR public.has_role((SELECT auth.uid()), 'gestor'::public.app_role)
      OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    )
  )
);

CREATE POLICY "push_subscriptions_insert_own"
ON public.push_subscriptions
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "push_subscriptions_update_own"
ON public.push_subscriptions
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "push_subscriptions_delete_own"
ON public.push_subscriptions
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

-- 2) Stock rupture view used by dashboard KPIs.
CREATE OR REPLACE VIEW public.vw_previsao_ruptura
WITH (security_invoker = true) AS
WITH vendas_30d AS (
  SELECT
    pi.produto_id,
    SUM(pi.quantidade)::numeric AS total_vendido
  FROM public.pedido_itens pi
  JOIN public.pedidos pe ON pe.id = pi.pedido_id
  WHERE pe.created_at >= now() - interval '30 days'
    AND pe.status <> 'cancelado'
  GROUP BY pi.produto_id
),
mcmm AS (
  SELECT
    p.id,
    p.nome,
    p.categoria,
    p.tipo_botijao,
    p.estoque,
    p.unidade_id,
    COALESCE(v.total_vendido, 0) / 30.0 AS giro_diario,
    CEIL(COALESCE(v.total_vendido, 0) / 30.0 * 3 * 1.5) AS estoque_minimo_calculado
  FROM public.produtos p
  LEFT JOIN vendas_30d v ON v.produto_id = p.id
  WHERE COALESCE(p.ativo, true) = true
    AND COALESCE(p.tipo_botijao, '') <> 'vazio'
)
SELECT
  id,
  nome,
  categoria,
  tipo_botijao,
  estoque,
  unidade_id,
  ROUND(giro_diario, 2) AS giro_diario,
  estoque_minimo_calculado,
  CASE
    WHEN giro_diario > 0 THEN FLOOR(estoque / giro_diario)::int
    ELSE NULL
  END AS dias_ate_ruptura,
  CASE
    WHEN estoque <= 0 THEN 'sem_estoque'
    WHEN estoque <= estoque_minimo_calculado THEN 'critico'
    WHEN giro_diario > 0 AND FLOOR(estoque / giro_diario) <= 7 THEN 'alerta'
    ELSE 'ok'
  END AS situacao
FROM mcmm;

GRANT SELECT ON public.vw_previsao_ruptura TO authenticated;

-- 3) cliente_unidades count on dashboard: make table/API access and RLS deterministic.
CREATE TABLE IF NOT EXISTS public.cliente_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, unidade_id)
);

CREATE INDEX IF NOT EXISTS idx_cliente_unidades_unidade
  ON public.cliente_unidades(unidade_id);

CREATE INDEX IF NOT EXISTS idx_cliente_unidades_cliente
  ON public.cliente_unidades(cliente_id);

ALTER TABLE public.cliente_unidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view cliente_unidades for their unidades" ON public.cliente_unidades;
DROP POLICY IF EXISTS "Staff can insert cliente_unidades" ON public.cliente_unidades;
DROP POLICY IF EXISTS "Staff can delete cliente_unidades" ON public.cliente_unidades;
DROP POLICY IF EXISTS "cliente_unidades_select_scope" ON public.cliente_unidades;
DROP POLICY IF EXISTS "cliente_unidades_insert_scope" ON public.cliente_unidades;
DROP POLICY IF EXISTS "cliente_unidades_delete_scope" ON public.cliente_unidades;

CREATE POLICY "cliente_unidades_select_scope"
ON public.cliente_unidades
FOR SELECT
TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.unidades u
    WHERE u.id = cliente_unidades.unidade_id
      AND u.empresa_id = public.get_user_empresa_id()
  )
);

CREATE POLICY "cliente_unidades_insert_scope"
ON public.cliente_unidades
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.unidades u
    WHERE u.id = cliente_unidades.unidade_id
      AND u.empresa_id = public.get_user_empresa_id()
  )
);

CREATE POLICY "cliente_unidades_delete_scope"
ON public.cliente_unidades
FOR DELETE
TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.unidades u
    WHERE u.id = cliente_unidades.unidade_id
      AND u.empresa_id = public.get_user_empresa_id()
  )
);

GRANT SELECT, INSERT, DELETE ON public.cliente_unidades TO authenticated;

-- Refresh PostgREST schema cache so newly added columns are visible immediately.
NOTIFY pgrst, 'reload schema';

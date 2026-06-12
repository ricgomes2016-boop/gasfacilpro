ALTER TABLE public.unidades
  ADD COLUMN IF NOT EXISTS bairros_atendidos text,
  ADD COLUMN IF NOT EXISTS horario_abertura text DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS horario_fechamento text DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS gas_do_povo_habilitado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gas_do_povo_valor numeric(10,2) NOT NULL DEFAULT 101.08;

GRANT SELECT (
  bairros_atendidos,
  horario_abertura,
  horario_fechamento,
  gas_do_povo_habilitado,
  gas_do_povo_valor
) ON public.unidades TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  subscription jsonb NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own"
ON public.push_subscriptions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_insert_own"
ON public.push_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update_own"
ON public.push_subscriptions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_delete_own"
ON public.push_subscriptions FOR DELETE
USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

CREATE TABLE IF NOT EXISTS public.plano_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_key text NOT NULL UNIQUE,
  modulo_label text NOT NULL,
  categoria text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plano_modulos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plano_modulos_select_authenticated" ON public.plano_modulos;
CREATE POLICY "plano_modulos_select_authenticated"
ON public.plano_modulos FOR SELECT
TO authenticated
USING (true);

GRANT SELECT ON public.plano_modulos TO authenticated;

CREATE OR REPLACE FUNCTION public.get_empresa_by_slug(_slug text)
RETURNS public.empresas
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.*
  FROM public.empresas e
  WHERE e.slug = _slug
    AND COALESCE(e.ativo, true) = true
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_empresa_by_slug(text) TO anon, authenticated;

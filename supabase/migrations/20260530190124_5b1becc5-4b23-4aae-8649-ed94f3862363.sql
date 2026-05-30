-- Tabela de mapeamento módulo -> planos
CREATE TABLE IF NOT EXISTS public.plano_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_key text NOT NULL UNIQUE,
  modulo_label text NOT NULL,
  modulo_grupo text NOT NULL,
  path text,
  planos text[] NOT NULL DEFAULT ARRAY['basico','starter','enterprise']::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE INDEX IF NOT EXISTS idx_plano_modulos_grupo ON public.plano_modulos(modulo_grupo);
CREATE INDEX IF NOT EXISTS idx_plano_modulos_planos ON public.plano_modulos USING gin(planos);

GRANT SELECT ON public.plano_modulos TO authenticated;
GRANT ALL ON public.plano_modulos TO service_role;

ALTER TABLE public.plano_modulos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read plano_modulos" ON public.plano_modulos;
CREATE POLICY "Authenticated can read plano_modulos"
  ON public.plano_modulos FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Super admin manages plano_modulos" ON public.plano_modulos;
CREATE POLICY "Super admin manages plano_modulos"
  ON public.plano_modulos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE TABLE public.meta_webhook_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,
  unidade_id uuid,
  object_type text NOT NULL,
  field text,
  external_id text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.meta_webhook_eventos TO authenticated;
GRANT ALL ON public.meta_webhook_eventos TO service_role;

ALTER TABLE public.meta_webhook_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa ve seus eventos meta"
ON public.meta_webhook_eventos
FOR SELECT
TO authenticated
USING (
  empresa_id IS NOT NULL
  AND empresa_id = (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

CREATE INDEX idx_meta_webhook_eventos_empresa ON public.meta_webhook_eventos (empresa_id, created_at DESC);
CREATE INDEX idx_meta_webhook_eventos_unidade ON public.meta_webhook_eventos (unidade_id, created_at DESC);

CREATE TRIGGER update_meta_webhook_eventos_updated_at
BEFORE UPDATE ON public.meta_webhook_eventos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
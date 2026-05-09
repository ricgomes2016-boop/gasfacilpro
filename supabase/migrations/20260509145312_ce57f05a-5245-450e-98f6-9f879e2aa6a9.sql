CREATE TABLE public.whatsapp_test_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  user_id uuid,
  to_number text NOT NULL,
  message text NOT NULL,
  wamid text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  status_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  webhook_received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_test_envios_unidade ON public.whatsapp_test_envios(unidade_id, created_at DESC);
CREATE INDEX idx_wa_test_envios_wamid ON public.whatsapp_test_envios(wamid);

ALTER TABLE public.whatsapp_test_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select wa_test" ON public.whatsapp_test_envios
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id() OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "tenant insert wa_test" ON public.whatsapp_test_envios
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id() AND public.unidade_belongs_to_user_empresa(unidade_id));

CREATE POLICY "tenant delete wa_test" ON public.whatsapp_test_envios
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE TRIGGER trg_wa_test_envios_updated
  BEFORE UPDATE ON public.whatsapp_test_envios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_test_envios;
ALTER TABLE public.whatsapp_test_envios REPLICA IDENTITY FULL;
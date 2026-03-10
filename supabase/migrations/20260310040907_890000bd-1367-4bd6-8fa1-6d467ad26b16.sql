
-- WhatsApp Gateway: Instances table
CREATE TABLE public.whatsapp_gateway_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE CASCADE NOT NULL,
  instance_name text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'disconnected',
  qr_code text,
  webhook_url text,
  webhook_secret text,
  engine_url text NOT NULL,
  api_key text,
  session_data jsonb,
  auto_reconnect boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, instance_name)
);

-- WhatsApp Gateway: Messages log
CREATE TABLE public.whatsapp_gateway_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES public.whatsapp_gateway_instances(id) ON DELETE CASCADE NOT NULL,
  phone text NOT NULL,
  message text,
  media_url text,
  message_type text NOT NULL DEFAULT 'text',
  direction text NOT NULL DEFAULT 'outbound',
  status text DEFAULT 'sent',
  external_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_gateway_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_gateway_messages ENABLE ROW LEVEL SECURITY;

-- RLS: instances - users can see instances from their empresa
CREATE POLICY "Users can view own empresa instances"
  ON public.whatsapp_gateway_instances FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage own empresa instances"
  ON public.whatsapp_gateway_instances FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa_id() OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (empresa_id = public.get_user_empresa_id() OR public.has_role(auth.uid(), 'super_admin'));

-- RLS: messages - access through instance empresa
CREATE POLICY "Users can view own empresa messages"
  ON public.whatsapp_gateway_messages FOR SELECT TO authenticated
  USING (
    instance_id IN (
      SELECT id FROM public.whatsapp_gateway_instances 
      WHERE empresa_id = public.get_user_empresa_id()
    )
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Users can insert messages for own empresa"
  ON public.whatsapp_gateway_messages FOR INSERT TO authenticated
  WITH CHECK (
    instance_id IN (
      SELECT id FROM public.whatsapp_gateway_instances 
      WHERE empresa_id = public.get_user_empresa_id()
    )
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- Indexes for performance
CREATE INDEX idx_gateway_instances_empresa ON public.whatsapp_gateway_instances(empresa_id);
CREATE INDEX idx_gateway_instances_unidade ON public.whatsapp_gateway_instances(unidade_id);
CREATE INDEX idx_gateway_messages_instance ON public.whatsapp_gateway_messages(instance_id);
CREATE INDEX idx_gateway_messages_phone ON public.whatsapp_gateway_messages(phone);
CREATE INDEX idx_gateway_messages_created ON public.whatsapp_gateway_messages(created_at DESC);

-- Enable realtime for instances (status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_gateway_instances;

-- Updated_at trigger
CREATE TRIGGER update_gateway_instances_updated_at
  BEFORE UPDATE ON public.whatsapp_gateway_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

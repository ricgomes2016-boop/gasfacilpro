
-- Table to log transactional emails (simulated or real)
CREATE TABLE public.email_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id),
  tipo TEXT NOT NULL DEFAULT 'geral',
  destinatario_email TEXT NOT NULL,
  destinatario_nome TEXT,
  assunto TEXT NOT NULL,
  corpo TEXT,
  referencia_id TEXT,
  referencia_tipo TEXT,
  status TEXT NOT NULL DEFAULT 'simulado',
  provedor TEXT DEFAULT 'simulado',
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- Users can see emails from their own empresa
CREATE POLICY "Users see own empresa emails"
ON public.email_log FOR SELECT TO authenticated
USING (
  empresa_id = public.get_user_empresa_id()
);

-- Users can insert emails
CREATE POLICY "Users can insert emails"
ON public.email_log FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Restrictive empresa isolation
CREATE POLICY "email_log empresa isolation"
ON public.email_log AS RESTRICTIVE FOR ALL TO authenticated
USING (
  empresa_id IS NULL OR empresa_id = public.get_user_empresa_id()
);

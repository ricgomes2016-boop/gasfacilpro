-- Tabela de roteamento DID (número Twilio) -> empresa
CREATE TABLE IF NOT EXISTS public.did_empresa_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  did text NOT NULL UNIQUE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  provedor text NOT NULL DEFAULT 'twilio',
  observacao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_did_routing_did ON public.did_empresa_routing(did);
CREATE INDEX IF NOT EXISTS idx_did_routing_empresa ON public.did_empresa_routing(empresa_id);

ALTER TABLE public.did_empresa_routing ENABLE ROW LEVEL SECURITY;

-- Admin/gestor da empresa pode ver/gerenciar seus DIDs; super_admin vê tudo
CREATE POLICY "Admins veem DIDs da empresa"
  ON public.did_empresa_routing FOR SELECT
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (empresa_id = public.get_user_empresa_id() AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'gestor'::app_role)
    ))
  );

CREATE POLICY "Admins gerenciam DIDs da empresa"
  ON public.did_empresa_routing FOR ALL
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (empresa_id = public.get_user_empresa_id() AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'gestor'::app_role)
    ))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (empresa_id = public.get_user_empresa_id() AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'gestor'::app_role)
    ))
  );

CREATE TRIGGER trg_did_routing_updated_at
  BEFORE UPDATE ON public.did_empresa_routing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Coluna empresa_id em chamadas_recebidas (se não existir)
ALTER TABLE public.chamadas_recebidas
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chamadas_empresa ON public.chamadas_recebidas(empresa_id);

-- Função pública (anon) para resolver DID -> empresa, usada pelo edge function
CREATE OR REPLACE FUNCTION public.resolver_empresa_por_did(_did text)
RETURNS TABLE(empresa_id uuid, empresa_nome text, unidade_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT r.empresa_id, e.nome, r.unidade_id
  FROM public.did_empresa_routing r
  JOIN public.empresas e ON e.id = r.empresa_id
  WHERE r.ativo = true
    AND (
      r.did = _did
      OR regexp_replace(r.did, '\D', '', 'g') = regexp_replace(COALESCE(_did, ''), '\D', '', 'g')
    )
  LIMIT 1;
$$;

-- Cadastra DID da Forte Gás
INSERT INTO public.did_empresa_routing (did, empresa_id, provedor, observacao)
VALUES ('+554337717463', 'c94c210b-8dbd-4d91-914e-2db146b8cf94', 'twilio', 'DID Twilio Forte Gás (rota via GoTo SIP Trunk ramal 1004)')
ON CONFLICT (did) DO UPDATE SET empresa_id = EXCLUDED.empresa_id, ativo = true, updated_at = now();
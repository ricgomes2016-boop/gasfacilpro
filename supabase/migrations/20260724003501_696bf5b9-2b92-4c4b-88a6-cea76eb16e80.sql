
-- ============================================================
-- 1) formas_pagamento_custom: NULL unidade writes restricted to admin/gestor
-- ============================================================
DROP POLICY IF EXISTS "Usuarios criam formas na sua unidade" ON public.formas_pagamento_custom;
DROP POLICY IF EXISTS "Usuarios editam formas da sua unidade" ON public.formas_pagamento_custom;
DROP POLICY IF EXISTS "Usuarios excluem formas da sua unidade" ON public.formas_pagamento_custom;

CREATE POLICY "Usuarios criam formas na sua unidade"
ON public.formas_pagamento_custom
FOR INSERT
TO authenticated
WITH CHECK (
  (
    unidade_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_unidades uu
      WHERE uu.user_id = auth.uid()
        AND uu.unidade_id = formas_pagamento_custom.unidade_id
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
);

CREATE POLICY "Usuarios editam formas da sua unidade"
ON public.formas_pagamento_custom
FOR UPDATE
TO authenticated
USING (
  (
    unidade_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_unidades uu
      WHERE uu.user_id = auth.uid()
        AND uu.unidade_id = formas_pagamento_custom.unidade_id
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
);

CREATE POLICY "Usuarios excluem formas da sua unidade"
ON public.formas_pagamento_custom
FOR DELETE
TO authenticated
USING (
  (
    unidade_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_unidades uu
      WHERE uu.user_id = auth.uid()
        AND uu.unidade_id = formas_pagamento_custom.unidade_id
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
);

-- ============================================================
-- 2) cliente_precos_negociados: add RESTRICTIVE tenant isolation policy
-- ============================================================
DROP POLICY IF EXISTS tenant_isolation_cliente_precos_negociados ON public.cliente_precos_negociados;

CREATE POLICY tenant_isolation_cliente_precos_negociados
ON public.cliente_precos_negociados
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR unidade_id IS NULL
  OR unidade_belongs_to_user_empresa(unidade_id)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR unidade_id IS NULL
  OR unidade_belongs_to_user_empresa(unidade_id)
);

-- ============================================================
-- 3) clientes: add user_id direct link, backfill from confirmed auth, tighten
--    credits/referrals policies to require the direct link
-- ============================================================
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_user_id ON public.clientes(user_id);

-- One-time backfill: link only when the auth user has confirmed the matching
-- email or phone, and only when unambiguous (one match within the empresa).
WITH candidates AS (
  SELECT c.id AS cliente_id, u.id AS user_id,
         ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY u.created_at) AS rn_cliente,
         ROW_NUMBER() OVER (PARTITION BY u.id, c.empresa_id ORDER BY c.created_at) AS rn_user
  FROM public.clientes c
  JOIN auth.users u ON (
    (u.email_confirmed_at IS NOT NULL
       AND c.email IS NOT NULL AND u.email IS NOT NULL
       AND lower(c.email) = lower(u.email::text))
    OR
    (u.phone_confirmed_at IS NOT NULL
       AND c.telefone IS NOT NULL AND u.phone IS NOT NULL
       AND regexp_replace(c.telefone, '\D', '', 'g') = regexp_replace(u.phone, '\D', '', 'g'))
  )
  WHERE c.user_id IS NULL
)
UPDATE public.clientes c
SET user_id = cand.user_id
FROM candidates cand
WHERE cand.cliente_id = c.id
  AND cand.rn_cliente = 1
  AND cand.rn_user = 1;

-- Replace spoofable policies with direct-link ones
DROP POLICY IF EXISTS "Clientes can view their own credits" ON public.cliente_creditos;
CREATE POLICY "Clientes can view their own credits"
ON public.cliente_creditos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = cliente_creditos.cliente_id
      AND c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Clientes can view their own referrals" ON public.cliente_indicacoes;
CREATE POLICY "Clientes can view their own referrals"
ON public.cliente_indicacoes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE (c.id = cliente_indicacoes.indicador_cliente_id
           OR c.id = cliente_indicacoes.indicado_cliente_id)
      AND c.user_id = auth.uid()
  )
);

-- Harden the security-definer helper the same way
CREATE OR REPLACE FUNCTION public.get_current_user_cliente_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.id
  FROM public.clientes c
  WHERE c.user_id = auth.uid();
$function$;

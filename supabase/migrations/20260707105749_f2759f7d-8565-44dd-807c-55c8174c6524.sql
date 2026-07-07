
DROP POLICY IF EXISTS "Clientes can view their own credits" ON public.cliente_creditos;
CREATE POLICY "Clientes can view their own credits"
ON public.cliente_creditos
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.clientes c ON (
      (u.email_confirmed_at IS NOT NULL
        AND c.email IS NOT NULL AND u.email IS NOT NULL
        AND lower(c.email) = lower(u.email))
      OR
      (u.phone_confirmed_at IS NOT NULL
        AND c.telefone IS NOT NULL AND u.phone IS NOT NULL
        AND regexp_replace(c.telefone, '\D', '', 'g') = regexp_replace(u.phone, '\D', '', 'g'))
    )
    WHERE u.id = auth.uid()
      AND c.id = cliente_creditos.cliente_id
  )
);

DROP POLICY IF EXISTS "Clientes can view their own referrals" ON public.cliente_indicacoes;
CREATE POLICY "Clientes can view their own referrals"
ON public.cliente_indicacoes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.clientes c ON (
      (u.email_confirmed_at IS NOT NULL
        AND c.email IS NOT NULL AND u.email IS NOT NULL
        AND lower(c.email) = lower(u.email))
      OR
      (u.phone_confirmed_at IS NOT NULL
        AND c.telefone IS NOT NULL AND u.phone IS NOT NULL
        AND regexp_replace(c.telefone, '\D', '', 'g') = regexp_replace(u.phone, '\D', '', 'g'))
    )
    WHERE u.id = auth.uid()
      AND c.id = ANY (ARRAY[cliente_indicacoes.indicador_cliente_id, cliente_indicacoes.indicado_cliente_id])
  )
);

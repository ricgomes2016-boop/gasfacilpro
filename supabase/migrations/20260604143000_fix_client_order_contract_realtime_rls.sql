-- Close client-facing RLS gaps reported by the security scanner.

CREATE OR REPLACE FUNCTION public.current_user_owns_cliente(_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clientes c
    JOIN auth.users u ON u.id = auth.uid()
    WHERE c.id = _cliente_id
      AND (
        (
          u.email IS NOT NULL
          AND c.email IS NOT NULL
          AND lower(trim(c.email)) = lower(trim(u.email))
        )
        OR (
          u.phone IS NOT NULL
          AND c.telefone IS NOT NULL
          AND regexp_replace(c.telefone, '\D', '', 'g') <> ''
          AND regexp_replace(c.telefone, '\D', '', 'g')
            = regexp_replace(u.phone, '\D', '', 'g')
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_owns_cliente(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_owns_cliente(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_can_access_pedido(_pedido_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pedidos p
    WHERE p.id = _pedido_id
      AND (
        public.has_role(auth.uid(), 'super_admin'::public.app_role)
        OR public.unidade_belongs_to_user_empresa(p.unidade_id)
        OR (
          public.has_role(auth.uid(), 'cliente'::public.app_role)
          AND public.current_user_owns_cliente(p.cliente_id)
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_can_access_pedido(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_access_pedido(uuid) TO authenticated;

-- Orders: a client can only create and read orders tied to their own record.
DROP POLICY IF EXISTS "Clientes podem criar pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Clientes podem ver seus pedidos" ON public.pedidos;

CREATE POLICY "Clientes criam somente seus pedidos"
ON public.pedidos FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'cliente'::public.app_role)
  AND public.current_user_owns_cliente(cliente_id)
  AND canal_venda = 'Aplicativo'
);

CREATE POLICY "Clientes veem somente seus pedidos"
ON public.pedidos FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'cliente'::public.app_role)
  AND public.current_user_owns_cliente(cliente_id)
);

DROP POLICY IF EXISTS tenant_isolation_pedidos ON public.pedidos;
CREATE POLICY tenant_isolation_pedidos
ON public.pedidos AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.unidade_belongs_to_user_empresa(unidade_id)
  OR (
    public.has_role(auth.uid(), 'cliente'::public.app_role)
    AND public.current_user_owns_cliente(cliente_id)
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.unidade_belongs_to_user_empresa(unidade_id)
  OR (
    public.has_role(auth.uid(), 'cliente'::public.app_role)
    AND public.current_user_owns_cliente(cliente_id)
  )
);

-- Order items inherit access from their parent order.
DROP POLICY IF EXISTS "Clientes podem inserir itens de pedido" ON public.pedido_itens;
DROP POLICY IF EXISTS "Clientes podem ver itens de seus pedidos" ON public.pedido_itens;

CREATE POLICY "Clientes inserem itens somente em seus pedidos"
ON public.pedido_itens FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'cliente'::public.app_role)
  AND public.current_user_can_access_pedido(pedido_id)
);

CREATE POLICY "Clientes veem itens somente de seus pedidos"
ON public.pedido_itens FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'cliente'::public.app_role)
  AND public.current_user_can_access_pedido(pedido_id)
);

DROP POLICY IF EXISTS tenant_isolation_pedido_itens ON public.pedido_itens;
CREATE POLICY tenant_isolation_pedido_itens
ON public.pedido_itens AS RESTRICTIVE FOR ALL TO authenticated
USING (public.current_user_can_access_pedido(pedido_id))
WITH CHECK (public.current_user_can_access_pedido(pedido_id));

-- Recurring contracts: clients can only manage contracts tied to themselves.
DROP POLICY IF EXISTS "clientes_veem_seus_contratos" ON public.contratos_recorrentes;
DROP POLICY IF EXISTS "clientes_criam_contratos" ON public.contratos_recorrentes;
DROP POLICY IF EXISTS "clientes_atualizam_contratos" ON public.contratos_recorrentes;

CREATE POLICY "Clientes veem somente seus contratos"
ON public.contratos_recorrentes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'cliente'::public.app_role)
  AND public.current_user_owns_cliente(cliente_id)
);

CREATE POLICY "Clientes criam somente seus contratos"
ON public.contratos_recorrentes FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'cliente'::public.app_role)
  AND public.current_user_owns_cliente(cliente_id)
);

CREATE POLICY "Clientes atualizam somente seus contratos"
ON public.contratos_recorrentes FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'cliente'::public.app_role)
  AND public.current_user_owns_cliente(cliente_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'cliente'::public.app_role)
  AND public.current_user_owns_cliente(cliente_id)
);

DROP POLICY IF EXISTS tenant_isolation_contratos_recorrentes ON public.contratos_recorrentes;
CREATE POLICY tenant_isolation_contratos_recorrentes
ON public.contratos_recorrentes AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.unidade_belongs_to_user_empresa(unidade_id)
  OR (
    public.has_role(auth.uid(), 'cliente'::public.app_role)
    AND public.current_user_owns_cliente(cliente_id)
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.unidade_belongs_to_user_empresa(unidade_id)
  OR (
    public.has_role(auth.uid(), 'cliente'::public.app_role)
    AND public.current_user_owns_cliente(cliente_id)
  )
);

-- Only users who can access the WhatsApp conversation may use its private typing channel.
CREATE OR REPLACE FUNCTION public.current_user_can_access_realtime_topic(_topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  conversation_id uuid;
BEGIN
  IF _topic !~ '^wa-typing-[0-9a-fA-F-]{36}$' THEN
    RETURN false;
  END IF;

  conversation_id := substring(_topic FROM 11)::uuid;

  RETURN EXISTS (
    SELECT 1
    FROM public.ai_conversas c
    WHERE c.id = conversation_id
      AND (
        c.user_id = auth.uid()
        OR (
          c.empresa_id IS NOT NULL
          AND c.empresa_id = public.get_user_empresa_id()
        )
      )
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_can_access_realtime_topic(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_access_realtime_topic(text) TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can read all realtime topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can write all realtime topics" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated can read all messages" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated can write all messages" ON realtime.messages;

CREATE POLICY "Users read authorized private realtime topics"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND public.current_user_can_access_realtime_topic(realtime.topic())
);

CREATE POLICY "Users write authorized private realtime topics"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  realtime.messages.extension = 'broadcast'
  AND public.current_user_can_access_realtime_topic(realtime.topic())
);

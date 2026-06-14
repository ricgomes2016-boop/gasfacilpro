
-- 1) Revoke column-level SELECT on sensitive credential columns from authenticated/anon.
-- Lovable environments can drift slightly, so only revoke columns that exist.
DO $$
DECLARE
  item record;
  existing_columns text;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('configuracoes_empresa', ARRAY['asaas_api_key', 'asaas_webhook_token']),
      ('integracoes_whatsapp', ARRAY['token', 'instancia_token', 'meta_access_token', 'meta_verify_token', 'security_token']),
      ('transp_outlook_config', ARRAY['microsoft_refresh_token']),
      ('unidades', ARRAY['certificado_a1_senha', 'nfce_csc_token', 'provedor_nfe_token']),
      ('social_accounts', ARRAY['access_token', 'refresh_token', 'token']),
      ('whatsapp_gateway_instances', ARRAY['api_key', 'session_data'])
    ) AS sensitive(table_name, column_names)
  LOOP
    SELECT string_agg(quote_ident(c.column_name), ', ')
    INTO existing_columns
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = item.table_name
      AND c.column_name = ANY(item.column_names);

    IF existing_columns IS NOT NULL THEN
      EXECUTE format(
        'REVOKE SELECT (%s) ON public.%I FROM authenticated, anon',
        existing_columns,
        item.table_name
      );
    END IF;
  END LOOP;
END $$;

-- 2) Restrict ai_mensagens SELECT policy to authenticated role only
DROP POLICY IF EXISTS "ai_mensagens select tenant" ON public.ai_mensagens;
CREATE POLICY "ai_mensagens select tenant"
ON public.ai_mensagens
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR ((empresa_id IS NOT NULL) AND (empresa_id = public.get_user_empresa_id()))
  OR EXISTS (
    SELECT 1 FROM public.ai_conversas c
    WHERE c.id = ai_mensagens.conversa_id
      AND c.empresa_id = public.get_user_empresa_id()
  )
  OR EXISTS (
    SELECT 1 FROM public.ai_conversas c
    WHERE c.id = ai_mensagens.conversa_id
      AND c.user_id = auth.uid()
  )
);

-- 3) Fix mutable search_path on user-defined function
ALTER FUNCTION public.calcular_pontos_palpite(integer, integer, integer, integer)
  SET search_path = public;

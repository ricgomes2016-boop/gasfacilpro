-- Revoga leitura de colunas sensiveis para o role authenticated.
-- A migration e defensiva porque alguns ambientes antigos nao possuem todas as colunas.

DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('configuracoes_empresa', 'asaas_api_key'),
      ('configuracoes_empresa', 'asaas_webhook_token'),
      ('integracoes_whatsapp', 'token'),
      ('integracoes_whatsapp', 'instancia_token'),
      ('integracoes_whatsapp', 'meta_access_token'),
      ('integracoes_whatsapp', 'meta_verify_token'),
      ('integracoes_whatsapp', 'security_token'),
      ('transp_outlook_config', 'microsoft_refresh_token'),
      ('unidades', 'certificado_a1_senha'),
      ('unidades', 'nfce_csc_token'),
      ('unidades', 'provedor_nfe_token'),
      ('whatsapp_gateway_instances', 'api_key'),
      ('whatsapp_gateway_instances', 'session_data')
    ) AS sensitive_columns(table_name, column_name)
  LOOP
    IF to_regclass(format('public.%I', item.table_name)) IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = item.table_name
          AND column_name = item.column_name
      )
    THEN
      EXECUTE format(
        'REVOKE SELECT (%I) ON public.%I FROM authenticated',
        item.column_name,
        item.table_name
      );
    END IF;
  END LOOP;
END $$;

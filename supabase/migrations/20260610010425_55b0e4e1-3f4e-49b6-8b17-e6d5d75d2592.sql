-- Restaura GRANTs perdidos após migração de segurança anterior
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE c.relkind='r' AND n.nspname='public'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.relname);
  END LOOP;
END $$;

-- Tabelas que precisam de leitura anônima (rotas públicas / app cliente / institucional)
GRANT SELECT ON public.unidades TO anon;
GRANT SELECT ON public.empresas TO anon;
GRANT SELECT ON public.produtos TO anon;
GRANT SELECT ON public.configuracoes_visuais TO anon;
GRANT SELECT ON public.promocoes TO anon;
GRANT SELECT ON public.cupons_desconto TO anon;
GRANT SELECT ON public.canais_venda TO anon;

-- Views/sequences/functions defaults para futuras criações
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
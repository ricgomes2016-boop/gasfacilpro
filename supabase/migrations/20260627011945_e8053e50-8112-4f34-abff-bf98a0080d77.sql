REVOKE ALL ON FUNCTION public.fn_dispatch_push_nova_entrega() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_dispatch_push_nova_entrega() FROM anon;
REVOKE ALL ON FUNCTION public.fn_dispatch_push_nova_entrega() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_dispatch_push_nova_entrega() TO service_role;
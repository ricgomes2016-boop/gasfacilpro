REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_readonly_query(text) TO service_role;
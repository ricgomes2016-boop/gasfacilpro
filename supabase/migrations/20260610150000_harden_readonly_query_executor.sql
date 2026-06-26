-- Harden the internal read-only SQL executor used by AI/insights functions.
-- It remains service_role-only and adds SQL-level guardrails so generated
-- queries cannot chain statements, use comments, inspect system schemas, or
-- return unbounded result sets.

CREATE OR REPLACE FUNCTION public.execute_readonly_query(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  normalized text;
  sanitized text;
BEGIN
  IF query_text IS NULL OR length(trim(query_text)) = 0 THEN
    RAISE EXCEPTION 'Consulta vazia';
  END IF;

  sanitized := trim(query_text);
  normalized := upper(sanitized);

  -- Only single SELECT statements are allowed.
  IF NOT (normalized ~ '^SELECT[[:space:]]') THEN
    RAISE EXCEPTION 'Apenas consultas SELECT sao permitidas';
  END IF;

  IF sanitized ~ ';' THEN
    RAISE EXCEPTION 'Multiplos comandos nao sao permitidos';
  END IF;

  IF sanitized ~ '(^|[[:space:]])--' OR sanitized ~ '/\*' THEN
    RAISE EXCEPTION 'Comentarios SQL nao sao permitidos';
  END IF;

  -- Word-boundary validation avoids false positives such as created_at.
  IF normalized ~ '\m(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE|COPY|CALL|MERGE|REFRESH|ANALYZE|VACUUM)\M' THEN
    RAISE EXCEPTION 'Operacao nao permitida';
  END IF;

  -- Block catalog/security schemas and known secret-bearing objects.
  IF normalized ~ '\m(PG_CATALOG|INFORMATION_SCHEMA|AUTH|VAULT|STORAGE)\M'
     OR normalized ~ '\m(HTTP|NET|PG_READ_FILE|PG_SLEEP|DBLINK)\M' THEN
    RAISE EXCEPTION 'Objeto nao permitido';
  END IF;

  EXECUTE
    'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb)
       FROM (SELECT * FROM (' || sanitized || ') q LIMIT 100) t'
  INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.execute_readonly_query(text) TO service_role;

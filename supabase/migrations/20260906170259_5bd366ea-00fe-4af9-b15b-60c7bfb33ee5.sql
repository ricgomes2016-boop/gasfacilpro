CREATE OR REPLACE FUNCTION public.execute_readonly_query(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result jsonb;
  normalized text;
BEGIN
  normalized := upper(trim(query_text));

  IF NOT (normalized LIKE 'SELECT%') THEN
    RAISE EXCEPTION 'Apenas consultas SELECT são permitidas';
  END IF;

  -- Block dangerous keywords (whole words only, so columns like created_at are allowed)
  IF normalized ~ '\m(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE|COPY)\M' THEN
    RAISE EXCEPTION 'Operação não permitida';
  END IF;

  EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || query_text || ') t'
  INTO result;

  RETURN result;
END;
$function$;
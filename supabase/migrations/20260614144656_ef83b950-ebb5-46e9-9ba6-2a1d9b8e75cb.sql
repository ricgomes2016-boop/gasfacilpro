-- Adiciona 'vendedor' ao enum app_role (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'vendedor'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'vendedor';
  END IF;
END$$;
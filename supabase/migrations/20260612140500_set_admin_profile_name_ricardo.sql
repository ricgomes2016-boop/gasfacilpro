UPDATE public.profiles
SET full_name = 'Ricardo',
    updated_at = now()
WHERE lower(email) = 'admin@gasfacil.com'
  AND user_id IN (
    SELECT id FROM auth.users WHERE lower(email) = 'admin@gasfacil.com'
  );

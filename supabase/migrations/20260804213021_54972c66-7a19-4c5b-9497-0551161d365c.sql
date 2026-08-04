-- Defense in depth: block tenant switching directly in the RLS policies
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND empresa_id IS NOT DISTINCT FROM (
    SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    empresa_id IS NULL
    OR empresa_id = public.get_user_empresa_id()
  )
);
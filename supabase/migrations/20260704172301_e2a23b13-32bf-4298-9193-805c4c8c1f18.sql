
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_funcionarios_user_id ON public.funcionarios(user_id);

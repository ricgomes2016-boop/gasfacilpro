
-- 1. Add telefone column to ai_conversas
ALTER TABLE public.ai_conversas ADD COLUMN IF NOT EXISTS telefone TEXT;

-- 2. Drop existing role constraint on ai_mensagens (if any)
DO $$ BEGIN
  ALTER TABLE public.ai_mensagens DROP CONSTRAINT IF EXISTS ai_mensagens_role_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- 3. Add new role constraint allowing 'user', 'assistant', 'human'
ALTER TABLE public.ai_mensagens ADD CONSTRAINT ai_mensagens_role_check CHECK (role IN ('user', 'assistant', 'human'));

-- Add telefone column to ai_conversas
ALTER TABLE public.ai_conversas 
ADD COLUMN IF NOT EXISTS telefone TEXT;

-- We need to drop the existing CHECK constraint on ai_mensagens role
-- The constraint might have a standard name or an auto-generated one based on the table name.
-- Typical Supabase/PostgreSQL names: ai_mensagens_role_check
ALTER TABLE public.ai_mensagens
DROP CONSTRAINT IF EXISTS ai_mensagens_role_check;

-- Add the new constraint allowing 'human' and explicitly naming it so we can reference it easily
ALTER TABLE public.ai_mensagens
ADD CONSTRAINT ai_mensagens_role_check CHECK (role IN ('user', 'assistant', 'human'));

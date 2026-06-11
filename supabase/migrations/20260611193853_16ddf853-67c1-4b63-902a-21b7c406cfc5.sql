
-- 1) Backfill: preencher empresa_id/unidade_id das mensagens órfãs a partir da conversa
UPDATE public.ai_mensagens m
SET empresa_id = c.empresa_id,
    unidade_id = COALESCE(m.unidade_id, c.unidade_id)
FROM public.ai_conversas c
WHERE c.id = m.conversa_id
  AND (m.empresa_id IS NULL OR m.unidade_id IS NULL)
  AND c.empresa_id IS NOT NULL;

-- 2) Hardening do trigger: só preencher quando NULL e não derrubar insert se a conversa não for achada
CREATE OR REPLACE FUNCTION public.fn_ai_mensagens_set_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_emp uuid;
  v_uni uuid;
BEGIN
  IF NEW.empresa_id IS NULL OR NEW.unidade_id IS NULL THEN
    SELECT empresa_id, unidade_id INTO v_emp, v_uni
    FROM public.ai_conversas WHERE id = NEW.conversa_id;
    IF NEW.empresa_id IS NULL THEN NEW.empresa_id := v_emp; END IF;
    IF NEW.unidade_id IS NULL THEN NEW.unidade_id := v_uni; END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) RLS defense-in-depth: permitir leitura quando a conversa pertence à empresa do usuário,
--    mesmo que a mensagem tenha empresa_id NULL (libera Realtime e inbox).
DROP POLICY IF EXISTS "ai_mensagens select tenant" ON public.ai_mensagens;
CREATE POLICY "ai_mensagens select tenant"
ON public.ai_mensagens
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (empresa_id IS NOT NULL AND empresa_id = get_user_empresa_id())
  OR EXISTS (
    SELECT 1 FROM public.ai_conversas c
    WHERE c.id = ai_mensagens.conversa_id
      AND c.empresa_id = get_user_empresa_id()
  )
  OR EXISTS (
    SELECT 1 FROM public.ai_conversas c
    WHERE c.id = ai_mensagens.conversa_id
      AND c.user_id = auth.uid()
  )
);

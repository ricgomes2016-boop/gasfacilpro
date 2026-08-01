-- Normaliza a integracao WhatsApp da Forte Gas para Z-API no Gas Facil Pro.
-- As credenciais ja existem no Supabase/Lovable; esta migration nao cria
-- nem grava tokens novos. Ela apenas corrige o provedor visual/operacional
-- para impedir que a tela trate a conexao Z-API como Evolution.

DO $$
DECLARE
  v_unidade_forte uuid := '3a3dbca4-f9c5-4564-8f58-7ed5f6b7ed05';
BEGIN
  UPDATE public.integracoes_whatsapp
  SET
    provedor = 'zapi',
    provedor_tipo = 'zapi',
    nome_bot = COALESCE(NULLIF(nome_bot, ''), 'Bia'),
    ativo = true,
    status_conexao = CASE
      WHEN token IS NOT NULL AND length(token) > 0 THEN 'conectado'
      ELSE status_conexao
    END,
    updated_at = now()
  WHERE unidade_id = v_unidade_forte
    AND (
      provedor = 'zapi'
      OR instance_id = '3EEFBA668490A10A35AB5A60F245B8AE'
    );
END $$;

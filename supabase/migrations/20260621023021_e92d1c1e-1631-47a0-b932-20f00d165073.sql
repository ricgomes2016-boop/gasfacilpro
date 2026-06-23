-- 1. Brand kit por empresa/unidade
CREATE TABLE IF NOT EXISTS public.marketing_brand_kit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE CASCADE,
  slogan text,
  descricao_curta text,
  tom_voz text DEFAULT 'profissional',
  paleta_cores jsonb DEFAULT '[]'::jsonb,
  hashtags_fixas text,
  frases_proibidas text,
  bairros_atendidos text,
  instagram text,
  facebook text,
  tiktok text,
  whatsapp text,
  link_app text,
  faixa_preco_min numeric,
  faixa_preco_max numeric,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, unidade_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_brand_kit TO authenticated;
GRANT ALL ON public.marketing_brand_kit TO service_role;

ALTER TABLE public.marketing_brand_kit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_kit_select" ON public.marketing_brand_kit;
CREATE POLICY "brand_kit_select" ON public.marketing_brand_kit
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS "brand_kit_insert" ON public.marketing_brand_kit;
CREATE POLICY "brand_kit_insert" ON public.marketing_brand_kit
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS "brand_kit_update" ON public.marketing_brand_kit;
CREATE POLICY "brand_kit_update" ON public.marketing_brand_kit
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

DROP POLICY IF EXISTS "brand_kit_delete" ON public.marketing_brand_kit;
CREATE POLICY "brand_kit_delete" ON public.marketing_brand_kit
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

DROP TRIGGER IF EXISTS trg_marketing_brand_kit_updated_at ON public.marketing_brand_kit;
CREATE TRIGGER trg_marketing_brand_kit_updated_at
  BEFORE UPDATE ON public.marketing_brand_kit
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Workflow de aprovacao em marketing_conteudos.
-- Ambientes antigos podem ainda nao ter esta tabela.
DO $$
BEGIN
  IF to_regclass('public.marketing_conteudos') IS NOT NULL THEN
    ALTER TABLE public.marketing_conteudos
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'rascunho',
      ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
      ADD COLUMN IF NOT EXISTS comentario_revisao text;

    ALTER TABLE public.marketing_conteudos
      DROP CONSTRAINT IF EXISTS marketing_conteudos_status_check;

    ALTER TABLE public.marketing_conteudos
      ADD CONSTRAINT marketing_conteudos_status_check
      CHECK (status IN ('rascunho','em_revisao','aprovado','agendado','publicado','arquivado'));
  END IF;
END $$;

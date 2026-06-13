
-- ENUM de fases
CREATE TYPE public.bolao_fase AS ENUM ('grupos','oitavas_32','oitavas','quartas','semi','terceiro','final');

-- ============= TABELA bolao_jogos =============
CREATE TABLE public.bolao_jogos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL,
  empresa_id uuid,
  fase public.bolao_fase NOT NULL,
  grupo text,
  numero_jogo int NOT NULL,
  data_jogo timestamptz NOT NULL,
  time_casa text NOT NULL,
  time_fora text NOT NULL,
  codigo_casa text,
  codigo_fora text,
  gols_casa_real int,
  gols_fora_real int,
  finalizado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(unidade_id, numero_jogo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bolao_jogos TO authenticated;
GRANT ALL ON public.bolao_jogos TO service_role;

ALTER TABLE public.bolao_jogos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bolao_jogos_select" ON public.bolao_jogos
  FOR SELECT TO authenticated
  USING (public.unidade_belongs_to_user_empresa(unidade_id));

CREATE POLICY "bolao_jogos_insert" ON public.bolao_jogos
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role))
    AND public.unidade_belongs_to_user_empresa(unidade_id)
  );

CREATE POLICY "bolao_jogos_update" ON public.bolao_jogos
  FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role))
    AND public.unidade_belongs_to_user_empresa(unidade_id)
  )
  WITH CHECK (
    (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role))
    AND public.unidade_belongs_to_user_empresa(unidade_id)
  );

CREATE POLICY "bolao_jogos_delete" ON public.bolao_jogos
  FOR DELETE TO authenticated
  USING (
    (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'gestor'::public.app_role))
    AND public.unidade_belongs_to_user_empresa(unidade_id)
  );

-- Função para preencher empresa_id a partir da unidade
CREATE OR REPLACE FUNCTION public.fn_bolao_fill_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.empresa_id IS NULL AND NEW.unidade_id IS NOT NULL THEN
    SELECT empresa_id INTO NEW.empresa_id FROM public.unidades WHERE id = NEW.unidade_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bolao_jogos_fill_empresa
  BEFORE INSERT OR UPDATE ON public.bolao_jogos
  FOR EACH ROW EXECUTE FUNCTION public.fn_bolao_fill_empresa();

CREATE TRIGGER trg_bolao_jogos_updated_at
  BEFORE UPDATE ON public.bolao_jogos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= TABELA bolao_palpites =============
CREATE TABLE public.bolao_palpites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jogo_id uuid NOT NULL REFERENCES public.bolao_jogos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  unidade_id uuid NOT NULL,
  empresa_id uuid,
  gols_casa_palpite int NOT NULL CHECK (gols_casa_palpite >= 0),
  gols_fora_palpite int NOT NULL CHECK (gols_fora_palpite >= 0),
  pontos int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(jogo_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bolao_palpites TO authenticated;
GRANT ALL ON public.bolao_palpites TO service_role;

ALTER TABLE public.bolao_palpites ENABLE ROW LEVEL SECURITY;

-- Todos da mesma empresa veem palpites (necessário para ranking)
CREATE POLICY "bolao_palpites_select" ON public.bolao_palpites
  FOR SELECT TO authenticated
  USING (public.unidade_belongs_to_user_empresa(unidade_id));

-- Cada usuário só insere o seu próprio e antes do jogo começar/finalizar
CREATE POLICY "bolao_palpites_insert" ON public.bolao_palpites
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.unidade_belongs_to_user_empresa(unidade_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.bolao_jogos j
      WHERE j.id = jogo_id
        AND (j.finalizado = true OR j.data_jogo <= now())
    )
  );

CREATE POLICY "bolao_palpites_update" ON public.bolao_palpites
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.bolao_jogos j
      WHERE j.id = jogo_id
        AND (j.finalizado = true OR j.data_jogo <= now())
    )
  );

CREATE POLICY "bolao_palpites_delete" ON public.bolao_palpites
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_bolao_palpites_fill_empresa
  BEFORE INSERT OR UPDATE ON public.bolao_palpites
  FOR EACH ROW EXECUTE FUNCTION public.fn_bolao_fill_empresa();

CREATE TRIGGER trg_bolao_palpites_updated_at
  BEFORE UPDATE ON public.bolao_palpites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= Função de cálculo de pontos =============
CREATE OR REPLACE FUNCTION public.calcular_pontos_palpite(
  _p_casa int, _p_fora int, _r_casa int, _r_fora int
) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _p_casa IS NULL OR _p_fora IS NULL OR _r_casa IS NULL OR _r_fora IS NULL THEN 0
    WHEN _p_casa = _r_casa AND _p_fora = _r_fora THEN 10
    WHEN sign(_p_casa - _p_fora) = sign(_r_casa - _r_fora) THEN 5
    ELSE 0
  END;
$$;

-- Trigger recalcula pontos quando jogo é finalizado / placar real muda
CREATE OR REPLACE FUNCTION public.fn_recalcular_pontos_jogo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.finalizado = true AND NEW.gols_casa_real IS NOT NULL AND NEW.gols_fora_real IS NOT NULL THEN
    UPDATE public.bolao_palpites p
    SET pontos = public.calcular_pontos_palpite(
      p.gols_casa_palpite, p.gols_fora_palpite,
      NEW.gols_casa_real, NEW.gols_fora_real
    )
    WHERE p.jogo_id = NEW.id;
  ELSIF NEW.finalizado = false THEN
    UPDATE public.bolao_palpites SET pontos = 0 WHERE jogo_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bolao_recalc_pontos
  AFTER UPDATE ON public.bolao_jogos
  FOR EACH ROW
  WHEN (
    OLD.finalizado IS DISTINCT FROM NEW.finalizado
    OR OLD.gols_casa_real IS DISTINCT FROM NEW.gols_casa_real
    OR OLD.gols_fora_real IS DISTINCT FROM NEW.gols_fora_real
  )
  EXECUTE FUNCTION public.fn_recalcular_pontos_jogo();

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS codigo_indicacao text,
  ADD COLUMN IF NOT EXISTS indicado_por_cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS codigo_indicacao_usado text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_codigo_indicacao_unique
  ON public.clientes (codigo_indicacao)
  WHERE codigo_indicacao IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_indicado_por_cliente_id
  ON public.clientes (indicado_por_cliente_id)
  WHERE indicado_por_cliente_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.programa_indicacao_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  valor_indicador numeric NOT NULL DEFAULT 10,
  valor_indicado numeric NOT NULL DEFAULT 10,
  ativo boolean NOT NULL DEFAULT true,
  validade_credito_dias integer NOT NULL DEFAULT 90,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (empresa_id)
);

ALTER TABLE public.programa_indicacao_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view referral config by empresa"
ON public.programa_indicacao_config
FOR SELECT TO authenticated
USING (public.user_belongs_to_empresa(auth.uid(), empresa_id));

CREATE POLICY "Admins and gestores can manage referral config by empresa"
ON public.programa_indicacao_config
FOR ALL TO authenticated
USING (
  public.user_belongs_to_empresa(auth.uid(), empresa_id)
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  )
)
WITH CHECK (
  public.user_belongs_to_empresa(auth.uid(), empresa_id)
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  )
);

CREATE TRIGGER update_programa_indicacao_config_updated_at
BEFORE UPDATE ON public.programa_indicacao_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.cliente_indicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  indicador_cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  indicado_cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  codigo_indicacao text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'convertida', 'cancelada')),
  primeiro_pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  valor_credito_indicador numeric NOT NULL DEFAULT 0,
  valor_credito_indicado numeric NOT NULL DEFAULT 0,
  convertido_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (indicado_cliente_id),
  CHECK (indicador_cliente_id <> indicado_cliente_id)
);

ALTER TABLE public.cliente_indicacoes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cliente_indicacoes_empresa_status
  ON public.cliente_indicacoes (empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_cliente_indicacoes_indicador
  ON public.cliente_indicacoes (indicador_cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_indicacoes_indicado
  ON public.cliente_indicacoes (indicado_cliente_id);

CREATE POLICY "Staff can view referrals by empresa"
ON public.cliente_indicacoes
FOR SELECT TO authenticated
USING (public.user_belongs_to_empresa(auth.uid(), empresa_id));

CREATE POLICY "Staff can manage referrals by empresa"
ON public.cliente_indicacoes
FOR ALL TO authenticated
USING (
  public.user_belongs_to_empresa(auth.uid(), empresa_id)
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'operacional'::public.app_role)
  )
)
WITH CHECK (
  public.user_belongs_to_empresa(auth.uid(), empresa_id)
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'operacional'::public.app_role)
  )
);

CREATE POLICY "Clientes can view their own referrals"
ON public.cliente_indicacoes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.clientes c ON lower(c.email) = lower(p.email)
    WHERE p.user_id = auth.uid()
      AND c.id IN (cliente_indicacoes.indicador_cliente_id, cliente_indicacoes.indicado_cliente_id)
  )
);

CREATE TRIGGER update_cliente_indicacoes_updated_at
BEFORE UPDATE ON public.cliente_indicacoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.cliente_creditos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  indicacao_id uuid REFERENCES public.cliente_indicacoes(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'indicacao' CHECK (tipo IN ('indicacao', 'manual', 'uso')),
  natureza text NOT NULL DEFAULT 'credito' CHECK (natureza IN ('credito', 'debito')),
  valor numeric NOT NULL,
  descricao text NOT NULL,
  status text NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'utilizado', 'expirado', 'cancelado')),
  expira_em date,
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cliente_creditos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cliente_creditos_empresa_cliente
  ON public.cliente_creditos (empresa_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_creditos_indicacao
  ON public.cliente_creditos (indicacao_id)
  WHERE indicacao_id IS NOT NULL;

CREATE POLICY "Staff can view credits by empresa"
ON public.cliente_creditos
FOR SELECT TO authenticated
USING (public.user_belongs_to_empresa(auth.uid(), empresa_id));

CREATE POLICY "Staff can manage credits by empresa"
ON public.cliente_creditos
FOR ALL TO authenticated
USING (
  public.user_belongs_to_empresa(auth.uid(), empresa_id)
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'operacional'::public.app_role)
    OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
  )
)
WITH CHECK (
  public.user_belongs_to_empresa(auth.uid(), empresa_id)
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'operacional'::public.app_role)
    OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
  )
);

CREATE POLICY "Clientes can view their own credits"
ON public.cliente_creditos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.clientes c ON lower(c.email) = lower(p.email)
    WHERE p.user_id = auth.uid()
      AND c.id = cliente_creditos.cliente_id
  )
);

CREATE TRIGGER update_cliente_creditos_updated_at
BEFORE UPDATE ON public.cliente_creditos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.gerar_codigo_indicacao_cliente(_cliente_id uuid, _nome text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_codigo text;
  v_sufixo integer := 0;
BEGIN
  v_base := upper(regexp_replace(unaccent(coalesce(_nome, 'CLIENTE')), '[^A-Za-z0-9]', '', 'g'));
  v_base := left(coalesce(nullif(v_base, ''), 'CLIENTE'), 8);
  v_codigo := v_base || '-' || upper(left(_cliente_id::text, 6));

  WHILE EXISTS (SELECT 1 FROM public.clientes WHERE codigo_indicacao = v_codigo AND id <> _cliente_id) LOOP
    v_sufixo := v_sufixo + 1;
    v_codigo := v_base || '-' || upper(left(_cliente_id::text, 4)) || v_sufixo::text;
  END LOOP;

  RETURN v_codigo;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_cliente_indicacao_before_save()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_indicador record;
BEGIN
  IF NEW.codigo_indicacao IS NULL OR trim(NEW.codigo_indicacao) = '' THEN
    NEW.codigo_indicacao := public.gerar_codigo_indicacao_cliente(NEW.id, NEW.nome);
  ELSE
    NEW.codigo_indicacao := upper(trim(NEW.codigo_indicacao));
  END IF;

  IF NEW.codigo_indicacao_usado IS NOT NULL AND trim(NEW.codigo_indicacao_usado) <> '' THEN
    NEW.codigo_indicacao_usado := upper(trim(NEW.codigo_indicacao_usado));
    SELECT id, empresa_id INTO v_indicador
    FROM public.clientes
    WHERE codigo_indicacao = NEW.codigo_indicacao_usado
      AND id <> NEW.id
      AND (NEW.empresa_id IS NULL OR empresa_id = NEW.empresa_id)
    LIMIT 1;

    IF v_indicador.id IS NOT NULL THEN
      NEW.indicado_por_cliente_id := v_indicador.id;
      IF NEW.empresa_id IS NULL THEN
        NEW.empresa_id := v_indicador.empresa_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cliente_indicacao_before_insert ON public.clientes;
CREATE TRIGGER trg_cliente_indicacao_before_insert
BEFORE INSERT ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.fn_cliente_indicacao_before_save();

DROP TRIGGER IF EXISTS trg_cliente_indicacao_before_update ON public.clientes;
CREATE TRIGGER trg_cliente_indicacao_before_update
BEFORE UPDATE OF nome, codigo_indicacao, codigo_indicacao_usado ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.fn_cliente_indicacao_before_save();

CREATE OR REPLACE FUNCTION public.fn_criar_registro_indicacao_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config record;
BEGIN
  IF NEW.indicado_por_cliente_id IS NULL OR NEW.empresa_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.programa_indicacao_config (empresa_id)
  VALUES (NEW.empresa_id)
  ON CONFLICT (empresa_id) DO NOTHING;

  SELECT * INTO v_config
  FROM public.programa_indicacao_config
  WHERE empresa_id = NEW.empresa_id
  LIMIT 1;

  IF COALESCE(v_config.ativo, true) = false THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.cliente_indicacoes (
    empresa_id,
    indicador_cliente_id,
    indicado_cliente_id,
    codigo_indicacao,
    valor_credito_indicador,
    valor_credito_indicado
  ) VALUES (
    NEW.empresa_id,
    NEW.indicado_por_cliente_id,
    NEW.id,
    COALESCE(NEW.codigo_indicacao_usado, ''),
    COALESCE(v_config.valor_indicador, 10),
    COALESCE(v_config.valor_indicado, 10)
  )
  ON CONFLICT (indicado_cliente_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_criar_registro_indicacao_cliente ON public.clientes;
CREATE TRIGGER trg_criar_registro_indicacao_cliente
AFTER INSERT OR UPDATE OF indicado_por_cliente_id ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.fn_criar_registro_indicacao_cliente();

CREATE OR REPLACE FUNCTION public.fn_converter_indicacao_primeiro_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_indicacao record;
  v_config record;
  v_ja_tem_pedido boolean;
  v_expira_em date;
BEGIN
  IF NEW.status <> 'entregue' OR NEW.cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_indicacao
  FROM public.cliente_indicacoes
  WHERE indicado_cliente_id = NEW.cliente_id
    AND status = 'pendente'
  LIMIT 1;

  IF v_indicacao.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.cliente_id = NEW.cliente_id
      AND p.status = 'entregue'
      AND p.id <> NEW.id
  ) INTO v_ja_tem_pedido;

  IF v_ja_tem_pedido THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.programa_indicacao_config (empresa_id)
  VALUES (v_indicacao.empresa_id)
  ON CONFLICT (empresa_id) DO NOTHING;

  SELECT * INTO v_config
  FROM public.programa_indicacao_config
  WHERE empresa_id = v_indicacao.empresa_id
  LIMIT 1;

  IF COALESCE(v_config.ativo, true) = false THEN
    RETURN NEW;
  END IF;

  v_expira_em := CURRENT_DATE + COALESCE(v_config.validade_credito_dias, 90);

  UPDATE public.cliente_indicacoes
  SET status = 'convertida',
      primeiro_pedido_id = NEW.id,
      valor_credito_indicador = COALESCE(v_config.valor_indicador, valor_credito_indicador, 10),
      valor_credito_indicado = COALESCE(v_config.valor_indicado, valor_credito_indicado, 10),
      convertido_em = now()
  WHERE id = v_indicacao.id;

  INSERT INTO public.cliente_creditos (empresa_id, cliente_id, indicacao_id, tipo, natureza, valor, descricao, expira_em, pedido_id)
  VALUES
    (v_indicacao.empresa_id, v_indicacao.indicador_cliente_id, v_indicacao.id, 'indicacao', 'credito', COALESCE(v_config.valor_indicador, 10), 'Crédito por indicação convertida', v_expira_em, NEW.id),
    (v_indicacao.empresa_id, v_indicacao.indicado_cliente_id, v_indicacao.id, 'indicacao', 'credito', COALESCE(v_config.valor_indicado, 10), 'Crédito de boas-vindas por indicação', v_expira_em, NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_converter_indicacao_primeiro_pedido_insert ON public.pedidos;
CREATE TRIGGER trg_converter_indicacao_primeiro_pedido_insert
AFTER INSERT ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.fn_converter_indicacao_primeiro_pedido();

DROP TRIGGER IF EXISTS trg_converter_indicacao_primeiro_pedido_update ON public.pedidos;
CREATE TRIGGER trg_converter_indicacao_primeiro_pedido_update
AFTER UPDATE OF status ON public.pedidos
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.fn_converter_indicacao_primeiro_pedido();

UPDATE public.clientes
SET codigo_indicacao = public.gerar_codigo_indicacao_cliente(id, nome)
WHERE codigo_indicacao IS NULL;

INSERT INTO public.programa_indicacao_config (empresa_id)
SELECT DISTINCT empresa_id
FROM public.clientes
WHERE empresa_id IS NOT NULL
ON CONFLICT (empresa_id) DO NOTHING;
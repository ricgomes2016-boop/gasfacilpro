-- Adiciona numeração sequencial por empresa nos pedidos
ALTER TABLE public.pedidos 
  ADD COLUMN IF NOT EXISTS numero_sequencial integer;

CREATE INDEX IF NOT EXISTS idx_pedidos_numero_sequencial_empresa 
  ON public.pedidos(unidade_id, numero_sequencial);

-- Função que atribui o próximo número por empresa (via unidade)
CREATE OR REPLACE FUNCTION public.fn_assign_numero_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id uuid;
  v_next integer;
BEGIN
  IF NEW.numero_sequencial IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Descobre a empresa via unidade
  IF NEW.unidade_id IS NOT NULL THEN
    SELECT empresa_id INTO v_empresa_id FROM public.unidades WHERE id = NEW.unidade_id;
  END IF;

  -- Calcula próximo número considerando todos os pedidos da mesma empresa
  SELECT COALESCE(MAX(p.numero_sequencial), 0) + 1
    INTO v_next
    FROM public.pedidos p
    LEFT JOIN public.unidades u ON u.id = p.unidade_id
    WHERE (v_empresa_id IS NULL AND p.unidade_id IS NULL)
       OR (v_empresa_id IS NOT NULL AND u.empresa_id = v_empresa_id);

  NEW.numero_sequencial := v_next;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_numero_pedido ON public.pedidos;
CREATE TRIGGER trg_assign_numero_pedido
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_assign_numero_pedido();

-- Backfill: atribui números sequenciais aos pedidos existentes (por empresa, ordem cronológica)
WITH ranked AS (
  SELECT 
    p.id,
    ROW_NUMBER() OVER (
      PARTITION BY u.empresa_id 
      ORDER BY p.created_at ASC, p.id ASC
    ) AS rn
  FROM public.pedidos p
  LEFT JOIN public.unidades u ON u.id = p.unidade_id
  WHERE p.numero_sequencial IS NULL
)
UPDATE public.pedidos p
SET numero_sequencial = r.rn
FROM ranked r
WHERE p.id = r.id;

-- RPC para buscar próximo número (preview)
CREATE OR REPLACE FUNCTION public.proximo_numero_pedido(_empresa_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(MAX(p.numero_sequencial), 0) + 1
  FROM public.pedidos p
  LEFT JOIN public.unidades u ON u.id = p.unidade_id
  WHERE u.empresa_id = _empresa_id;
$$;
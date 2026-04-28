CREATE OR REPLACE FUNCTION public.validar_alteracao_data_entrega_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.data_entrega IS DISTINCT FROM NEW.data_entrega THEN
    IF NOT (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    ) THEN
      RAISE EXCEPTION 'Apenas gestor ou gerente pode alterar a data da entrega do pedido.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_alteracao_data_entrega_pedido ON public.pedidos;

CREATE TRIGGER trg_validar_alteracao_data_entrega_pedido
BEFORE UPDATE OF data_entrega ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.validar_alteracao_data_entrega_pedido();
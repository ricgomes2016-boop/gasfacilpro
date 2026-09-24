-- O PDF assinado é uma cópia privada e imutável do termo aceito no celular.
ALTER TABLE public.comodatos
  ADD COLUMN assinatura_pdf_path text,
  ADD COLUMN assinatura_sha256 text,
  ADD COLUMN assinatura_nome text,
  ADD COLUMN assinatura_em timestamptz,
  ADD COLUMN assinatura_usuario_id uuid;

ALTER TABLE public.comodatos
  ADD CONSTRAINT comodatos_assinatura_completa CHECK (
    (assinatura_pdf_path IS NULL AND assinatura_sha256 IS NULL AND assinatura_nome IS NULL AND assinatura_em IS NULL AND assinatura_usuario_id IS NULL)
    OR (assinatura_pdf_path IS NOT NULL AND assinatura_sha256 ~ '^[0-9a-f]{64}$'
      AND length(trim(assinatura_nome)) >= 2 AND assinatura_em IS NOT NULL AND assinatura_usuario_id IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.fn_comodato_protege_assinatura()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.assinatura_pdf_path IS NOT NULL THEN
    IF ROW(NEW.assinatura_pdf_path, NEW.assinatura_sha256, NEW.assinatura_nome,
           NEW.assinatura_em, NEW.assinatura_usuario_id) IS DISTINCT FROM
       ROW(OLD.assinatura_pdf_path, OLD.assinatura_sha256, OLD.assinatura_nome,
           OLD.assinatura_em, OLD.assinatura_usuario_id) THEN
      RAISE EXCEPTION 'A assinatura registrada não pode ser alterada.';
    END IF;
    IF ROW(NEW.cliente_id, NEW.produto_id, NEW.quantidade, NEW.deposito,
           NEW.data_emprestimo, NEW.prazo_devolucao, NEW.modalidade,
           NEW.responsavel_entrega, NEW.documento_referencia, NEW.local_entrega,
           NEW.finalidade, NEW.observacoes, NEW.unidade_id) IS DISTINCT FROM
       ROW(OLD.cliente_id, OLD.produto_id, OLD.quantidade, OLD.deposito,
           OLD.data_emprestimo, OLD.prazo_devolucao, OLD.modalidade,
           OLD.responsavel_entrega, OLD.documento_referencia, OLD.local_entrega,
           OLD.finalidade, OLD.observacoes, OLD.unidade_id) THEN
      RAISE EXCEPTION 'Os dados do termo assinado não podem ser alterados.';
    END IF;
  ELSIF NEW.assinatura_pdf_path IS NOT NULL THEN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'É necessário estar autenticado para assinar.'; END IF;
    NEW.assinatura_em := now();
    NEW.assinatura_usuario_id := auth.uid();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trig_comodato_protege_assinatura ON public.comodatos;
CREATE TRIGGER trig_comodato_protege_assinatura BEFORE UPDATE ON public.comodatos
FOR EACH ROW EXECUTE FUNCTION public.fn_comodato_protege_assinatura();

-- As políticas permissivas preexistentes são combinadas com OR; esta é
-- restritiva para exigir isolamento por empresa em todas as operações.
CREATE POLICY comodatos_empresa_restritiva ON public.comodatos AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.unidade_belongs_to_user_empresa(unidade_id))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.unidade_belongs_to_user_empresa(unidade_id));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('comodato-termos', 'comodato-termos', false, 2097152, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY comodato_termos_leitura ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'comodato-termos'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  AND EXISTS (
    SELECT 1 FROM public.comodatos c JOIN public.unidades u ON u.id = c.unidade_id
    WHERE c.id::text = (storage.foldername(name))[2]
      AND u.empresa_id = public.get_user_empresa_id()
  )
  AND (public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'operacional'::public.app_role))
);

CREATE POLICY comodato_termos_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'comodato-termos'
  AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  AND EXISTS (
    SELECT 1 FROM public.comodatos c JOIN public.unidades u ON u.id = c.unidade_id
    WHERE c.id::text = (storage.foldername(name))[2]
      AND u.empresa_id = public.get_user_empresa_id()
      AND c.assinatura_pdf_path IS NULL
  )
  AND (public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR public.has_role(auth.uid(), 'operacional'::public.app_role))
);

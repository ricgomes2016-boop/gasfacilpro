DROP POLICY IF EXISTS tenant_isolation_documentos_contabeis ON public.documentos_contabeis;
CREATE POLICY tenant_isolation_documentos_contabeis ON public.documentos_contabeis
AS RESTRICTIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR unidade_belongs_to_user_empresa(unidade_id))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR unidade_belongs_to_user_empresa(unidade_id));

DROP POLICY IF EXISTS tenant_isolation_documentos_empresa ON public.documentos_empresa;
CREATE POLICY tenant_isolation_documentos_empresa ON public.documentos_empresa
AS RESTRICTIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR unidade_belongs_to_user_empresa(unidade_id))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR unidade_belongs_to_user_empresa(unidade_id));

DROP POLICY IF EXISTS tenant_isolation_folhas_pagamento ON public.folhas_pagamento;
CREATE POLICY tenant_isolation_folhas_pagamento ON public.folhas_pagamento
AS RESTRICTIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR unidade_belongs_to_user_empresa(unidade_id))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR unidade_belongs_to_user_empresa(unidade_id));
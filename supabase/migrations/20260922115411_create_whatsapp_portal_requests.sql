CREATE TABLE IF NOT EXISTS public.whatsapp_portal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce text NOT NULL UNIQUE,
  idempotency_key text,
  action text NOT NULL,
  response jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wpr_idempotency_key
  ON public.whatsapp_portal_requests (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wpr_expires_at
  ON public.whatsapp_portal_requests (expires_at);

ALTER TABLE public.whatsapp_portal_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.whatsapp_portal_requests FROM anon, authenticated;
GRANT ALL ON public.whatsapp_portal_requests TO service_role;

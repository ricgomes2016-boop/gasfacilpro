ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS fcm_token text;

ALTER TABLE public.push_subscriptions
  ALTER COLUMN endpoint DROP NOT NULL,
  ALTER COLUMN p256dh DROP NOT NULL,
  ALTER COLUMN auth DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_fcm_token_key
  ON public.push_subscriptions(fcm_token) WHERE fcm_token IS NOT NULL;
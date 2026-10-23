import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const conferenciaAuth = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { storageKey: 'gasfacil-conferencia-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export async function conferenciaApi(body: Record<string, unknown>, management = false) {
  const client = management ? supabase : conferenciaAuth;
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error('Entre para continuar.');
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estoque-conferencia-portal`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || 'Serviço indisponível.');
  return data;
}
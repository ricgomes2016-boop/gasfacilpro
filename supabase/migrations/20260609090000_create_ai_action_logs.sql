-- Auditoria das ações executadas pelo Assistente IA.
create table if not exists public.ai_action_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  empresa_id uuid references public.empresas(id) on delete set null,
  unidade_id uuid references public.unidades(id) on delete set null,
  action text not null,
  params jsonb not null default '{}'::jsonb,
  result text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_action_logs_user_id on public.ai_action_logs(user_id);
create index if not exists idx_ai_action_logs_empresa_id on public.ai_action_logs(empresa_id);
create index if not exists idx_ai_action_logs_unidade_id on public.ai_action_logs(unidade_id);
create index if not exists idx_ai_action_logs_created_at on public.ai_action_logs(created_at desc);

alter table public.ai_action_logs enable row level security;

drop policy if exists "Admins can view AI action logs from own company" on public.ai_action_logs;
create policy "Admins can view AI action logs from own company"
on public.ai_action_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.empresa_id = ai_action_logs.empresa_id
  )
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'gestor', 'super_admin')
  )
);

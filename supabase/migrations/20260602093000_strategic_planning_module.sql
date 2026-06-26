create table if not exists public.strategic_targets (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,
  product_scope text not null default 'Todos',
  period_type text not null default 'mensal',
  period_start date not null,
  period_end date not null,
  quantity_goal numeric not null default 0,
  revenue_goal numeric not null default 0,
  profit_goal numeric not null default 0,
  desired_ticket numeric not null default 0,
  status text not null default 'ativa',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategic_financial_plans (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,
  period_start date not null,
  period_end date not null,
  expected_revenue numeric not null default 0,
  product_cost numeric not null default 0,
  payroll_cost numeric not null default 0,
  commission_cost numeric not null default 0,
  fuel_cost numeric not null default 0,
  maintenance_cost numeric not null default 0,
  rent_cost numeric not null default 0,
  tax_cost numeric not null default 0,
  debt_cost numeric not null default 0,
  investment_cost numeric not null default 0,
  expected_profit numeric generated always as (
    expected_revenue - product_cost - payroll_cost - commission_cost - fuel_cost - maintenance_cost - rent_cost - tax_cost - debt_cost - investment_cost
  ) stored,
  status text not null default 'ativa',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategic_stock_plans (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,
  product_scope text not null default 'Todos',
  current_stock numeric not null default 0,
  minimum_stock numeric not null default 0,
  ideal_stock numeric not null default 0,
  daily_average_sales numeric not null default 0,
  coverage_days numeric not null default 0,
  shortage_forecast_date date,
  purchase_suggestion numeric not null default 0,
  transfer_suggestion text,
  status text not null default 'ativa',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategic_team_plans (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,
  period_start date not null,
  period_end date not null,
  peak_hours text,
  expected_orders numeric not null default 0,
  active_drivers numeric not null default 0,
  active_attendants numeric not null default 0,
  recommended_drivers numeric not null default 0,
  recommended_attendants numeric not null default 0,
  recommendation text,
  status text not null default 'ativa',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategic_projects (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,
  name text not null,
  investment_estimated numeric not null default 0,
  expected_return numeric not null default 0,
  payback_months numeric not null default 0,
  revenue_impact numeric not null default 0,
  profit_impact numeric not null default 0,
  risk_score numeric not null default 1,
  urgency_score numeric not null default 1,
  priority_score numeric not null default 0,
  status text not null default 'em_andamento',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategic_swot (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,
  quadrant text not null,
  description text not null,
  impact text not null default 'medio',
  recommended_action text,
  owner_name text,
  due_date date,
  status text not null default 'pendente',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategic_action_plans (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,
  title text not null,
  what text not null,
  why text,
  who text,
  when_date date,
  where_place text,
  how text,
  cost numeric not null default 0,
  priority text not null default 'media',
  status text not null default 'pendente',
  linked_type text,
  linked_id uuid,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategic_alerts (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,
  alert_type text not null,
  title text not null,
  description text,
  severity text not null default 'media',
  status text not null default 'aberto',
  source_table text,
  source_id uuid,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategic_recommendations (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,
  title text not null,
  description text not null,
  recommendation_type text not null default 'regra',
  priority text not null default 'media',
  status text not null default 'pendente',
  source_alert_id uuid references public.strategic_alerts(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_strategic_targets_empresa on public.strategic_targets(empresa_id, unidade_id, status);
create index if not exists idx_strategic_projects_empresa on public.strategic_projects(empresa_id, unidade_id, status);
create index if not exists idx_strategic_swot_empresa on public.strategic_swot(empresa_id, unidade_id, quadrant);
create index if not exists idx_strategic_action_plans_empresa on public.strategic_action_plans(empresa_id, unidade_id, status);
create index if not exists idx_strategic_alerts_empresa on public.strategic_alerts(empresa_id, unidade_id, severity, status);
create index if not exists idx_strategic_recommendations_empresa on public.strategic_recommendations(empresa_id, unidade_id, status);

alter table public.strategic_targets enable row level security;
alter table public.strategic_financial_plans enable row level security;
alter table public.strategic_stock_plans enable row level security;
alter table public.strategic_team_plans enable row level security;
alter table public.strategic_projects enable row level security;
alter table public.strategic_swot enable row level security;
alter table public.strategic_action_plans enable row level security;
alter table public.strategic_alerts enable row level security;
alter table public.strategic_recommendations enable row level security;

create or replace function public.user_can_manage_empresa(_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.empresa_id = _empresa_id
  )
  and (
    public.has_role(auth.uid(), 'admin'::app_role)
    or public.has_role(auth.uid(), 'gestor'::app_role)
    or public.has_role(auth.uid(), 'financeiro'::app_role)
    or public.has_role(auth.uid(), 'operacional'::app_role)
  );
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'strategic_targets',
    'strategic_financial_plans',
    'strategic_stock_plans',
    'strategic_team_plans',
    'strategic_projects',
    'strategic_swot',
    'strategic_action_plans',
    'strategic_alerts',
    'strategic_recommendations'
  ]
  loop
    execute format('drop policy if exists "%1$s empresa access" on public.%1$I', table_name);
    execute format('create policy "%1$s empresa access" on public.%1$I for all using (public.user_can_manage_empresa(empresa_id)) with check (public.user_can_manage_empresa(empresa_id))', table_name);
    execute format('drop trigger if exists update_%1$s_updated_at on public.%1$I', table_name);
    execute format('create trigger update_%1$s_updated_at before update on public.%1$I for each row execute function public.update_updated_at_column()', table_name);
  end loop;
end $$;

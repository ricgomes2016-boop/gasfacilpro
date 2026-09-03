-- Auditoria e idempotencia da emissao temporaria pelo Vender Gas.
-- A senha/sessao do fornecedor permanece exclusivamente no Agente Fiscal Local.
alter table public.notas_fiscais
  add column if not exists pedido_id uuid references public.pedidos(id) on delete set null,
  add column if not exists provedor text,
  add column if not exists provedor_status text,
  add column if not exists provedor_referencia text,
  add column if not exists integracao_payload jsonb,
  add column if not exists integracao_resultado jsonb;

create index if not exists idx_notas_fiscais_pedido_id
  on public.notas_fiscais(pedido_id);

create unique index if not exists uq_notas_fiscais_vendergas_pedido
  on public.notas_fiscais(pedido_id)
  where provedor = 'vendergas' and pedido_id is not null and status <> 'cancelada';

comment on column public.notas_fiscais.provedor is
  'Provedor responsavel pela transmissao (focus_nfe, vendergas ou manual).';
comment on column public.notas_fiscais.integracao_payload is
  'Snapshot fiscal do pedido, sem credenciais, para auditoria e reprocessamento seguro.';

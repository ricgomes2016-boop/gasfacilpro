-- Um mesmo pedido pode possuir uma NF-e (modelo 55) e uma NFC-e (modelo 65),
-- mas nunca duas emissões ativas do mesmo modelo pelo Vender Gás.
drop index if exists public.uq_notas_fiscais_vendergas_pedido;

create unique index uq_notas_fiscais_vendergas_pedido_tipo
  on public.notas_fiscais(pedido_id, tipo)
  where provedor = 'vendergas'
    and pedido_id is not null
    and tipo in ('nfe', 'nfce')
    and status <> 'cancelada';

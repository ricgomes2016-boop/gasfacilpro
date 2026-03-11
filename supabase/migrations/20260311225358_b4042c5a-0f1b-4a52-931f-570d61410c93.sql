-- Padronizar nomes de produtos não-padrão
UPDATE public.produtos SET nome = 'Gás P13' WHERE id = 'ac2682cf-e23e-42d7-b562-ba543d099f1b';
UPDATE public.produtos SET nome = 'Gás P13 Vazio' WHERE id = '2eb6b4db-810c-4176-afa0-a0acbb4ebaae';

-- Padronizar nomes com "(Vazio)" para "Vazio" sem parênteses (consistência)
UPDATE public.produtos SET nome = REPLACE(nome, ' (Vazio)', ' Vazio') WHERE nome LIKE '% (Vazio)' AND ativo = true;
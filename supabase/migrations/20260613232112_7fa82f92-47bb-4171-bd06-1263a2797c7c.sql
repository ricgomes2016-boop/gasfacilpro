
DROP POLICY IF EXISTS bolao_palpites_insert ON public.bolao_palpites;
DROP POLICY IF EXISTS bolao_palpites_update ON public.bolao_palpites;

CREATE POLICY bolao_palpites_insert ON public.bolao_palpites
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND unidade_belongs_to_user_empresa(unidade_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.bolao_jogos j
    WHERE j.id = bolao_palpites.jogo_id
      AND (
        j.finalizado = true
        OR (
          j.data_jogo <= now()
          AND NOT (
            (j.codigo_casa = 'BRA' OR j.codigo_fora = 'BRA')
            AND (j.data_jogo AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
          )
        )
      )
  )
);

CREATE POLICY bolao_palpites_update ON public.bolao_palpites
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.bolao_jogos j
    WHERE j.id = bolao_palpites.jogo_id
      AND (
        j.finalizado = true
        OR (
          j.data_jogo <= now()
          AND NOT (
            (j.codigo_casa = 'BRA' OR j.codigo_fora = 'BRA')
            AND (j.data_jogo AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
          )
        )
      )
  )
);

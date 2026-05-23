## Objetivo

Aplicar a correção de débito bancário às **10 contas já pagas** da unidade **Central Gas** que foram marcadas como pagas antes do novo fluxo existir (todas sem `conta_bancaria_id` e sem movimentação bancária), debitando o valor da conta **Sisprime Cooperativa**.

## Escopo

Unidade: Central Gas (`aa5b7c93-4fe6-4dba-a0b5-2af43cd20614`)
Conta destino do débito: **Sisprime** (`b073d858-e3ff-4227-bc75-28611f32b41b`) — saldo atual R$ 157.544,70
Total a debitar: **R$ 273.077,95** em 10 lançamentos.

Contas afetadas (id / descrição / valor):

- 87e86989 — Acerto Combustível AUTO POSTO CENTRO — R$ 714,55
- 7dbbb060 — Compra NF 1603 Nacional Gas — R$ 47.412,00
- c79b808d — Reaviso água/esgoto 01/2026 — R$ 27,26
- 5d76ded8 — Compra NF 12 Nacional Gas — R$ 51.437,04
- 188a9d2a — Acerto Combustível AUTO POSTO PANORAMA — R$ 2.413,12
- e68e67cd — Conta água/esgoto 02/2026 — R$ 208,09
- 11b87dfb — Compra NF S/N Nacional Gas — R$ 47.412,00
- 3a26c207 — Compra NF S/N Nacional Gas — R$ 48.924,00
- 486b98c0 — Fatura Claro — R$ 450,30
- 798ee803 — Compra NF S/N Nacional Gas — R$ 74.079,59

> Atenção: após o débito, o saldo do **Sisprime ficaria negativo** (157.544,70 − 273.077,95 = **−115.533,25**). Confirme se é isso mesmo ou se parte das contas saiu de outra conta (Itaú, Pagbank, Caixa da Empresa).

## Execução (script único, transacional)

Para cada uma das 10 contas:

1. Inserir linha em `movimentacoes_bancarias`:
   - `conta_bancaria_id = Sisprime`
   - `tipo = 'saida'`, `valor = -<valor>` (sinal coerente com o restante da base)
   - `data = COALESCE(data_pagamento, created_at::date)`
   - `categoria = 'Pagamento de Conta'`
   - `descricao = 'Pagamento retroativo - ' || descricao_conta`
   - `origem = 'contas_pagar'`, `referencia_id = <id da conta>`, `referencia_tipo = 'contas_pagar'`
   - `unidade_id = Central Gas`
   - `saldo_apos` calculado em cadeia (saldo Sisprime atual menos somatório acumulado).
2. Atualizar `contas_pagar`:
   - `conta_bancaria_id = Sisprime`
   - `forma_pagamento = 'pix'` (forma padrão para saída de banco; ajustável)
   - `data_pagamento = COALESCE(data_pagamento, created_at::date)` quando nulo
   - `observacoes` recebe nota: "Origem do pagamento ajustada retroativamente para Sisprime em 2026-05-23".
3. Atualizar `contas_bancarias.saldo_atual` do Sisprime: `saldo_atual − 273.077,95`.

Tudo dentro de uma única transação via `supabase--insert` (BEGIN/COMMIT implícito do statement único com CTEs) para garantir consistência. Não cria migração — é correção de dados.

## Critérios de aceite

- Sisprime mostra 10 novas saídas no extrato (Caixa do Dia › Tesouraria e tela de Contas Bancárias).
- `saldo_atual` do Sisprime reduz exatamente em R$ 273.077,95.
- As 10 contas em Contas a Pagar passam a exibir "Pago via Sisprime" e ficam vinculadas (`conta_bancaria_id` preenchido).
- Nenhuma outra unidade é afetada.

## Fora de escopo

- Demais unidades (Temgas etc.).
- Contas pagas que já tenham `conta_bancaria_id` definido (não serão tocadas).
- Estorno/rollback automático (caso necessário, será feito manualmente).

## Pergunta antes de executar

O saldo do Sisprime hoje (R$ 157.544,70) não cobre os R$ 273.077,95. Quero confirmar:

1. **Debitar tudo no Sisprime mesmo** (saldo ficará negativo, refletindo a realidade contábil)?
2. Ou **dividir** algumas contas em outras contas (Itaú, Pagbank, Caixa da Empresa)?
3. Ou **ajustar primeiro o saldo inicial** do Sisprime para refletir o saldo bancário real antes do débito?

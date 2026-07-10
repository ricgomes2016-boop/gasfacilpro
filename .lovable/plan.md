## Padrão financeiro unificado — Operadoras, D+N automático e Contas a Receber

### Regra única (fonte de verdade)

| Forma de pagamento | Destino imediato | Baixa/compensação |
|---|---|---|
| Dinheiro | `movimentacoes_caixa` (caixa da empresa) | já entra como entrada |
| PIX puro (chave da loja) | `movimentacoes_bancarias` na conta PIX | imediata |
| Cartão Crédito / Débito / PIX Maquininha | `contas_receber` da **operadora** com `prazo` e `conta_bancaria_destino_id` da operadora | **D+0 → já nasce `recebido` + crédito no banco**  •  D+1/D+2/D+30 → cron diário faz baixa + transferência automática no dia do vencimento |
| Gás do Povo | `contas_receber` operadora "azulzinha", vencimento D+2, destino = banco Caixa Econômica configurado na operadora | cron compensa em D+2 direto no banco Caixa |
| Vale Gás | segue como hoje (banco vale gás) | inalterado |
| Fiado / Boleto | `contas_receber` do cliente | manual (real recebível) |

**Contas a Receber (tela)**: passa a mostrar tudo, mas cartão/pix-maq/gás-do-povo aparecem já com `status='recebido'` assim que o cron do dia rodar. Só permanecem `pendente` os fiados.

**Conciliação Cartão**: deixa de ser obrigatória. Vira tela de **conferência por operadora** — comparar extrato bancário da operadora × soma de `contas_receber` por operadora/período. Sem lançamentos manuais obrigatórios.

---

### Mudanças

#### 1. `src/services/paymentRoutingService.ts`
No `case cartao_debito/credito/pix_maquininha` e no `case gas_do_povo`:
- Calcular `prazo` da operadora (já existe).
- Resolver `contaDestino` (já existe).
- **Se `prazo === 0` e `contaDestino` existir**: inserir `contas_receber` já com `status='recebido'`, `data_recebimento=hoje`, e chamar `criarMovimentacaoBancaria` na `contaDestino` no mesmo passo (categoria `"venda_cartao"` / `"gas_do_povo"`).
- Se `prazo > 0`: mantém `pendente` com `vencimento = hoje + prazo` e `conta_bancaria_destino_id` preenchido (cron liquida depois).
- Remove a inserção obrigatória em `conferencia_cartao` no fluxo Gás do Povo — passa a ser opcional (só se o usuário registrar conferência manual).

#### 2. Nova edge function `supabase/functions/liquidar-recebiveis-cartao/index.ts`
Roda diariamente (pg_cron 06:00 BRT). Para cada `contas_receber` com:
- `status = 'pendente'`
- `forma_pagamento IN ('cartao_credito','cartao_debito','pix_maquininha','gas_do_povo')`
- `vencimento <= CURRENT_DATE`
- `conta_bancaria_destino_id IS NOT NULL`

Faz em transação:
1. `UPDATE contas_receber SET status='recebido', data_recebimento=vencimento`
2. Insere `movimentacoes_bancarias` (entrada, valor = `valor_liquido`, categoria `liquidacao_operadora`, referencia_id=id do recebível) na `conta_bancaria_destino_id`.
3. Atualiza `saldo_atual` da conta bancária.
4. Idempotência via `referencia_id + categoria` (não duplica se rodar 2x).

#### 3. Agendar cron (via `supabase--insert`, não migration)
`pg_cron` diário chamando a edge function com anon key.

#### 4. UI — Contas a Receber (`src/pages/financeiro/ContasReceber.tsx` e afins)
- Não filtrar fora cartão/pix-maq — mostrar todos.
- Adicionar badge/coluna "Auto D+N" com data prevista quando ainda pendente.
- Fiados continuam com ação manual "Dar baixa".

#### 5. UI — Conciliação Cartão (`src/pages/financeiro/ConciliacaoCartao.tsx`)
- Renomear card superior para "**Conferência por operadora (opcional)**".
- Aviso: "As baixas são automáticas conforme prazo D+N da operadora. Esta tela serve apenas para comparar com o extrato do banco."
- Manter form de conferência manual, mas sem afetar `contas_receber`.

#### 6. Retrocompatibilidade — backfill leve
Script de correção via `supabase--insert` (uma vez): para recebíveis já existentes com `forma_pagamento` de cartão/pix-maq/gás-do-povo cujo `vencimento <= hoje` e `status='pendente'` e `conta_bancaria_destino_id` presente, roda a mesma lógica de liquidação. Não mexe nos sem conta destino.

---

### Fora do escopo
- Não altera schema (usa colunas já existentes: `conta_bancaria_destino_id`, `valor_liquido`, `data_recebimento`, `status`).
- Não altera Vale Gás.
- Não altera fluxo de fiado/boleto.
- PagBank continua sendo cadastrado como operadora com `prazo=0` e `conta_bancaria_id` = conta PagBank; passa a liquidar direto no ato da venda.

### Validação
1. Cadastrar operadora PagBank prazo=0 na Forte Gás → nova venda cartão débito → recebível nasce `recebido` + saldo PagBank sobe imediatamente.
2. Venda Gás do Povo hoje → recebível pendente vencimento D+2 → esperar cron D+2 (ou rodar manual) → status vira `recebido` e Caixa Econômica é creditada.
3. Contas a Receber deve listar as 89 vendas de cartão da Forte Gás como `recebido` após backfill.
4. Conciliação Cartão fica opcional e não bloqueia nada.
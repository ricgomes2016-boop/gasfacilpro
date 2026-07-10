## Diagnóstico da Gestão Financeira — Forte Gás

Rodei consultas na base para entender o que realmente aconteceu. Resumo do que encontrei nos últimos 30 / 90 dias na Forte Gás:

| Fonte | Qtd | Observação |
|---|---|---|
| Pedidos (30d) | 133 | fluxo normal |
| Contas a receber (30d) | 71 | inclui 12 crédito, 10 débito, 4 pix maquininha, 8 pix, 25 transferência, 2 fiado, 2 gás do povo |
| Movimentações bancárias (30d) | 75 | R$ 3.7k categoria "venda" + R$ 26.4k "recebimento_fiado" |
| Movimentações de caixa (30d) | 71 | dinheiro/cheque OK |
| Compras (90d) | 12 · R$ 24.6k | R$ 15.4k marcadas como pagas |
| Contas a pagar | 11 · R$ 66.7k | **0 pagas** |

Ou seja, **os dados existem** — o problema está em **como o sistema roteia e apresenta**. Encontrei 3 defeitos reais + oportunidades de clareza para o gestor.

### Diagnóstico técnico

**1. Cartão / PIX-maquininha não aparecem em "Contas Bancárias" — não é bug, é falta de visibilidade**
`paymentRoutingService.rotearPagamentosVenda` está correto: cartão (D+1/D+30) e PIX-maquininha (D+1) vão para `contas_receber` com `conta_bancaria_destino_id`. Só viram `movimentacoes_bancarias` quando o recebível é liquidado. Hoje a Forte Gás tem R$ 3.187 em cartão/pix-maq **a receber**, nenhum liquidado ainda → por isso não aparecem em "banco". Falta um card "A receber por banco / operadora" no Dashboard Financeiro e um botão de **liquidação automática** (assumir depósito no vencimento). PIX comum já cai direto no banco (20 mov = R$ 3.722) ✅.

**2. DRE não mostra compras (CMV) — bug real**
`src/pages/operacional/DRE.tsx` (linhas 60-83) só lê `movimentacoes_bancarias` (saída) e `contas_pagar` com `status='pago'`. Como 11 contas a pagar estão pendentes e as compras não são liquidadas via banco, o CMV fica zero. Precisa ler diretamente `compras` (por `data_compra`), classificando gás/água como CMV.

**3. GestaoRotas não mostra custo/despesa nenhuma — bug real**
`src/pages/operacional/GestaoRotas.tsx` não tem qualquer referência a `compras`, `contas_pagar`, `despesa` ou `custo`. Só receita por rota. Precisa juntar despesas do dia (combustível, comissão, manutenção) e custo médio dos produtos entregues para calcular **margem líquida por rota**.

**4. Formas de pagamento com rótulo bruto no `forma_pagamento`**
14 recibos gravados com strings tipo `"PIX: R$ 105.00"`, `"Cartão: R$ 100.00"`, `"Crédito (Itau): R$ 315.00"`, `"Transferência: R$ 101.08"`. Isso vem do fluxo de importação/legado — corrompe agrupamentos e relatórios. Precisa normalização.

---

### Plano de correção

**Fase 1 — Corrigir DRE (CMV + Despesas)** · `src/pages/operacional/DRE.tsx`
- Adicionar 4ª query lendo `compras` por `data_compra` no mês, classificando por produto/categoria (gás, água → CMV; frete/impostos → despesa operacional).
- Trocar `contas_pagar.status='pago'` (que quase nunca é atualizado) por `contas_pagar` filtrado por `vencimento` no mês independente de status, com toggle "Regime: caixa | competência" no topo.
- Somar `despesas_contabeis` (tabela existe, não está sendo lida).
- Adicionar linha "Compras não pagas (comprometido)" com aviso visual.

**Fase 2 — Margem por Rota** · `src/pages/operacional/GestaoRotas.tsx`
- Para cada rota: buscar `abastecimentos` do veículo do dia, `contas_pagar` categoria "comissão"/"despesa_rota" do entregador, e custo médio dos produtos entregues (`pedido_itens` × `produtos.preco_custo`).
- Colunas novas: Receita · Custo Produto · Despesas · **Margem Líquida** · % Margem.
- Card resumo no topo com totais consolidados.

**Fase 3 — Visibilidade bancária para cartão/PIX-maq** · `src/pages/financeiro/DashboardFinanceiro.tsx` + nova aba em `ContasBancarias.tsx`
- Card "Recebíveis por banco" agrupando `contas_receber` pendentes por `conta_bancaria_destino_id` e vencimento (hoje / D+7 / D+30).
- Card "Recebíveis por operadora" com taxa média e prazo.
- Botão "Liquidar recebíveis do dia" que percorre `contas_receber` com `vencimento <= hoje` e status=pendente, cria `movimentacoes_bancarias` líquidas (valor − taxa) na conta destino e marca como recebidas. Idempotente.

**Fase 4 — Sanitizar formas de pagamento legadas** · migration
- UPDATE `contas_receber` normalizando `forma_pagamento` que casa com regex `^(PIX|Cartão|Crédito|Débito|Dinheiro|Transferência)` para o slug correto (`pix`, `cartao_credito`, etc.), preservando o valor no campo `descricao`.

**Fase 5 — Painel gestor unificado** · novo componente no `DashboardFinanceiro.tsx`
Bloco "Saúde Financeira" com 6 KPIs coloridos: Receita 30d · CMV 30d · Margem Bruta % · A Receber (banco) · A Pagar (vencendo 7d) · Saldo consolidado. Cada KPI clicável levando à tela detalhada.

### Detalhes técnicos

- Todas as queries respeitam `unidade_id` do contexto (isolamento multi-tenant já existente).
- Nenhuma alteração em `App.tsx`, providers ou rotas.
- Nenhuma migração de schema — apenas 1 migration de **data cleanup** (Fase 4) usando `supabase--insert`.
- Liquidação automática de recebíveis reaproveita `criarMovimentacaoBancaria` do `paymentRoutingService` (já idempotente).
- Categorização CMV usa `produtos.categoria in ('gas','agua','vasilhame')`.

### Fora de escopo (proposta para depois)
- Regime de competência completo com rateio mensal de despesas anuais.
- Conciliação bancária automática via OFX/Open Finance por conta (já existe em `Conciliacao.tsx`, só precisa ligar aos recebíveis novos).
- DRE gerencial vs contábil (dois modos).

Confirma que posso implementar todas as 5 fases, ou prefere que eu comece só pelas fases 1 + 2 (DRE + Rotas, que são os bugs reais que você citou)?
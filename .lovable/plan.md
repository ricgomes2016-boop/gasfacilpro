## Objetivo

Deixar o módulo Financeiro no nível "premium":

1. Liquidar/Receber em Contas a Receber deve reaproveitar o **fluxo completo de pagamento** já usado em Nova Venda (seleção de operadora + terminal + parcelas para cartão, seleção de chave PIX + conta bancária, seleção de banco para transferência etc.).
2. Contas geradas por vendas em **cartão crédito, cartão débito, PIX e PIX maquininha** devem nascer **já liquidadas** em Contas a Receber (não ficam "pendentes"). Somente **Fiado** (e Vale Gás) continuam pendentes e, ao serem quitados depois, seguem o mesmo fluxo completo de pagamento — inclusive podendo ser pagos em cartão/PIX/dinheiro, exatamente como no lançamento de pedido.
3. Análise + melhorias finas em Contas a Pagar, Fluxo de Caixa e Dashboard Financeiro para acompanhar o novo modelo.

## Diagnóstico atual

- `ContasReceber.tsx` já roteia dinheiro → caixa e PIX/cartão → conta bancária via `paymentRoutingService`, mas o modal "Liquidar / Receber" é um formulário minimalista (só forma + valor). Não abre a seleção de operadora, terminal, parcelas nem chave PIX.
- `isFormaAVista()` em `src/lib/financeiro/formaPagamento.ts` trata **apenas dinheiro e PIX puro** como à vista. Cartão débito, cartão crédito e PIX maquininha são classificados como `a_prazo` e ficam pendentes em Contas a Receber (comentário atual: "recebível do adquirente D+1/D+30, tratado na Conciliação Cartão").
- Já existem `CardOperatorSelectorModal.tsx` e `PixKeySelectorModal.tsx` (usados em `PaymentSection`, `PDVPayment`, `FinalizarEntrega`, `AcertoEntregador`). Reaproveitáveis.
- Fluxo de Caixa (`FluxoCaixa.tsx`, `FluxoCaixaConsolidado.tsx`, `FluxoCaixaProjetado.tsx`) e Dashboard Financeiro consomem `contas_receber` + `contas_pagar` + `movimentacoes_*`. Precisam refletir o novo comportamento.

## Escopo das mudanças

### 1. Contas a Receber — liquidar como no Nova Venda

Novo componente `src/components/financeiro/LiquidarRecebivelModal.tsx` (ou refator do dialog existente):

- Cabeçalho compacto: cliente, descrição, valor a receber, dias em aberto.
- Data do recebimento (default hoje, min = data da venda, max = hoje) — igual hoje.
- Lista de "Formas de pagamento" (multi‑forma, mantendo divisão parcial). Para cada linha:
  - **Dinheiro** → nada extra (vai para caixa da loja da sessão aberta).
  - **PIX** → abre `PixKeySelectorModal` para escolher chave/banco. Guarda `conta_bancaria_id` e `chave_pix` no lançamento.
  - **PIX Maquininha** → abre `CardOperatorSelectorModal` (operadora + terminal), grava `operadora_id`, `terminal_id`, `valor_liquido`, `taxa`, `prazo`. Cria recebível de cartão em `pagamentos_cartao` (mesma pipeline do PDV/Nova Venda) e baixa a linha em Contas a Receber já como recebida.
  - **Cartão Débito / Cartão Crédito** → `CardOperatorSelectorModal` com campo Parcelas (só para crédito). Também cria `pagamentos_cartao` + parcelas em `fatura_cartao_itens`, marca Contas a Receber como recebida.
  - **Transferência/TED** → seleção de conta bancária de destino.
  - **Boleto pago** → seleção de conta bancária.
  - **Cheque** → conta bancária + nº cheque + bom‑para → grava em `cheques`.
- Painel resumo: total pago, restante (parcial), destino de cada linha.
- Botão "Confirmar Recebimento" chama um novo serviço `liquidarRecebivelService.liquidar(contaId, linhas[])` que centraliza:
  - `movimentacoes_caixa` (dinheiro)
  - `movimentacoes_bancarias` via `criarMovimentacaoBancaria` (PIX/TED/boleto/cheque)
  - `pagamentos_cartao` + itens de fatura (cartão + PIX maquininha)
  - `cheques` (cheque)
  - Atualiza `contas_receber` para `recebida` com `forma_pagamento` composta, `data_recebimento`, `conta_bancaria_destino_id`.
- Bulk "Liquidar em lote" ganha o mesmo seletor de destino (operadora/banco/chave) — uma vez, aplicado a todas.

### 2. Regra "cartão/PIX já nasce liquidado" em Contas a Receber

- `getFormaGrupo()`/`isFormaAVista()` em `src/lib/financeiro/formaPagamento.ts`: passar `cartao_debito`, `cartao_credito`, `pix_maquininha` para `a_vista`. Fiado, Vale Gás, Boleto e Cheque continuam `a_prazo`.
- Efeitos:
  - Pedidos pagos em cartão/PIX/dinheiro → `contas_receber` já é inserida com `status = 'recebida'` e `data_recebimento = data_venda` (o `handleSubmit` de `ContasReceber` e os pontos onde o Nova Venda cria a conta já usam essa flag — só precisamos ajustar a lista e revisar `hooks/usePedidos` para não duplicar).
  - Cartão continua alimentando `pagamentos_cartao` (D+1/D+30) — a "Conciliação de Cartão" fica sendo a visão do recebível do adquirente; **Contas a Receber** vira só a visão do cliente. Isso remove o double‑pending confuso.
- Somente **Fiado**, **Vale Gás**, **Boleto**, **Cheque** aparecem em "A Receber". Ao liquidar Fiado no novo modal, o cliente pode escolher qualquer forma (cartão etc.), gerando os mesmos side‑effects do pedido — exatamente o que o usuário pediu.
- Filtro/UI: renomear a aba padrão para "Pendentes (Fiado, Vale, Boleto, Cheque)" e manter aba "Recebidas" mostrando os liquidados históricos (inclusive os que já nascem recebidos).

### 3. Análise + polimento premium

**Contas a Pagar (`ContasPagar.tsx`)**

- Padronizar o mesmo modal "Liquidar" (escolher origem: caixa da loja / conta bancária) reaproveitando o `compraFinanceiroService` recém-criado.
- Adicionar coluna de status "Programada / Vencida / Paga" com semáforo e agrupamento por vencimento.
- Suporte a pagamento parcial (paridade com Contas a Receber).

**Fluxo de Caixa (`FluxoCaixa.tsx` + Consolidado + Projetado)**

- Considerar que cartão/PIX vira caixa efetivo pela data de liquidação do adquirente (usar `pagamentos_cartao.data_liquidacao`), não pela data do pedido.
- Fiado projetado: usar `data_vencimento` do `contas_receber` para o Projetado.
- Dashboard consolidado: KPIs "Entradas confirmadas hoje", "A receber (fiado+vale)", "A vencer 7d/30d", "Recebíveis de cartão em D+X", "Saldo bancário líquido projetado".

**Dashboard Financeiro (`DashboardFinanceiro.tsx`)**

- Cards: Saldo Consolidado (caixa + bancos), Entradas do dia, Saídas do dia, Recebíveis do cartão em pipeline, Inadimplência fiado (>30d, >60d, >90d), Ticket médio de recebimento.
- Gráfico de barras entradas × saídas dos últimos 30 dias.
- Alertas: contas vencendo em 3 dias, sessão de caixa aberta há mais de X horas, chave PIX sem conta vinculada, operadora sem taxa cadastrada.

## Arquivos afetados

- `src/lib/financeiro/formaPagamento.ts` — reclassificar cartões e PIX maquininha como à vista.
- `src/pages/financeiro/ContasReceber.tsx` — substituir o dialog "Liquidar / Receber" pelo novo componente; ajustar filtros padrão e mensagens.
- **Novo** `src/components/financeiro/LiquidarRecebivelModal.tsx` — modal completo, multi-forma, com selects de operadora/PIX/banco.
- **Novo** `src/services/liquidarRecebivelService.ts` — centraliza os side-effects (`movimentacoes_caixa`, `movimentacoes_bancarias`, `pagamentos_cartao`, `cheques`, update em `contas_receber`).
- `src/pages/financeiro/ContasPagar.tsx` — modal de liquidação com escolha caixa/banco (reuso do padrão de Compras).
- `src/pages/financeiro/FluxoCaixa.tsx`, `FluxoCaixaConsolidado.tsx`, `FluxoCaixaProjetado.tsx` — usar `pagamentos_cartao.data_liquidacao` para entradas de cartão; separar "confirmado" vs "projetado".
- `src/pages/financeiro/DashboardFinanceiro.tsx` — novos KPIs, gráficos e alertas.
- (Sem migração de schema — todas as colunas necessárias já existem: `pagamentos_cartao.*`, `contas_receber.conta_bancaria_destino_id`, `contas_receber.data_recebimento`, `cheques.*`.)

## Fora de escopo

- Não altera a criação de pedido em si (Nova Venda continua como está — só passa a marcar a conta como recebida por causa da mudança em `isFormaAVista`).
- Não mexe em Vale Gás nem no fluxo de Compras (já refatorado).
- Não muda regras de RLS nem cria tabelas novas.

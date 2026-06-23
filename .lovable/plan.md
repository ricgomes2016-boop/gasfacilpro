
# Múltiplas contas de recebimento por maquininha

## Como funciona hoje

- **Formas de Pagamento** (`config_destino_pagamento`) tem **1 conta bancária por forma**. Ex.: "Crédito" → 1 conta.
- **Maquininhas** (`terminais_cartao`) já existem e são vinculadas a uma **Operadora** (`operadoras_cartao`), que carrega taxas e prazos.
- No `paymentRoutingService.ts`, quando a venda é cartão/PIX maquininha, ele:
  1. Pega a **primeira operadora ativa** da unidade (não respeita qual maquininha foi usada!).
  2. Cria um `contas_receber` com a operadora, mas **sem conta bancária de destino**.
- Resultado: hoje, se você tem PagBank e Itaú, o sistema não diferencia. A baixa cai sempre no mesmo lugar.

## O problema do caso Forte Gás

Atendente/entregador escolhe a maquininha na hora da venda (já existe esse fluxo em `CardOperatorSelectorModal` e `CardPaymentModal`). Mas essa escolha **não influencia** qual conta bancária recebe o dinheiro.

## Proposta — vincular conta bancária à Maquininha/Operadora

O vínculo conta bancária ↔ recebimento sobe um nível: deixa de ser na **Forma de Pagamento** e passa a ser na **Operadora/Maquininha**. Cada maquininha (PagBank, Itaú, Cielo…) aponta para a sua própria conta.

### 1. Banco de dados
- Adicionar coluna `conta_bancaria_id` em `operadoras_cartao` (FK → `contas_bancarias`).
  - Padrão: 1 conta por operadora (cobre 95% dos casos).
- Manter a possibilidade de **override por terminal** (`terminais_cartao.conta_bancaria_id`, opcional). Se preenchido, vence sobre a operadora. Útil se a mesma operadora tiver maquininhas em contas diferentes.

### 2. Tela Operadoras / Maquininhas
- Em **Gestão de Cartões → Operadora**: novo campo "Conta de recebimento" (Select com logo do banco e badge 🔌 quando integrada).
- Em **Maquininhas da operadora** (`MaquininhasOperadoraTab`): campo opcional "Conta de recebimento (sobrescrever)".
- Indicador visual quando a operadora ainda não tem conta vinculada (alerta amarelo "Recebíveis sem destino").

### 3. Roteamento da venda (`paymentRoutingService.ts`)
- Receber o `terminal_id` (ou `operadora_id`) escolhido na venda como parte do payload de cada pagamento de cartão/PIX maquininha.
- `getOperadoraConfig` passa a buscar a **operadora do terminal selecionado**, não a "primeira ativa".
- O `contas_receber` gerado recebe `conta_bancaria_destino_id` = terminal.conta ?? operadora.conta.
- Quando o título é baixado (recebimento da operadora), a entrada bancária vai automaticamente para a conta certa.

### 4. Tela Formas de Pagamento (ajuste fino)
- Para Crédito/Débito/PIX Maquininha: a coluna "Conta vinculada" passa a mostrar **"Definida por maquininha"** (com link para a tela de Operadoras), em vez de um Select fixo.
- Para Dinheiro / PIX direto / Boleto / Fiado / Cheque: continua como está (1 forma = 1 destino).

### 5. Tela Conta Bancária — `FormasVinculadasCard`
- Passa a listar também as **maquininhas que depositam nesta conta** (ex.: "Maquininha PagBank Loja 1 — Crédito/Débito/PIX Maq.").

## Fluxo final (exemplo Forte Gás)

```text
Venda R$ 100 no Crédito
   |
   v
Atendente escolhe maquininha
   |-- "PagBank Loja"  -> Operadora PagBank -> Conta "PagBank"  -> CR liquidado em D+30 cai na conta PagBank
   |-- "Itaú PinPad"   -> Operadora Itaú    -> Conta "Itaú PJ"  -> CR liquidado em D+30 cai na conta Itaú
```

## Detalhes técnicos

**Migration:**
```sql
ALTER TABLE operadoras_cartao ADD COLUMN conta_bancaria_id uuid REFERENCES contas_bancarias(id);
ALTER TABLE terminais_cartao  ADD COLUMN conta_bancaria_id uuid REFERENCES contas_bancarias(id);
ALTER TABLE contas_receber    ADD COLUMN conta_bancaria_destino_id uuid REFERENCES contas_bancarias(id);
```
(sem alteração de RLS — herdam regras existentes)

**Arquivos a editar:**
- `src/services/paymentRoutingService.ts` — aceitar `terminal_id`/`operadora_id` no payload e resolver a conta de destino.
- `src/components/vendas/PaymentSection.tsx` / `CardPaymentModal.tsx` / `CardOperatorSelectorModal.tsx` — passar o terminal escolhido adiante.
- `src/pages/financeiro/OperadoraCartaoDetalhe.tsx` — campo "Conta de recebimento".
- `src/components/financeiro/operadora-detalhe/MaquininhasOperadoraTab.tsx` — campo override por terminal.
- `src/components/financeiro/ConfigDestinoPagamento.tsx` — exibir "Definida por maquininha" para formas de cartão.
- `src/components/financeiro/conta-detalhe/FormasVinculadasCard.tsx` — listar maquininhas também.

**Fora de escopo:**
- Divisão proporcional de uma venda entre duas contas.
- Roteamento de Contas a Pagar (continua 1 conta por categoria, separado).

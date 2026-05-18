# Contas a Receber — data de recebimento, data da venda e dias em aberto

## 1. Banco (migration)

Adicionar coluna na tabela `contas_receber`:
- `data_recebimento DATE NULL` — preenchida ao liquidar.

Sem mudança em RLS ou triggers.

## 2. Modal "Liquidar / Receber" (`src/pages/financeiro/ContasReceber.tsx`)

- Adicionar input **Data do recebimento** (`type="date"`), default = hoje (Brasília).
- Manter no `receberForm` como `dataRecebimento`.
- Em `handleReceber`:
  - Ao liquidar total → `UPDATE contas_receber SET status='recebida', data_recebimento=<data>, forma_pagamento=...`
  - Ao liquidar parcial → registrar a data escolhida na observação ("Recebido parcial R$ X em DD/MM/YYYY"), sem fechar a conta.
- Replicar mesmo input no **Dialog "Liquidar em Lote"** (`bulkDialogOpen`) e usar a data informada no UPDATE em batch.

## 3. Tabela desktop

- Nova coluna **"Data Venda"** entre Cliente e Descrição.
  - Fonte: `pedidos.created_at` (já vem no join). Fallback: `contas_receber.created_at`.
  - Formato `dd/MM/yyyy`.
- Coluna **"Vencimento"**: abaixo da data, exibir em texto pequeno cinza:
  - `pendente` e vencido → `"X dias em aberto"` (vermelho).
  - `pendente` e a vencer → `"vence em X dias"` (cinza). Hoje → `"vence hoje"`.
  - `recebida` → `"recebido em DD/MM/yyyy"` se `data_recebimento` existir.

## 4. Cards mobile

- Mostrar "Venda: DD/MM/yyyy" abaixo da descrição.
- Mostrar "X dias em aberto" / "recebido em ..." abaixo do vencimento (já existe a linha Venc).

## 5. Ajustes no fetch e tipo

- Incluir `pedidos(created_at)` e `data_recebimento` no `select`.
- Acrescentar `data_venda?: string | null` e `data_recebimento?: string | null` na interface `ContaReceber`.

## Fora do escopo

- Não alterar fluxo de roteamento bancário (`paymentRoutingService`).
- Não tocar em filtros ou exportações XLSX/PDF (data_recebimento pode ser adicionada depois se necessário).

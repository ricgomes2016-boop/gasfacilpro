## Decisão

Manter a lista fixa de 9 formas (necessária para DRE, Conciliação Cartão, Vale Gás funcionarem) e melhorar a tela existente `ConfigDestinoPagamento` que já mapeia forma → conta bancária por unidade.

## Mudanças

### 1. Renomear e dar destaque

- Renomear título da aba/card de "Destino de Pagamento" para **"Formas de Pagamento"**.
- Subtítulo: "Defina qual conta bancária recebe cada forma de pagamento das suas vendas."
- Garantir que esteja acessível como aba dedicada dentro do menu Financeiro (manter onde já está hoje, só revisar label do item no menu/breadcrumb).

### 2. Coluna "Disponível em" (estilo GestãoClick)

Adicionar coluna visual com 2 badges fixos por forma:

- **Recebimento** (verde) — todas as formas
- **Pagamento** (vermelho) — formas que também valem para Contas a Pagar: Dinheiro, PIX, Transferência, Boleto, Cheque, Cartão Crédito/Débito

Visual apenas (informativo), sem alterar lógica de Contas a Pagar agora — fica documentado para futura expansão.

### 3. Status Ativo/Inativo

- Adicionar coluna **Ativo** com Switch por linha.
- Quando inativo, a forma não aparece nos selects de Nova Venda / Caixa.
- Persiste em `config_destino_pagamento.ativo` (coluna já existe).
- Forma sem registro = ativa por padrão (compatibilidade).

### 4. Visual da conta vinculada

- Mostrar logo/cor do banco ao lado do nome da conta no select (usar `bankThemes.ts` que já existe).
- Indicador 🔌 ao lado quando a conta tem provedor integrado (Asaas/PagBank) — reaproveitar `getBankProvider()`.

### 5. Link rápido bidirecional

- Na tela de detalhe da conta bancária (`ContaBancariaDetalhe`), adicionar card "Formas de Pagamento vinculadas" listando quais formas roteiam para aquela conta, com link para editar.

## Fora do escopo

- CRUD aberto de formas (quebraria DRE/Conciliação/Vale Gás).
- Roteamento de Contas a Pagar por forma (só sinalização visual agora).
- Múltiplas contas por forma na mesma unidade.

## Técnico

- Editar: `src/components/financeiro/ConfigDestinoPagamento.tsx` (renomear, badges, switch ativo, visual banco).
- Editar: `src/pages/financeiro/ContaBancariaDetalhe.tsx` (card de formas vinculadas).
- Adicionar metadado `disponivelEm: ['recebimento'] | ['recebimento','pagamento']` no array `FORMAS_PAGAMENTO` local.
- Usar `getBankProvider()` de `src/lib/bancos/bankProviders.ts` e `bankThemes` de `src/lib/bancos/bankThemes.ts`.
- Nenhuma migração de schema necessária (`ativo` já existe em `config_destino_pagamento`).
- Filtrar formas inativas no hook que alimenta os selects de venda (verificar uso de `config_destino_pagamento` em Nova Venda / Caixa antes de aplicar o filtro — se não existir consumo direto, criar hook `useFormasPagamentoAtivas`).

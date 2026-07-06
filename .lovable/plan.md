## Objetivo

Garantir que TODA venda, recebimento e acerto caia **exatamente na conta bancária que o usuário definiu por forma de pagamento** — Cartão/PIX Maquininha → PagBank, PIX chave CNPJ → Itaú, Boleto/Asaas → conta Asaas, Dinheiro → Caixa Forte Gás — usando uma única fonte de verdade: `config_destino_pagamento` (por unidade + forma) + `operadoras_cartao.conta_bancaria_id` (por maquininha).

---

## Diagnóstico — por que os saldos estão errados hoje

Auditoria dos 4 pontos que gravam dinheiro em conta bancária:

### 1. `src/services/paymentRoutingService.ts` (roteia venda nova)
- **PIX** chama `getContaPrincipal(unidadeId)` que faz `select id from contas_bancarias where unidade_id = X and ativo limit 1`. Sempre pega a **primeira ativa da unidade**, ignorando a preferência do usuário → PIX cai em qualquer conta, normalmente na Forte Gás em vez do Itaú.
- **Cartão débito/crédito/PIX maquininha** só olha `operadora.conta_bancaria_id`. Se a operadora não estiver com conta vinculada (caso comum: cadastrada antes da PagBank), o valor vira `contas_receber` sem destino → ao liquidar cai na "primeira conta" (idem PIX). Nunca chega na PagBank.
- **Dinheiro** só grava em `movimentacoes_caixa` — correto (é a "Forte Gás Caixa"). Sem mudança.
- **Boleto / Fiado / custom_aprazo** grava `contas_receber` sem `conta_bancaria_destino_id`. Ao liquidar, o pipeline não sabe a conta → cai na primeira.

### 2. `src/pages/financeiro/ContasReceber.tsx`
- Tem função local `getContaPrincipal()` (linha 418) idêntica ao serviço: pega a primeira ativa. Usada nos 3 fluxos de baixa (individual, avulsa, em lote — linhas 370, 384, 447, 467). PIX baixado aqui vira crédito em conta errada.
- Nunca respeita `contas_receber.conta_bancaria_destino_id` que já é gravado por cartão.

### 3. `src/components/financeiro/RecebiveisPipeline.tsx` (baixa da conciliação de cartão)
- `handleLiquidar` (linha 277) também faz `.limit(1).maybeSingle()` → ignora `row.operadora_id → operadora.conta_bancaria_id` e ignora `row.conta_bancaria_destino_id` gravado na criação. Cartão que era pra cair na PagBank cai na Forte Gás.

### 4. Ausência de fallback configurável
- Existe a tabela `config_destino_pagamento(unidade_id, forma_pagamento, conta_bancaria_id, ativo)` e a UI `ConfigDestinoPagamento.tsx` já salva PIX/Boleto/Cheque/Transferência/Dinheiro. **Ninguém consulta essa tabela em runtime.** É configuração morta.

---

## Correções (uma fonte de verdade)

### A. Novo helper `resolverContaDestino` em `paymentRoutingService.ts`

Precedência única, usada em TODOS os pontos de baixa/roteamento:

```
1. Explícito na chamada        (pag.conta_bancaria_id)          — usuário escolheu no ato
2. Terminal cartão              (terminais_cartao.conta_bancaria_id)
3. Operadora                    (operadoras_cartao.conta_bancaria_id)
4. Config por forma/unidade     (config_destino_pagamento onde forma_pagamento = X)
5. Conta Asaas ativa            (se forma = boleto/pix_asaas — via provedor)
6. Primeira ativa da unidade    (fallback atual — só se nada acima resolver)
```

Assinatura:
```ts
resolverContaDestino(params: {
  unidadeId: string | null;
  forma: string;                // "pix", "cartao_credito", "boleto", "custom_avista_X"...
  contaExplicita?: string | null;
  terminalId?: string | null;
  operadoraContaId?: string | null;
}): Promise<string | null>
```

### B. `paymentRoutingService.ts` — usar o helper em todos os cases

- **`case "pix"`**: trocar `getContaPrincipal(unidadeId)` por `resolverContaDestino({unidadeId, forma:"pix"})`. Assim, se o usuário configurou "PIX → Itaú", o PIX de venda entra no Itaú, não na Forte Gás.
- **`case cartao_debito/credito/pix_maquininha`**: já resolve por operadora — passar o resultado por `resolverContaDestino` para respeitar override manual da linha (`pag.conta_bancaria_id`) e cair no config da forma se a operadora não tiver conta.
- **`case boleto`**: gravar `conta_bancaria_destino_id = resolverContaDestino({forma:"boleto"})` já na criação de `contas_receber`. Se a integração Asaas estiver ligada, esse resolver retorna a conta marcada como "provedor Asaas".
- **`default` (custom_avista/custom_aprazo)**: hoje só olha `formas_pagamento_custom.conta_bancaria_id`. Adicionar fallback via `resolverContaDestino` com `forma = slug`, e gravar `conta_bancaria_destino_id` no `contas_receber` do custom_aprazo.

### C. `ContasReceber.tsx` — respeitar o destino ao baixar

Substituir todas as chamadas locais `getContaPrincipal()` pelo helper novo, passando `forma: fp.forma` (ou a forma da baixa em lote) e `contaExplicita: receberConta.conta_bancaria_destino_id`. Se o boleto foi criado apontando pra Asaas/Itaú, a baixa vai pro Itaú — sem exceção.

Também: no fluxo "Liquidar / Receber" individual, mostrar um `<Select>` opcional "Creditar em" pré-preenchido com a conta resolvida, para o operador poder trocar em casos pontuais (troco em outra conta).

### D. `RecebiveisPipeline.tsx` — cartão sempre para a conta da maquininha

Em `handleLiquidar`, ler `row.conta_bancaria_destino_id` (já gravado pelo `insertContasReceber` do fluxo cartão), e, se null, `resolverContaDestino({unidadeId, forma: row.forma_pagamento, operadoraContaId: operadora.conta_bancaria_id})`. Nunca mais cair no `limit(1)`.

### E. `AcertoEntregador.tsx` — "Acertar todos"

Hoje o acerto já monta `PagamentoRoteamento[]` com `operadora_id` e `conta_bancaria_id` (via marker `[op:...|cta:...]`). Como `rotearPagamentosVenda` passará a usar o helper novo, o acerto em massa **automaticamente** creditará na conta certa (PagBank/Itaú/Asaas) — sem mudança no acerto em si.

Adicionar apenas: badge por linha "→ Recebe em: {conta}" resolvido em tempo real via `resolverContaDestino`, para o operador conferir antes de clicar "Acertar todos". Bloqueia salvar se alguma linha ficar sem conta destino resolvida (a menos que seja dinheiro/cheque/fiado, que não vão para banco).

### F. UI de `ConfigDestinoPagamento.tsx` (Contas Bancárias)

Já existe. Ajustes mínimos:
- Sinalizar com badge "Integração Asaas" / "PagBank" quando a conta selecionada tem provedor (usa `getBankProvider(conta.banco)` que já é importado).
- Bloco de teste "Simular venda R$ 100": mostra, para cada forma ativa, em qual conta o valor cairá segundo o helper. Serve de "diagnóstico" para o gestor conferir que Boleto→Asaas, PIX→Itaú, Dinheiro→Caixa, Cartão→PagBank.

### G. Migration única (idempotente)

- `contas_receber.conta_bancaria_destino_id`: já existe. Nenhuma coluna nova.
- Backfill leve: preencher `conta_bancaria_destino_id` em contas_receber **ainda pendentes** usando `resolverContaDestino` no servidor via função SQL simples (opcional; se preferir, só corrige daqui pra frente e deixa histórico como está).
- Sem alterar RLS, sem alterar tabelas de contas ou operadoras.

---

## Fora de escopo

- Recalcular saldos históricos das contas bancárias. Apenas garante que **daqui pra frente** cada crédito cai na conta certa.
- Conciliação bancária automática (OFX), Gestão de Cartões, DRE, Fluxo de Caixa — só se beneficiam indiretamente porque as movimentações passarão a nascer certas.
- Nova Venda / PDV / Kanban / vale-gás — o serviço centralizado já é chamado por eles, nenhum toque na UI de venda.

---

## Validação

Cenário real Central Gás, após a mudança, com config: PIX→Itaú, Boleto→Asaas, Cartão(op. PagBank)→PagBank, Dinheiro→Caixa Forte Gás.

1. Registrar venda R$ 100 PIX → `movimentacoes_bancarias` no **Itaú** (não Forte Gás), saldo Itaú sobe R$ 100.
2. Registrar venda R$ 200 cartão crédito PagBank → `contas_receber` com `conta_bancaria_destino_id = PagBank`. Ao liquidar em `RecebiveisPipeline`, saldo **PagBank** sobe R$ 200 − taxa.
3. Registrar venda R$ 50 boleto → `contas_receber` com destino **Asaas**. Ao marcar como recebida, saldo Asaas sobe R$ 50.
4. Registrar venda R$ 30 dinheiro → `movimentacoes_caixa` (Forte Gás), nada em banco.
5. Acerto do entregador com 6 vendas mistas → clicar "Acertar todos" credita cada linha na conta que o badge mostrou; nenhum valor cai na Forte Gás por engano.
6. Diagnóstico em Contas Bancárias → "Simular venda R$ 100" mostra as 4 formas → 4 contas distintas, cada uma na certa.

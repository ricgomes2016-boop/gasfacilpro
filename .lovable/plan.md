## Objetivo

Permitir cadastrar formas de pagamento customizadas na tela **Financeiro → Formas de Pagamento**, aparecendo automaticamente em todos os seletores do sistema, e garantir que o seletor de **Contas a Receber** liste todas as formas ativas (built-in + customizadas).

## 1. Backend — nova tabela `formas_pagamento_custom`

Migration criando tabela por unidade:

- `nome` (texto, ex.: "Ticket Alimentação")
- `slug` (texto, gerado a partir do nome, único por unidade — usado como valor no banco em `forma_pagamento`)
- `icone` (emoji opcional, default "💰")
- `grupo` (`a_vista` | `a_prazo`) — define comportamento financeiro
- `conta_bancaria_id` (opcional — só faz sentido quando `a_vista`)
- `ativo` (bool)
- `unidade_id`, `empresa_id`, `created_at`, `updated_at`

RLS: leitura/escrita por usuários da unidade; `service_role` liberado. GRANTs para `authenticated` e `service_role`.

## 2. Helper unificado — `src/lib/financeiro/formasPagamento.ts` (novo)

Hook `useFormasPagamentoDisponiveis({ tipo: "recebimento" | "pagamento" | "ambos" })` que:

1. Carrega `config_destino_pagamento` (built-in) da unidade
2. Carrega `formas_pagamento_custom` ativas da unidade
3. Retorna lista unificada `{ value, label, grupo, semBanco, contaBancariaId, isCustom }`
4. Estende `getFormaCategoria` / `getFormaGrupo` em `src/lib/financeiro/formaPagamento.ts` para consultar o mapa das customizadas quando o slug não bater com built-ins (grupo vem do cadastro).

## 3. UI — `FormasPagamento.tsx` + novo `FormasCustomizadasCard.tsx`

Abaixo do `ConfigDestinoPagamento`, novo card:

- Lista formas customizadas da unidade (nome, ícone, grupo, conta destino, status)
- Botão **"+ Nova forma de pagamento"** abre modal com:
  - Nome (obrigatório)
  - Ícone (emoji picker simples com padrões)
  - Grupo: **À vista** (baixa imediata, permite escolher conta) ou **A prazo** (vai para Contas a Receber pendente)
  - Se **à vista**: select de conta bancária (opcional — sem conta = fica no caixa)
  - Ativo (switch)
- Ações: editar, ativar/desativar, excluir (soft delete se já usado em pedidos/CR).

## 4. Propagação nos seletores

Substituir listas hard-coded pelo hook em:

- `src/pages/financeiro/ContasReceber.tsx` — seletor de forma no dialog de baixa/edição (foco do pedido do usuário)
- `src/pages/financeiro/ContasPagar.tsx` — quando aplicável (formas com `disponivel != "recebimento"`)
- `src/pages/vendas/NovaVenda.tsx` e `EditarPedido.tsx` — step de pagamento
- `src/pages/entregador/EntregadorContasPrazo.tsx` — dialog de recebimento
- `src/services/paymentRoutingService.ts` — resolver conta destino consultando também as customizadas
- `src/lib/financeiro/formaPagamento.ts` — usar grupo cadastrado para custom slugs

## 5. Contas a Receber — revisão do seletor

Na `ContasReceber.tsx`:

- Seletor de forma de pagamento passa a usar `useFormasPagamentoDisponiveis({ tipo: "recebimento" })` — inclui customizadas ativas
- Rótulo/ícone consistentes (label do cadastro para customizadas)
- Comportamento de baixa continua governado por `getFormaGrupo` (que agora reconhece customizadas via cache do hook)

## Detalhes técnicos

- Slug: `nome.toLowerCase().normalize().replace(/\s+/g, "_")`, prefixo `custom_` para evitar colisão com built-ins.
- Persistência: `pedidos.forma_pagamento`, `contas_receber.forma_pagamento` continuam texto livre — nenhum schema além da nova tabela precisa mudar.
- `paymentRoutingService`: quando `forma_pagamento` começa com `custom_`, buscar `conta_bancaria_id` em `formas_pagamento_custom` (se `a_vista`) ou rotear para Contas a Receber (se `a_prazo`).
- Não mexer em App.tsx, providers, ou schema de tabelas existentes.

## Fora de escopo

- Relatórios/dashboards com agrupamento por forma (continuam funcionando, apenas passam a mostrar a label customizada).
- Migração retroativa de dados.

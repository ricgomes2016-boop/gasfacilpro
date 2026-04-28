## Objetivo
Ajustar a lógica do Vale Gás para refletir corretamente que o devedor do recebível é o parceiro, não o cliente final, permitindo também controlar vales criados em outro sistema sem repetir numeração. No acerto diário, ao escolher a forma de pagamento Vale Gás, o usuário poderá selecionar o parceiro e o número/código do vale.

## Situação atual encontrada
- Já existe um módulo de Vale Gás com parceiros, lotes, vales individuais, controle, emissão e acerto.
- A emissão já permite numeração automática, lote por intervalo e manual, mas a proteção contra duplicidade precisa ficar mais forte no banco.
- O acerto diário já tem forma de pagamento “Vale Gás” e validação por código, mas ainda não obriga/estrutura corretamente parceiro + número do vale.
- O roteamento financeiro já cria uma conta a receber para `vale_gas`, porém hoje registra como “Parceiro Vale Gás” genérico e pode vincular `cliente_id` do pedido, o que confunde a cobrança.
- Em Contas a Receber já existe uma aba de Vale Gás, mas falta exibir/filtrar/baixar por parceiro e vale.

## Regra de negócio proposta

```text
Venda paga com Vale Gás
        |
        v
Pedido fica com forma de pagamento Vale Gás
        |
        v
Vale é marcado como utilizado e vinculado ao pedido
        |
        v
Contas a Receber é criado contra o PARCEIRO do vale
        |
        v
Quando o parceiro pagar, baixa esse recebível ou o acerto do parceiro
```

### Regras principais
1. O cliente final não deve aparecer como responsável financeiro do Vale Gás em Contas a Receber.
2. O recebível de Vale Gás deve ser em nome do parceiro selecionado.
3. Cada número/código de vale só pode existir uma vez no sistema.
4. Vales vindos de outro sistema devem poder ser cadastrados como “importados/externos”, usando numeração manual ou intervalo.
5. No acerto diário, “Vale Gás” deve exigir parceiro + número/código válido do vale.
6. Ao confirmar o acerto, o sistema deve criar o recebível do parceiro já com referência do vale utilizado.

## Alterações planejadas

### 1. Banco de dados: reforçar controle de numeração e vínculo financeiro
Criar uma migração para:
- Garantir unicidade em `vale_gas.numero` e `vale_gas.codigo`, evitando repetição mesmo se duas telas tentarem gravar ao mesmo tempo.
- Adicionar campos de vínculo em `contas_receber`, se ainda não existirem:
  - `vale_gas_id`
  - `vale_gas_parceiro_id`
  - opcionalmente `origem` ou observação estruturada para identificar recebíveis de Vale Gás.
- Criar índices para consultas por parceiro, vale e vencimento.
- Manter RLS por unidade/empresa, sempre preenchendo `unidade_id` nos inserts para evitar bloqueios.

### 2. Cadastro/importação de vales externos
Ajustar a tela de emissão de Vale Gás para deixar claro que ela também serve para registrar vales gerados em outro sistema:
- Renomear/ajustar textos do modo manual e lote para “Registrar vales externos”.
- Antes de gravar, validar se algum número do intervalo já existe.
- Se houver duplicidade, bloquear a gravação e mostrar exatamente quais números já existem.
- Gravar os vales externos no mesmo cadastro `vale_gas`, com parceiro, lote, valor, produto e status inicial.
- Usar o maior número existente para continuar a numeração automática, incluindo os importados.

### 3. Acerto diário: selecionar parceiro e número do vale
Atualizar `AcertoEntregador` para, quando a forma “Vale Gás” for escolhida:
- Exibir seleção de parceiro.
- Exibir campo de número/código do vale.
- Permitir digitação ou leitura por QR/câmera como já existe.
- Validar o vale buscando por parceiro + número/código.
- Aceitar apenas vale disponível ou vendido, bloqueando vale já utilizado/cancelado.
- Mostrar confirmação com parceiro, número, código e valor.
- Salvar o pedido com metadados suficientes para o roteamento financeiro saber qual parceiro deve ser cobrado.

### 4. Roteamento financeiro correto para Contas a Receber
Ajustar `paymentRoutingService.ts` para `vale_gas`:
- Receber `vale_gas_id`, `vale_gas_parceiro_id`, nome do parceiro e número/código do vale no item de pagamento.
- Criar `contas_receber` com:
  - `cliente` = nome do parceiro
  - `cliente_id` = `null`, para não cobrar o cliente final
  - `vale_gas_id` e `vale_gas_parceiro_id` preenchidos
  - descrição do tipo: `Vale Gás nº X - Pedido #Y`
  - `forma_pagamento = vale_gas`
  - `unidade_id` preenchido
- Marcar o vale como utilizado e vinculado ao pedido, se ainda não estiver marcado.

### 5. Contas a Receber: visualização e baixa por parceiro
Atualizar `ContasReceber` para:
- Buscar dados do parceiro e do vale nos recebíveis de Vale Gás.
- Na aba Vale Gás, mostrar parceiro, número/código do vale, pedido, vencimento e valor.
- Ajustar filtros para facilitar busca por parceiro ou número do vale.
- Ao receber/baixar uma conta de Vale Gás, registrar o pagamento normalmente em caixa/banco, mas mantendo a rastreabilidade do parceiro e vale.
- Evitar mostrar o cliente final como devedor nessa aba.

### 6. Relatório/acerto de Vale Gás
Ajustar a tela `ValeGasAcerto` para não contar novamente vales já vinculados em um acerto/recebível, evitando cobrança duplicada.
- O acerto por parceiro deverá considerar somente vales utilizados ainda não acertados.
- O histórico deve continuar mostrando quantidade, valor e pagamento.
- Se a baixa acontecer direto em Contas a Receber, o vínculo do vale deve impedir nova cobrança.

## Arquivos que serão alterados
- `src/contexts/ValeGasContext.tsx`
- `src/pages/financeiro/ValeGasEmissao.tsx`
- `src/pages/financeiro/ValeGasControle.tsx` se necessário para exibir origem/externo
- `src/pages/financeiro/ValeGasAcerto.tsx`
- `src/pages/financeiro/ContasReceber.tsx`
- `src/pages/caixa/AcertoEntregador.tsx`
- `src/services/paymentRoutingService.ts`
- Nova migração em `supabase/migrations/...sql`

## Cuidados de segurança e consistência
- Não refatorar rotas nem provider nesting do `App.tsx`.
- Não editar arquivos gerados da integração (`client.ts`, `types.ts`).
- Usar `unidade_id` em todos os inserts/updates relevantes para passar nas políticas de isolamento.
- Manter roles no sistema atual de RBAC; nada de role no perfil.
- Validar unicidade no banco, não só no front-end.
- Não criar cobrança em nome do cliente final quando o pagamento for Vale Gás.

## Resultado esperado
Depois da implementação:
- Você poderá registrar vales que vieram de outro sistema sem repetir numeração.
- O acerto diário exigirá parceiro e número do vale quando o pagamento for Vale Gás.
- O recebível será lançado contra o parceiro correto.
- A aba Vale Gás em Contas a Receber mostrará o que cada parceiro deve pagar.
- O sistema impedirá usar o mesmo vale duas vezes.
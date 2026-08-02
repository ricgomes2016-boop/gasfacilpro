# Gestão de Estoque — fluxo por produto, saldo inicial editável e data efetiva

## Problema atual

Na tela Estoque do Dia o "Inicial" não é um dado real: ele é calculado de trás para frente a partir do estoque atual do produto (`inicial = atual − entradas + saídas + vendas + avarias`). Consequências:

- Não é possível corrigir o saldo inicial de um dia — qualquer erro histórico se propaga.
- Toda movimentação manual é gravada com a data/hora de agora (`movimentacoes_estoque` só tem `created_at`), então lançar algo para uma data passada é impossível: o filtro mostra o dia escolhido, mas o lançamento cai no dia de hoje.
- Não existe uma visão de "extrato" que mostre, por produto, cada evento que compôs o saldo (compra, venda, ajuste, avaria, transferência).

## O que será feito

### 1. Saldo inicial editável (clique no valor)

- Clicar no número da coluna/campo **Inicial** (desktop e mobile) abre um editor inline com a quantidade.
- Ao salvar, o sistema grava o saldo inicial daquele produto **naquela data** e recalcula a linha: `Atual = Inicial + Entradas − Saídas − Vendas − Avarias`.
- A diferença entre o saldo inicial informado e o que estava implícito gera um lançamento de ajuste rastreável (com observação "Ajuste de saldo inicial"), para que o estoque atual do produto fique coerente e auditável — nada é sobrescrito às cegas.
- Só perfis admin/gestor/operacional podem editar; o valor fica registrado com autor e horário.

### 2. Lançamentos respeitam a data filtrada

- Toda movimentação criada na tela (botão "Movimentação", ícone de editar na linha, ajuste de saldo inicial) passa a usar a **data selecionada no filtro** como data do evento, e não a data de hoje.
- O cabeçalho do formulário mostra explicitamente "Lançando em DD/MM/AAAA" para evitar engano.
- A leitura da tabela passa a filtrar por essa data de evento, então um lançamento retroativo aparece no dia correto.

### 3. Análise do fluxo por produto (extrato)

- Clicar no nome do produto abre um painel "Fluxo do produto" com o extrato do período filtrado, em ordem cronológica:
  - saldo inicial do período;
  - cada compra (com fornecedor e nota, quando houver);
  - cada venda (pedido e cliente);
  - entradas/saídas manuais e avarias (com observação e autor);
  - transferências entre unidades;
  - saldo acumulado após cada evento e saldo final.
- Rodapé com totais por tipo de movimento e um alerta quando o saldo calculado divergir do estoque cadastrado do produto (indicando lançamento faltante).
- Para vasilhames, o extrato mostra a contrapartida automática (venda de gás cheio = entrada de vazio).

## Detalhes técnicos

- Migration: adicionar `data_movimento date not null default current_date` em `public.movimentacoes_estoque` (backfill com `created_at::date`) e índice `(unidade_id, data_movimento, produto_id)`.
- Migration: nova tabela `public.estoque_saldos_iniciais` (`unidade_id`, `produto_id`, `data_referencia`, `quantidade`, `definido_por`, timestamps) com unique `(unidade_id, produto_id, data_referencia)`, GRANTs para `authenticated`/`service_role` e RLS por empresa/unidade nos mesmos moldes de `estoque_conferencias`.
- `src/pages/Estoque.tsx`: buscar saldos iniciais do período; passar para a tabela; filtrar movimentações por `data_movimento`; enviar a data filtrada nos inserts.
- `src/components/estoque/EstoqueDiaTable.tsx`: `inicial` passa a vir do saldo salvo quando existir (fallback para o cálculo atual); célula Inicial vira campo editável; nome do produto vira gatilho do extrato.
- Novo componente `src/components/estoque/FluxoProdutoDialog.tsx` consultando `compra_itens`, `pedido_itens`, `movimentacoes_estoque` e `transferencia_estoque_itens` do produto no período.
- Sem mudanças em outras telas; regras de contrapartida cheio/vazio permanecem as já existentes.

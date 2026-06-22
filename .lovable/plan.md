## Problema 1: Transferência não aparece na conta destino

**Causa:** `realizarTransferencia` em `ContaBancariaDetalhe.tsx` insere apenas na tabela `transferencias_bancarias` e atualiza `contas_bancarias.saldo_atual`. **Nada é gravado em `movimentacoes_bancarias`**, que é a tabela lida pelo `ExtratoTabela` e pelas "Últimas movimentações" da Visão Geral. Não existe trigger no banco que faça essa propagação.

**Correção (frontend):** após inserir em `transferencias_bancarias`, inserir duas linhas em `movimentacoes_bancarias`:
- Conta origem → `tipo: "saida"`, descricao `"Transferência enviada para {nome destino}"`, data de hoje, `unidade_id`, `user_id`.
- Conta destino → `tipo: "entrada"`, descricao `"Transferência recebida de {nome origem}"`, mesmos campos.

Invalidar também as queries `extrato-tabela` da origem e do destino.

## Problema 2: Ordenação do extrato

`ExtratoTabela.tsx` ordena `ascending: true` e renderiza nessa ordem (movimentação do dia fica no fim). 

**Correção:** manter o cálculo do saldo acumulado em ordem cronológica (necessário para o running balance), mas **inverter o array antes de renderizar** (`rows.slice().reverse()`), de forma que o dia atual (22/06) apareça na primeira linha e a coluna Total continue mostrando o saldo correto de cada data.

## Problema 3: Aba "Extrato de movimentação" no Caixa da empresa

Hoje, quando `tipo === "caixa_interno"`, só existem as abas **Visão Geral** e **Transferência**. O extrato fica embutido dentro da Visão Geral.

**Correção em `ContaBancariaDetalhe.tsx`:**
- Adicionar uma terceira aba "Extrato" no `TabsList` do Caixa.
- Conteúdo: `<ExtratoTabela contaId={conta.id} saldoAtual={saldo} />` (mesmas colunas Data / Descrição / Entrada / Saída / Total).
- Em `QuickShortcuts`, incluir `"extrato"` na lista de itens do Caixa (`["visao", "extrato", "transferencia"]`).
- Em `VisaoGeralPanel`, quando `isCaixa`, remover o `<ExtratoTabela>` embutido (vai virar aba própria) — mantém só a lista de "Últimas movimentações em dinheiro".

## Arquivos a editar

- `src/pages/financeiro/ContaBancariaDetalhe.tsx` — gravar movimentações na transferência; adicionar aba Extrato para o Caixa; invalidar queries das duas contas.
- `src/components/financeiro/conta-detalhe/ExtratoTabela.tsx` — inverter ordem de exibição (mais recente no topo).
- `src/components/financeiro/conta-detalhe/VisaoGeralPanel.tsx` — quando `isCaixa`, não embutir mais o `ExtratoTabela`.
- `src/components/financeiro/conta-detalhe/QuickShortcuts.tsx` — incluir `"extrato"` na lista do Caixa.

Sem alterações no banco de dados.
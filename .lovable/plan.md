## Objetivo
1. Fazer o "Preço médio" nas abas **Canal** e **Entregador** do Relatório de Vendas ser comparável ao **custo** e sinalizar visualmente quando estiver abaixo do custo.
2. Eliminar duplicidade de canais de venda em Pedidos (ex.: `Disk/ Telefone` vs `Disk/Telefone`) e impedir que voltem a aparecer.

---

## Parte 1 — Preço médio vs Custo no Relatório de Vendas

**Diagnóstico atual:** As abas Canal e Entregador já foram corrigidas para calcular preço médio como `Σ(qtd × preço_unitário) / Σ qtd`. Ainda não existe base de custo na tela, então não há como o usuário perceber que o preço médio está abaixo do custo.

**Mudanças em `src/pages/vendas/RelatorioVendasSimplificado.tsx`:**

- Ampliar o `select` da query para também carregar o custo do produto: `produtos (nome, preco_custo)`.
- Ao agregar `porProduto`, `porEntregador` e `porCanal`, acumular também `custoTotal = Σ(qtd × preco_custo)` e derivar `custoMedio = custoTotal / qtd`.
- Adicionar a coluna **"Custo médio"** na tabela de resumo (entre "Preço médio" e "Total") nas três abas.
- Adicionar coluna **"Margem"** (`precoMedio - custoMedio`) com destaque visual:
  - Vermelho + ícone de alerta quando `precoMedio < custoMedio` (preço abaixo do custo).
  - Amarelo quando margem < 5% do custo (venda no limite).
  - Neutro caso contrário.
- Exibir um badge de resumo no topo com a contagem de linhas "abaixo do custo" quando houver, para chamar atenção.
- Incluir as novas colunas nos exports Excel e PDF.

**Observação técnica:** produtos sem `preco_custo` cadastrado entram como custo 0 — nesse caso a coluna mostra "—" e não gera alerta falso.

---

## Parte 2 — Deduplicação de canais de venda

**Diagnóstico atual (dados reais):**
- Cadastro (`canais_venda`) contém `Disk/ Telefone` (com espaço) na unidade Forte Gás.
- Pedidos (`pedidos.canal_venda`): 476 usam `Disk/Telefone` (sem espaço, valor normalizado antes), 4 ainda usam `Disk/ Telefone`, 3 estão `NULL`.
- Resultado: o relatório mostra `Disk/Telefone` e `Disk/ Telefone` como linhas separadas.
- O formulário de pedido lista canais a partir de `canais_venda`, então mesmo depois de normalizar os pedidos existentes, o valor `Disk/ Telefone` volta a ser gravado sempre que o usuário abre o combo.

**Ações — migração de dados:**
1. Renomear no cadastro: `UPDATE canais_venda SET nome = 'Disk/Telefone' WHERE nome = 'Disk/ Telefone'`.
2. Padronizar pedidos remanescentes: `UPDATE pedidos SET canal_venda = 'Disk/Telefone' WHERE canal_venda = 'Disk/ Telefone' OR canal_venda IS NULL`.
3. Fazer um `TRIM` geral em `canais_venda.nome` e `pedidos.canal_venda` para eliminar espaços extras futuros.
4. Consolidar qualquer outro par que colapse após o trim (nenhum detectado hoje além do Disk).

**Ações — prevenção estrutural:**
5. Criar índice único case-insensitive por unidade em `canais_venda`:
   `CREATE UNIQUE INDEX canais_venda_nome_unidade_uniq ON canais_venda (unidade_id, lower(btrim(nome)))`.
   Impede cadastrar "Disk/Telefone" e "disk/telefone " na mesma unidade.
6. Trigger `BEFORE INSERT/UPDATE` em `canais_venda` que aplica `btrim(nome)` para nunca mais gravar com espaço nas pontas.
7. Trigger `BEFORE INSERT/UPDATE` em `pedidos` que faz `NULLIF(btrim(canal_venda), '')` — garante que o valor gravado bate exatamente com o cadastro.

**Ações — relatório defensivo:**
8. No agrupamento por canal em `RelatorioVendasSimplificado.tsx`, aplicar `btrim` no `canal_venda` antes de compor a chave do mapa, para que qualquer resíduo antigo em backups importados ainda colapse na mesma linha.

---

## Detalhes técnicos

- Arquivo alterado: `src/pages/vendas/RelatorioVendasSimplificado.tsx` (colunas custo/margem, destaques, exports, `btrim` na chave).
- Migração SQL: rename em `canais_venda`, updates em `pedidos`, índice único funcional, dois triggers de normalização.
- Nenhuma mudança em fluxo de cadastro/UI de canais — a normalização acontece no banco.
- Sem alteração de schema em `produtos` (usa `preco_custo` já existente).

---

## Fora de escopo
- Não altero o formulário de novo pedido nem a tela de cadastro de canais.
- Não recalculo custo histórico do produto por data (usa custo atual cadastrado — comum em ERPs pequenos; se quiser custo por lote/data, é outro projeto).
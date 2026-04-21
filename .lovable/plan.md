

# Consolidação, alertas e exportação no Portal do Contador

Vou turbinar o portal `/contador` (subdomínio `contador.gasfacilpro.com.br`) com três entregas que trabalham juntas: visão consolidada por categoria, alertas de filiais sem dados e exportação CSV/PDF respeitando o filtro "Todas as lojas" + período já existente.

## 1. Visão consolidada por categoria (Dashboard)

No `ContadorDashboard.tsx` adiciono um novo bloco **"Consolidado por categoria"** abaixo do "Consolidado por unidade". Quando `unidadeAtiva = null` (modo "Todas as lojas"), agrupo:

- **Despesas por categoria contábil** (campo `categoria` em `despesas_contabeis`): valor total, % do bolo, contagem de lançamentos. Visual = lista com barras horizontais (mesmo estilo das barras já usadas).
- **Receita por canal** (`canal_venda` em `pedidos`): balcão, delivery, app, etc.
- **Centros de custo / unidade** (já existe), agora com toggle "Agrupar matriz + filiais" que soma tudo num único totalizador "Empresa consolidada".

Quando uma loja específica está selecionada, o bloco mostra o detalhamento só daquela loja (mesma estrutura, dados filtrados).

## 2. Alertas de filiais sem dados

Adiciono um card **"Alertas de inconsistência"** no topo do dashboard (acima dos KPIs), só visível em modo "Todas as lojas". Para cada filial verifico no período ativo:

- 0 pedidos → alerta âmbar "Sem receita registrada"
- 0 despesas → alerta âmbar "Sem despesas lançadas"
- 0 XMLs importados → alerta cinza "Sem XMLs no período"
- 0 extratos bancários → alerta cinza "Sem extrato bancário"

Cada alerta vira uma linha clicável que leva direto à página correspondente já filtrada por aquela unidade. Se tudo estiver OK em todas as filiais, mostro um banner verde discreto "Todas as 7 lojas com lançamentos no período".

A matriz recebe o ícone 👑 e as filiais 📍, mantendo o padrão visual atual.

## 3. Exportação CSV / PDF

Crio um utilitário central `src/services/contadorExportService.ts` com:

- `exportarCSV(dados, nomeArquivo)` — escapa vírgulas/aspas, BOM UTF-8 para abrir no Excel BR.
- `exportarPDF(titulo, periodo, empresa, unidadeLabel, colunas, linhas, totais)` — reusa `jspdf` + `jspdf-autotable` (já no projeto, ver `reportPdfService.ts`), em A4 paisagem com cabeçalho contendo: empresa, escopo (loja específica ou "Todas as lojas — N unidades"), período e data de geração.

Adiciono botão **"Exportar"** (dropdown CSV/PDF) no canto superior direito de:

- **`ContadorFinanceiro.tsx`** — exporta extratos bancários listados, somando entradas/saídas no rodapé.
- **`ContadorDespesas.tsx`** — exporta despesas com colunas Data, Fornecedor, CNPJ, Categoria, Valor, Status, Loja; agrupado por loja no PDF quando "Todas as lojas".
- **`ContadorXML.tsx`** (Documents) — exporta lista de XMLs com chave, emitente, valor, data, tipo, loja.
- **`ContadorDashboard.tsx`** — botão extra "Exportar consolidado" que gera um PDF executivo com KPIs + tabela "Consolidado por unidade" + "Consolidado por categoria".

Todos os exports respeitam automaticamente o `usePeriodo()` e o `unidadeAtiva` do `useContador()` — ou seja, baixa exatamente o que está visível na tela.

## Detalhes técnicos

- **Sem mudança de schema** — todas as agregações são feitas no client em cima das mesmas queries já existentes.
- **Performance**: dashboard hoje já busca pedidos + despesas; reaproveito esses arrays pra montar o agrupamento por categoria sem nova request.
- **Alertas**: faço um único loop sobre `unidadesAlvo` cruzando com mapas de receita/despesa/xmls/extratos por `unidade_id` (pra XMLs e extratos preciso trazer `unidade_id` nas queries — hoje só conto registros, mudança pequena).
- **Nomeação dos arquivos**: `{empresa}_{relatorio}_{escopo}_{periodo}.{ext}` — ex.: `central-gas_despesas_todas-lojas_2026-04.pdf`.
- **Componente reutilizável**: `BotaoExportar.tsx` em `src/components/contador/` recebe `tipo`, `linhas`, `colunas`, `totais` e renderiza o dropdown.

## Arquivos

**Novos**
- `src/services/contadorExportService.ts`
- `src/components/contador/BotaoExportar.tsx`
- `src/components/contador/AlertasInconsistencia.tsx`
- `src/components/contador/ConsolidadoCategorias.tsx`

**Editados**
- `src/pages/contador/ContadorDashboard.tsx` — alertas, categorias, botão exportar
- `src/pages/contador/ContadorFinanceiro.tsx` — botão exportar
- `src/pages/contador/ContadorDespesas.tsx` — botão exportar
- `src/pages/contador/ContadorXML.tsx` — botão exportar


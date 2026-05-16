## Problema

O filtro do "Comparativo Mensal por Produto" não permite intervalo entre anos (ex.: 01/12/2025 → 30/04/2026). Hoje o estado é:

- `anoComparativo: number` (um único ano)
- `mesesSelecionados: number[]` (índices 0–11 dentro **desse mesmo ano**)

Os handlers dos inputs De/Até forçam tudo a um único ano: ao mudar o "Até" para 04/2026, o código detecta que `y !== anoComparativo` e reseta `anoComparativo` para 2026, descartando dezembro/2025. Por isso o filtro "volta para 2025/2026" e nunca aceita o intervalo cruzando o ano.

## Solução

Refatorar o estado e a lógica do comparativo mensal para trabalhar com uma **lista ordenada de períodos `{ano, mes}`** em vez de um único ano + meses. Mantém todo o resto da página intacto (Vendas, Pagamento, etc.) — mexe só na seção "Comparativo Mensal por Produto" dentro de `src/pages/vendas/RelatorioVendas.tsx`.

### Passos

1. **Novo estado** em RelatorioVendas.tsx:
   - Remover `anoComparativo` e `mesesSelecionados`.
   - Adicionar `rangeIni: {ano, mes}` e `rangeFim: {ano, mes}` (default: jan do ano atual → mês atual).
   - Derivar `periodosSelecionados: {ano:number, mes:number}[]` via `useMemo`, iterando mês a mês de `rangeIni` até `rangeFim` (inclusive, cruzando ano).
   - Derivar `anosEnvolvidos = unique(periodos.map(p => p.ano))`.

2. **Inputs De/Até** (linhas ~1211–1244): cada `Input type="date"` lê/escreve direto de `rangeIni`/`rangeFim` (parse explícito de `YYYY-MM` para evitar bug de timezone do `new Date(str)` mencionado na orientação interna). Se "Até" < "De", normalizar igualando os dois. Remover o `Select` de ano isolado (linhas 1245–1252) — passa a ser redundante.

3. **Botões rápidos** (linhas ~1272–1280): "Ano todo", "Até hoje", "Últimos 3 meses", "Limpar" passam a definir `rangeIni`/`rangeFim` em vez de `mesesSelecionados`. Adicionar também "Últimos 6 meses" e "Últimos 12 meses" para consistência com a aba Produtos.

4. **Grade visual de meses** (linhas ~1281–1312): substituir os 12 chips Jan–Dez por chips dinâmicos baseados em `periodosSelecionados`, rotulados como "Dez/25", "Jan/26", … Clicar num chip ajusta `rangeIni`/`rangeFim` (clipa a ponta mais próxima). Mantém o visual atual (pílulas com check).

5. **Queries**:
   - `pedidosAno` (linha 186): renomear para `pedidosPeriodo`. Buscar `gte` = 1º dia do `rangeIni`, `lte` = último dia do `rangeFim`. `queryKey` passa a depender de `rangeIni`/`rangeFim`.
   - `vendasManuais` (linha 218): trocar `.eq("ano", anoComparativo)` por `.in("ano", anosEnvolvidos)`.

6. **Agregação `dadosComparativoMensal`** (linhas 246–318):
   - Trocar `sistema: number[12]` / `manual: number[12]` por `Map<string /* "YYYY-MM" */, number>`.
   - Iterar `periodosSelecionados` para montar `valores`, `totais`, `media` na ordem correta. Parser de data dos pedidos: usar split manual de `YYYY-MM-DD` (evitar `new Date(str).getMonth()` que pode escorregar de mês por timezone).

7. **Tabela** (linhas 1322–1390):
   - Cabeçalho: iterar `periodosSelecionados`, render `Mmm/aa` (ex.: "Dez/25"). Continua alternando cores ímpar/par.
   - Linhas e linha "Total": idem, usando a chave `"YYYY-MM"` para puxar o valor.

8. **`salvarVendaManual`** (linhas 321–355): a função passa a receber `{ano, mes}` em vez de só `mes`. O `ano` do payload vem do próprio período da célula (não mais de `anoComparativo`). Atualizar a `CelulaMesEditavel` callback para passar o período.

9. **Mensagens de estado vazio** (linha 1319): "Selecione ao menos um mês" → "Selecione um período válido".

### Observações técnicas

- Nenhuma mudança de schema do banco. `vendas_historicas_manuais` já tem coluna `ano`, só passamos a buscar/gravar conforme o período da célula.
- Nenhuma mudança em RLS, edge functions, autenticação ou outras abas (Vendas, Pagamento, Produtos Vendidos).
- Aviso: parsing de datas vai usar split manual `"YYYY-MM-DD".split("-")` para evitar o problema documentado de `new Date(str)` interpretar errado em alguns engines.

### Arquivos afetados

- `src/pages/vendas/RelatorioVendas.tsx` (única alteração)



## Problema

As 30+ notas importadas existem no banco (NF-e março/2026, unidades Central Gás e Forte Gás), mas não aparecem na página `/contador/xmls` porque:

1. **Filtro de período errado**: a query filtra por `created_at` (data de importação), mas o seletor de período do contador representa o mês fiscal. Notas emitidas em **março/2026** ficam invisíveis quando o período ativo é abril (atual).
2. **Tabela atual não tem colunas pedidas**: falta CNPJ, agrupamento por dia, e nem todos os campos importados aparecem.

## Solução

### 1. Corrigir filtro (faz os dados aparecerem)
Em `src/pages/contador/ContadorXML.tsx` no `fetchNotas`:
- Trocar `.gte("created_at", ...).lte("created_at", ...)` por filtro em **`data_emissao`** (campo fiscal correto).
- Manter fallback: se `data_emissao` for NULL, considerar `created_at`.

### 2. Reformular a tabela de XMLs
Substituir a tabela plana atual por uma **tabela agrupada por dia de emissão**, com todos os dados do XML:

```text
┌─ 24/03/2026 ────────────────────────── 4 notas · R$ 7.216,36 ─┐
│ Tipo │ Nº/Série │ Chave │ CNPJ Emit. │ Emitente │ CNPJ Dest. │ Destinatário │ Loja │ Valor │ Ações │
│ NF-e │ 450 / 1  │ 3526… │ 55.191…/42 │ TEMGAS   │ 06.980…/36 │ NACIONAL GAS │Matriz│6.891  │ ⬇ 👁  │
│ ...                                                                                          │
└───────────────────────────────────────────────────────────────┘
┌─ 25/03/2026 ────────────────────────── 1 nota · R$ 115,00 ────┐
│ ...                                                                                          │
```

Colunas exibidas (todos os campos importados):
- Tipo (badge: NF-e/NFC-e/CT-e)
- Número / Série
- Chave de acesso (truncada com tooltip completo)
- CNPJ Emitente + Nome
- CNPJ Destinatário + Nome  
- Loja vinculada (`unidades.nome`)
- Data de emissão
- Valor total (formatado BRL)
- Status (badge: importado / pendente)
- Ações: baixar XML, ver detalhes

Cabeçalho de cada grupo: data + contagem + soma do dia.

### 3. Melhorias de UX
- Filtros já existentes (NF-e/NFC-e/CT-e/MDF-e) continuam funcionando sobre os grupos.
- Busca por chave/número/CNPJ/nome (estender para CNPJ).
- Resumo no topo: totalizadores por tipo no período.
- Esvazia o estado vazio só quando realmente não há nada após filtros.

### 4. Exportação
Atualizar colunas do `BotaoExportar` para incluir CNPJs (emit/dest), mantendo agrupamento por dia no PDF.

## Arquivos afetados

- `src/pages/contador/ContadorXML.tsx` — única alteração: troca do filtro (`data_emissao`), nova renderização agrupada por dia, novas colunas (CNPJs), busca estendida, totalizadores, e colunas extras na exportação.

Sem migrações, sem mudanças em edge functions. Os dados já estão corretos no banco — é só apresentação + filtro.


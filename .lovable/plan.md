

## Objetivo

Adicionar uma coluna **Data** na tabela de XMLs do contador (`/contador/xml`) e remover o agrupamento por dia, deixando uma listagem plana ordenada por data de emissão.

## Mudanças

### `src/pages/contador/ContadorXML.tsx`

1. **Remover agrupamento por dia**
   - Eliminar a estrutura `agrupados` que cria headers `▸ dd/MM/yyyy (n)` entre as linhas.
   - Remover o checkbox de seleção em massa por dia.
   - Renderizar todas as linhas da `notasFiltradas` em sequência única, ordenadas por `data_emissao DESC` (e por número como desempate).

2. **Adicionar coluna Data**
   - Inserir nova coluna `Data` como segunda coluna (logo após o checkbox de seleção), antes de `Tipo`.
   - Formato: `dd/MM/yyyy` usando `format(new Date(data_emissao), "dd/MM/yyyy")`.
   - Largura compacta (`w-[110px]`), alinhamento à esquerda, mesma tipografia das demais células.
   - Atualizar o `<TableHeader>` com o novo `<TableHead>Data</TableHead>`.

3. **Exportações (CSV/PDF)**
   - Acrescentar a coluna `Data` (`key: "data_emissao"`, com `format` para `dd/MM/yyyy`) na lista `colunas` enviada ao `BotaoExportar`.
   - Remover o `groupByPDF="data_emissao"` para o PDF sair plano também.

4. **Seleção**
   - Manter checkbox por linha e o "selecionar todos" no header da tabela (continua funcional sem o agrupamento).
   - Os botões "Baixar Selecionados" e "Gerar Lote ZIP" continuam operando sobre `selecionados`.

5. **Filtros e contadores**
   - Sem alterações no filtro de período/empresa/unidade/busca.
   - Cards de totais e banner do período permanecem como estão.

## Arquivos afetados

- `src/pages/contador/ContadorXML.tsx` — única alteração.

Sem migração, sem mudanças em outros componentes ou serviços.


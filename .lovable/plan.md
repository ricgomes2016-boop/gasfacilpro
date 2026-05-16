## Lançamento manual de vendas históricas (Comparativo Mensal)

Permitir editar diretamente as células da tabela comparativa produto × mês para registrar vendas de meses anteriores (importadas do sistema antigo), sem perder o histórico.

### Comportamento

- Cada célula de mês na tabela comparativa vira **clicável**.
- Ao clicar, abre um input inline para digitar a quantidade (ou faturamento, conforme métrica ativa).
- Ao salvar (Enter / blur), o valor é gravado no banco como ajuste manual daquele produto naquele mês/ano da unidade atual.
- A célula passa a mostrar **valor real do sistema + ajuste manual**, com um pequeno indicador (ex.: ponto/badge) sinalizando que há lançamento manual.
- Tooltip na célula mostra o detalhamento: "Sistema: X · Manual: Y · Total: Z".
- Linha de Total e coluna Média recalculam automaticamente incluindo os ajustes.

### Nova tabela: `vendas_historicas_manuais`

```text
id                uuid pk
empresa_id        uuid not null
unidade_id        uuid not null
produto_id        uuid not null  (FK produtos)
ano               int  not null
mes               int  not null  (1..12)
quantidade        numeric default 0
faturamento       numeric default 0
observacao        text
created_by        uuid
created_at, updated_at
UNIQUE (unidade_id, produto_id, ano, mes)
```

- RLS por `unidade_id` / `empresa_id` seguindo o padrão do projeto (payloads sempre incluem ambos).
- Política: somente usuários com acesso à unidade podem ler/inserir/atualizar/excluir.

### UI em `RelatorioVendas.tsx` (aba Produtos → Comparativo Mensal)

1. Carregar `vendas_historicas_manuais` filtradas por `unidade_id` e `ano = anoComparativo` em paralelo com `pedidosAno`.
2. No `useMemo` `dadosComparativoMensal`, somar o valor manual em cima do valor agregado dos pedidos por (produto, mês).
3. Cada `<TableCell>` de mês recebe:
   - Modo leitura: número + ícone discreto (ex.: `Pencil` no hover) + dot se há manual.
   - Modo edição: `Input` numérico com botão salvar/cancelar.
4. Salvar via upsert na nova tabela (`onConflict: unidade_id,produto_id,ano,mes`).
5. Após salvar: invalidar a query e mostrar `toast` de sucesso.

### Botão extra: "Importar histórico em lote"

Pequeno botão acima da tabela abre um modal com um grid simples (produto × 12 meses) para preencher rapidamente um ano inteiro de uma vez, com salvar único. Útil para migração inicial. Opcional na primeira entrega — pode ficar como fase 2.

### Exportações

- Excel/PDF da aba Comparativo Mensal já passam a refletir os totais ajustados (sem mudança extra além do dado consolidado).

### Fora do escopo

- Não altera `pedidos`, não cria pedidos fake.
- Não mexe nas outras abas do relatório.
- Não impacta DRE/financeiro/estoque — é apenas histórico de quantidade/faturamento para o comparativo.
- Sem importação por CSV nesta fase (pode vir depois).

### Técnico

- Migration: criar tabela + índices + RLS + trigger `updated_at`.
- Hook novo `useVendasHistoricasManuais(ano)` com `useQuery` + `useMutation` (upsert e delete quando valor = 0).
- Componente `CelulaMesEditavel` inline em `RelatorioVendas.tsx`.
- Tokens semânticos do tema (sem cores hard-coded). Inputs respeitam padrão mobile (16px) já em uso.



## Plano: Unificar contagem de transferências no Carregamento

### Problema
Existem dois contadores separados para a mesma coisa:
- **"Transferido (Rota)"**: vem do campo `quantidade_transferida` no `carregamento_rota_itens` — atualizado quando transferência é feita pelo app ou ERP (após fix recente)
- **"Transf. Filiais"**: vem de uma query separada na tabela `transferencias_estoque` — soma as quantidades dos itens de transferências com status `recebido`

Além disso, a transferência de 72 P13 para TemGas (feita pelo app antes do fix) não atualizou o `quantidade_transferida`, ficando só com 95 (Sertaneja).

### Solução

**1. Corrigir dado legado** — Atualizar o `quantidade_transferida` do carregamento do Flávio para 167 (95 + 72), refletindo ambas as transferências.

**2. Unificar os cards no resumo** (`GestaoRotas.tsx`)
- Remover o card separado "Transf. Filiais" e a query `fetchTransferencias`
- Manter apenas **um card "Transferido"** que usa o `quantidade_transferida` do `carregamento_rota_itens`
- Atualizar o cálculo de "Saldo Líquido" para usar apenas `totalSaida - totalTransferido`
- Isso funciona porque tanto app quanto ERP já atualizam o `quantidade_transferida` na mesma tabela

**3. Garantir que o app do entregador reflete o total correto**
- `EntregadorEstoque.tsx` e `EntregadorRotas.tsx` já usam `quantidade_transferida` — com o dado corrigido, passam a mostrar o valor correto automaticamente

### Arquivos
- `src/pages/operacional/GestaoRotas.tsx` — remover `transferidoFiliais`, `fetchTransferencias`, card duplicado, simplificar saldo líquido
- Migration de dados: UPDATE `carregamento_rota_itens` para somar os 72 que faltam


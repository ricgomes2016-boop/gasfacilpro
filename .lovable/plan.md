

## Plano: Separar vendas e transferências no carregamento e atualizar coluna Produtos

### Problema
Quando o entregador transfere produtos (ex: 210 para ABMF, 74 para Morumbi) e vende 54, a tabela **Gestão de Rotas** continua mostrando "0 vend." porque:
1. A tabela `carregamento_rota_itens` **não tem** coluna `quantidade_transferida`
2. O código de transferência (`EntregadorTransferencia.tsx`) **não atualiza** o carregamento ativo do entregador
3. A UI só mostra vendas, ignorando transferências

### Alterações

**1. Migration — Adicionar coluna `quantidade_transferida`**
```sql
ALTER TABLE carregamento_rota_itens 
  ADD COLUMN quantidade_transferida integer DEFAULT 0;
```

**2. EntregadorTransferencia.tsx — Atualizar carregamento ao transferir**
- Após inserir a transferência com sucesso, buscar o carregamento ativo do entregador
- Para cada item transferido, incrementar `quantidade_transferida` no `carregamento_rota_itens` correspondente

**3. GestaoRotas.tsx — Exibir vendas e transferências separadamente**
- Adicionar `quantidade_transferida` na interface `CarregamentoItem`
- Na coluna Produtos, exibir: `Gás P13 x600 (54 vend. | 284 transf.)`
- No resumo, adicionar card "Transferido" e ajustar "Saldo Líquido" = saída - vendido - transferido

**4. EntregadorEstoque.tsx — Considerar transferências no restante**
- Calcular: `restante = saída - vendida - transferida`
- Mostrar transferências separadamente na UI

### Arquivos modificados
- Nova migration SQL
- `src/pages/entregador/EntregadorTransferencia.tsx`
- `src/pages/operacional/GestaoRotas.tsx`
- `src/pages/entregador/EntregadorEstoque.tsx`


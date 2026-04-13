

## Plano: Abater transferências entre filiais do total P13 na Rota Atacado

### O que muda
Na aba "Rota Atacado" da Gestão de Rotas, o resumo de "Total Saída" e os totais de P13 devem descontar as quantidades que foram transferidas para filiais (registradas na tabela `transp_abastecimentos`).

### Como funciona hoje
- O resumo soma `quantidade_saida` de todos os `carregamento_rota_itens` no período filtrado
- Não considera transferências entre filiais

### Implementacao

**Arquivo: `src/pages/operacional/GestaoRotas.tsx`**

1. Adicionar query para buscar `transp_abastecimentos` no mesmo período de datas filtrado, filtrando pela `unidade_id` atual (como origem)
2. Somar `qtd_p13` das transferências no período
3. No card de resumo, adicionar um novo card "Transferido Filiais" mostrando o total transferido
4. Criar um campo calculado "Saldo Líquido" = Total Saída - Transferido para Filiais
5. Exibir esse saldo no resumo para dar visibilidade clara

### Detalhes
- A query filtra `transp_abastecimentos` onde `origem_unidade_id = unidadeAtual.id` e `data` entre as datas do filtro
- Soma apenas `qtd_p13` (campo inteiro direto na tabela)
- Grid de resumo passa de 5 para 6 cards (ou substitui conforme layout)
- Sem alterações de banco de dados


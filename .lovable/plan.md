<final-text>## Plano

### Diagnóstico encontrado
1. O app de entregas do entregador ainda busca só pedidos com status `pendente`, `em_rota` e `entregue`. Então qualquer venda criada como `finalizado` fica fora da aba Entregas, mesmo aparecendo no histórico.
2. A tela `EntregadorNovaVenda.tsx` ainda grava novas vendas com `status: "finalizado"`, o que mantém a inconsistência entre telas.
3. A tela `EntregadorTransferencia.tsx` calcula produtos disponíveis ignorando `quantidade_transferida`, então a lógica do saldo no app não está padronizada com ERP/estoque/rotas.
4. O ERP já mostra o cálculo na coluna Produtos em `GestaoRotas.tsx`, então o “sumiu” provavelmente é efeito de carregamento errado, filtro/status inconsistente ou transferência não entrando no carregamento correto.
5. A listagem de transferências e os resumos não estão totalmente padronizados entre ERP e app, então uma transferência pode aparecer em um fluxo e “sumir” em outro por filtro/status/contexto de unidade.

### O que vou implementar
1. **Padronizar status de venda para `entregue`**
   - Alterar `EntregadorNovaVenda.tsx` para salvar `status: "entregue"`.
   - Remover dependência de `finalizado` nas telas do entregador.
   - Ajustar labels/filtros ainda expostos com `finalizado` onde isso afeta pedidos.

2. **Corrigir atualização da aba Entregas no app**
   - Atualizar `EntregadorEntregas.tsx` para refletir o padrão novo e evitar exclusão de vendas feitas no app.
   - Revisar banner de pendências e filtros de tabs para não misturar estados legados com o fluxo atual.

3. **Padronizar saldo do carregamento em todo o sistema**
   - Garantir a mesma fórmula em todos os pontos:  
     `saldo = quantidade_saida - quantidade_vendida - quantidade_transferida`
   - Corrigir `EntregadorTransferencia.tsx` para considerar também `quantidade_transferida` ao listar itens ainda disponíveis para transferência.
   - Revisar `EntregadorEstoque.tsx`, `EntregadorRotas.tsx` e `GestaoRotas.tsx` para manter o mesmo comportamento.

4. **Restaurar consistência das transferências no ERP e app**
   - Revisar a origem dos dados em `TransferenciaEstoque.tsx` e `EntregadorTransferencia.tsx` para garantir que:
     - transferências da manhã para a Tem Gás continuem aparecendo,
     - status/filial/data não escondam registros válidos,
     - histórico e listagem usem o mesmo critério.
   - Se necessário, incluir atualização automática/reload consistente após criação/recebimento.

5. **Manter cálculo visível na coluna Produtos**
   - Preservar explicitamente em `GestaoRotas.tsx` a exibição:
     - saldo atual,
     - saída,
     - vendido,
     - transferido.
   - Evitar regressão caso algum carregamento venha com campos nulos.

6. **Tratar legado de dados**
   - Fazer um ajuste de compatibilidade para registros antigos com `finalizado`, para que não quebrem consultas enquanto o sistema migra para `entregue`.
   - Se houver necessidade, incluir uma atualização de dados existentes para unificar pedidos antigos.

### Arquivos principais
- `src/pages/entregador/EntregadorNovaVenda.tsx`
- `src/pages/entregador/EntregadorEntregas.tsx`
- `src/pages/entregador/EntregadorHistorico.tsx`
- `src/pages/entregador/EntregadorTransferencia.tsx`
- `src/pages/entregador/EntregadorEstoque.tsx`
- `src/pages/entregador/EntregadorRotas.tsx`
- `src/pages/operacional/GestaoRotas.tsx`
- `src/pages/estoque/TransferenciaEstoque.tsx`
- possivelmente `src/types/pedido.ts`, `src/hooks/usePedidos.ts` e componentes de status

### Validação depois da correção
1. Fazer uma nova venda no app do Flávio e confirmar:
   - aparece em **Entregas**,
   - aparece no **Histórico**,
   - abate em **Carregamento**,
   - abate em **Meu Estoque/Rotas**.
2. Conferir a transferência da Tem Gás e de Sertaneja no:
   - ERP,
   - app do entregador,
   - aba **Carregamentos**.
3. Confirmar na coluna **Produtos** do ERP que o cálculo voltou a aparecer como:
   - `saldo (saída - vend. - transf.)`.

### Observação técnica
Não vejo necessidade imediata de nova tabela. A correção é principalmente de **padronização de status**, **filtros de leitura**, e **cálculo de saldo** usando os campos já existentes.</final-text>
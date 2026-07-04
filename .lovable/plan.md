## Problema
Na tela `Pedidos` (`src/pages/vendas/Pedidos.tsx`), o menu **Ações** trata apenas `cancelado` e `entregue` como estados protegidos. Pedidos com status `finalizado` (gerado após o Acerto Diário do entregador) ainda exibem todas as opções de alteração — Editar, Transferir/Atribuir Entregador, Portaria, Marcar Em Rota / Entregue / Pendente, Cancelar, Excluir, Editar Agendamento, Transferir p/ Filial.

Isso permite mexer em pedidos cujo acerto financeiro com o entregador já foi realizado, corrompendo o fechamento.

## Solução
Bloquear no menu Ações (versões desktop e mobile) todas as opções que alteram o pedido quando `status === "finalizado"`, mantendo apenas as leituras/impressões:

**Permanecem visíveis para `finalizado`:**
- Visualizar
- Imprimir
- WhatsApp
- Comprovante de Entrega (PDF)
- Transferir p/ Filial? → **não**, pois altera unidade do pedido pós-acerto → **bloquear**

**Ficam ocultas para `finalizado`:**
- Editar pedido
- Editar agendamento
- Atribuir/Transferir Entregador
- Portaria (Retirada)
- Transferir p/ Filial
- Marcar Em Rota / Entregue / Voltar p/ Pendente
- Cancelar Pedido
- Excluir

Aplicar a mesma regra também na ação de troca de status pela `StatusDropdown`/`alterarStatusPedido` como salvaguarda (early-return com toast "Pedido finalizado no acerto — alterações bloqueadas") caso algum caminho residual dispare.

## Arquivos alterados
- `src/pages/vendas/Pedidos.tsx`
  - Criar helper local `isPedidoBloqueado(status) = ["cancelado","entregue","finalizado"].includes(status)`.
  - Substituir as condições atuais `status !== "cancelado" && status !== "entregue"` nos dois blocos de `DropdownMenuContent` (desktop ~linhas 1057-1086 e mobile ~linhas 1216-1254) por `!isPedidoBloqueado(pedido.status)`.
  - Aplicar também no bloco "Transferir p/ Filial" (condicionar a `!isPedidoBloqueado`).
  - Aplicar no botão "Excluir" (bloquear quando `finalizado` — exclusão pós-acerto quebra conciliação).
  - Em `alterarStatusPedido` e `cancelarPedido`: se `pedido.status === "finalizado"`, exibir toast e retornar.

## Escopo
Somente UI de guardas do menu Ações da tela Pedidos. Sem alterar hooks, RLS, ou regras de acerto/estoque.
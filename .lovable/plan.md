## Problema

No `src/pages/caixa/AcertoEntregador.tsx`, o "Resumo Automático do Acerto" agrupa as entregas por `forma_pagamento` exatamente como está salvo no pedido. Como os pedidos têm valores inconsistentes ("Dinheiro" vs "dinheiro", "Vale Gás" vs "vale_gas", "cartao" sem crédito/débito, "outros"), o resumo mostra a mesma forma duas vezes e ainda exibe formas que não existem oficialmente.

## Objetivo

1. Unificar variações da mesma forma (case/acento/snake_case) em uma única linha.
2. Sinalizar e bloquear o acerto quando houver forma inválida:
   - `outros`, vazio, ou qualquer string fora da lista oficial.
   - `cartao` / `cartão` genérico (sem crédito ou débito definido).
3. Mostrar Cartão sempre como **Cartão Crédito** ou **Cartão Débito** (nunca "Cartão" puro).

## Mudanças (apenas frontend)

### `src/pages/caixa/AcertoEntregador.tsx`

**a) Nova função `canonicalForma(raw)`** (perto de `normalizarFormaPagamento`, linha ~465):
- Mapeia variações para chaves canônicas: `dinheiro`, `pix`, `pix_maquininha`, `cartao_credito`, `cartao_debito`, `cheque`, `vale_gas`, `fiado`.
- Retorna `"__invalido__"` para: vazio, `outros`, `cartao`/`cartão` puro, ou qualquer valor não reconhecido.
- Trata também strings de pagamento múltiplo (`"Múltiplos: Dinheiro R$10, Cartão Débito R$5"`) somando por canônico.

**b) Refatorar `metricas` (linha 429)**:
- Em vez de `porForma[e.forma_pagamento]`, percorrer cada entrega, dividir múltiplos pagamentos quando aplicável, classificar via `canonicalForma` e somar em `porFormaCanonica`.
- Coletar lista `entregasInvalidas: { id, forma_original, valor }[]` para itens que caíram em `__invalido__`.

**c) Resumo Automático (linha ~858)**:
- Renderizar `porFormaCanonica` (já sem duplicatas) usando `paymentLabels`.
- Abaixo, se `entregasInvalidas.length > 0`, mostrar bloco vermelho:
  > ⚠️ N entrega(s) com forma de pagamento inválida ("outros", "cartao", etc.). Edite cada pedido e selecione Cartão Crédito ou Cartão Débito antes de confirmar.
  - Listar cada uma com botão "Editar" que abre o `editingEntrega` existente.

**d) Bloquear confirmação (linha ~895 e função `confirmarAcerto` linha 480)**:
- Desabilitar botão "Confirmar Acerto" quando `entregasInvalidas.length > 0` (com tooltip explicativo).
- Em `confirmarAcerto`, validar antes do loop e dar `toast.error` se houver inválidas.

**e) Card "Dinheiro em espécie a receber" (linha 880)**:
- Passar a usar `porFormaCanonica["dinheiro"]` (chave única), eliminando o fallback `|| porForma["Dinheiro"]`.

## Não muda

- Schema do banco, RLS, roteamento de pagamentos (`rotearPagamentosVenda`), modal de edição, tabelas de detalhes — tudo permanece igual.
- A edição já existente do pedido (`editingEntrega`) é o caminho para o usuário corrigir as formas inválidas.

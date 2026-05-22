# Venda Antecipada com Vales Numerados (Uso Pessoal)

Hoje a Venda Antecipada guarda apenas um valor monetário. Vou evoluí-la para registrar **produtos e quantidades**, gerando **1 vale numerado com QR Code por unidade** (igual ao fluxo do Vale Gás), permitindo retiradas **parciais** ao longo do tempo.

## Mudanças no banco

**Tabela `vendas_antecipadas` (adicionar):**
- `numero_sequencial` (int) — número da venda antecipada (por empresa)
- `total_unidades` / `unidades_retiradas` — controle agregado
- Status passa a ser calculado: `ativo` | `parcial` | `concluido` | `cancelado`

**Nova tabela `vendas_antecipadas_itens`:**
- `venda_antecipada_id`, `produto_id`, `produto_nome`, `quantidade`, `valor_unitario`, `valor_total`, `quantidade_retirada`

**Nova tabela `vendas_antecipadas_vales` (1 linha por unidade):**
- `venda_antecipada_id`, `item_id`, `produto_id`, `produto_nome`
- `numero` (sequencial dentro da venda, ex: 1/4, 2/4…)
- `codigo` único para o QR (ex: `VA-2026-00042-01`)
- `valor_unitario`
- `status`: `disponivel` | `retirado` | `cancelado`
- `data_retirada`, `retirado_por` (entregador/operador), `pedido_id`
- `cliente_id`, `unidade_id`, `empresa_id`

RLS por `unidade_id`/`empresa_id` (mesmo padrão das outras tabelas). Trigger para preencher `empresa_id` a partir da unidade. Função RPC `consumir_vale_venda_antecipada(codigo, pedido_id, retirado_por)` análoga a `consumir_vale_empenho`.

## Mudanças na UI — `/financeiro/venda-antecipada`

**Novo modal "Nova Venda Antecipada":**
- Busca de cliente (já existe)
- Lista dinâmica de itens: produto (Select dos produtos da unidade) + quantidade + valor unitário → calcula valor total automaticamente
- Forma de pagamento, validade, observações
- Ao salvar: cria venda + itens + N vales numerados (um por unidade) com códigos únicos

**Tela de detalhe da venda antecipada:**
- Resumo: cliente, total pago, total retirado, saldo de unidades
- Tabela de vales com status (disponível / retirado / cancelado)
- Botão **"Imprimir todos QR Codes"** (folha A4 com vários por página) e botão de QR individual (reaproveita `ValeGasQRCode`)
- Botão "Retirar manualmente" por vale (baixa pelo operador no ERP)

**Listagem principal:**
- Mostra número da venda, cliente, produtos resumidos (ex: "4× P13, 2× Água"), unidades retiradas/totais, status colorido

## Validação da retirada

**No app do entregador:** adiciono leitura do QR no scanner existente. Se o código bater com `VA-…`, chama a RPC `consumir_vale_venda_antecipada` (vincula ao pedido em curso, marca o vale como retirado).

**No ERP:** botão "Retirar" em cada vale da tela de detalhe, mesma RPC.

## Componente QR Code

Generaliza o `ValeGasQRCode` em um `ValeQRCode` reutilizável (parâmetro de título/logo), evitando duplicação. O fluxo de impressão em lote usa um modal com grid de QRs (3 colunas × N linhas) e CSS de impressão.

## Detalhes técnicos

- Códigos: `VA-{ano}-{numero_venda 5d}-{numero_vale 2d}` — único globalmente
- `numero_sequencial` da venda calculado por trigger (igual `fn_assign_numero_pedido`)
- Saldo monetário atual (`valor_pago`/`valor_utilizado`) é mantido por compatibilidade, mas a tela passa a operar por **unidades**
- RPC valida tenant (`empresa_id` do usuário) antes de marcar como retirado, retorna erro se já retirado/cancelado
- Realtime opcional para atualizar lista de vales quando entregador escaneia

## Fora de escopo deste plano
- Integração com estoque (baixa automática ao retirar) — pode ser adicionada depois
- Pagamento parcelado da venda antecipada

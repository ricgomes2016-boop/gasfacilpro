## Objetivo

Adicionar captura de **assinatura digital do canhoto** na tela `FinalizarEntrega.tsx` (app do entregador) antes de marcar o pedido como `entregue`, com valor jurídico de **assinatura eletrônica simples** (MP 2.200-2 art. 10 §2º).

A infra já está pronta: tabela `comprovantes_entrega` e bucket `comprovantes-entrega` foram criados na etapa anterior.

## Escopo

### 1. Nova dependência
- `react-signature-canvas` (~30kb) + `@types/react-signature-canvas`

### 2. Novo componente `AssinaturaCanhotoCard`
Arquivo: `src/components/entregador/AssinaturaCanhotoCard.tsx`

- Canvas de assinatura (touch + mouse) com botões **Limpar** e **Confirmar**
- Campo **Nome de quem recebeu** (obrigatório)
- Campo **CPF/RG** (opcional)
- Toggle **"Cliente recusou assinar"** (libera finalização sem canvas, mas exige motivo)
- Captura automática de **geolocalização** (lat/lng) e **timestamp** no momento do "Confirmar"
- Exibe miniatura quando assinada + botão "Refazer"
- Props: `onChange(payload | null)`, `obrigatorio?: boolean`

### 3. Integração em `FinalizarEntrega.tsx`
- Renderizar `<AssinaturaCanhotoCard />` logo acima do botão "Finalizar Entrega"
- Configuração: ler `regras_cadastro.assinatura_entrega_obrigatoria` (default `false`) — se `true`, bloqueia botão sem assinatura/recusa
- Em `finalizarEntrega()`, após o `update` do pedido para `entregue`:
  1. Converter dataURL PNG da assinatura para Blob
  2. Upload em `comprovantes-entrega/{pedido_id}-{timestamp}.png`
  3. Insert em `comprovantes_entrega` com: `pedido_id`, `unidade_id` (trigger preenche `empresa_id`), `assinatura_url`, `recebedor_nome`, `recebedor_documento`, `latitude`, `longitude`, `recusou_assinar`, `motivo_recusa`, `assinado_em`
- Em caso de falha no upload da assinatura, **não reverte** o pedido (já entregue) — apenas toast de aviso e log para reprocesso manual

### 4. Visualização (consulta posterior)
- Em `src/pages/vendas/PedidoDetalhes.tsx` (ou similar): se existe `comprovantes_entrega`, mostrar card "Comprovante de Entrega" com imagem da assinatura, nome do recebedor, data/hora e mini-mapa com coordenadas
- Botão "Baixar PDF" gera comprovante via `pdf-lib` no cliente com: logo da empresa, dados do pedido, itens, valor, assinatura, geolocalização e timestamp

## Fora de escopo
- Foto adicional do cliente recebendo (pode ser adicionado depois reaproveitando o input de comprovante já existente)
- Assinatura A1/ICP-Brasil (sem valor adicional para canhoto de entrega)
- Tela dedicada `/entregador/entrega/:id/assinar` — integramos inline para reduzir fricção

## Ordem de execução
1. `bun add react-signature-canvas @types/react-signature-canvas`
2. Criar `AssinaturaCanhotoCard.tsx`
3. Integrar em `FinalizarEntrega.tsx` (render + payload no submit)
4. Card de visualização em `PedidoDetalhes` + geração de PDF

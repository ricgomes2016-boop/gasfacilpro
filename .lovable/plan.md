## Problema

Em **Gestão Financeira → Vale Gás → Emissão**, ao emitir um lote, o cupom gerado (`CupomPrint` em `src/pages/financeiro/ValeGasEmissao.tsx`) sai só em texto monoespaçado, sem QR Code. Já o vale do empenho usa `src/components/valegas/ValeGasQRCode.tsx`, que tem layout bonito com QR Code grande, valor destacado e instrução de uso. O objetivo é deixar os cupons da emissão visualmente equivalentes, com QR Code escaneável pelo entregador.

## O que será feito

Apenas frontend, sem mexer em banco, contexto, regras de negócio ou no fluxo de emissão.

### 1. `src/pages/financeiro/ValeGasEmissao.tsx` — refatorar `CupomPrint`

- Importar `QRCodeSVG` de `qrcode.react` (já usado no projeto) e renderizar o QR Code de cada cupom dentro de um container oculto (`ref`) para extrair o SVG no momento da impressão, igual ao padrão de `ValeGasQRCode.tsx`.
- Para cada vale selecionado, gerar o SVG do QR a partir de `c.codigo` (mesmo valor usado no QR público) e injetar o `outerHTML` no HTML da `printWindow`.
- Reescrever o CSS/HTML do cupom impresso usando o mesmo visual de `ValeGasQRCode.tsx`:
  - Card com borda arredondada, header com nome da unidade/descrição, QR Code centralizado (~180px), número do vale em destaque, código monoespaçado, valor grande em verde, dados do parceiro/cliente/produto abaixo e rodapé com instrução "Apresente este QR Code ao entregador…".
  - Manter `page-break-inside: avoid` e `@page { margin: 10mm }` para impressão em lote.
- Manter a lista de seleção (checkbox por vale) e o botão "Imprimir (n)" como já existem.
- Adicionar prévia visual de **um** cupom (o primeiro selecionado) acima da lista, renderizando o mesmo layout em tela com `QRCodeSVG`, para o usuário ver como vai sair antes de imprimir.
- Escapar valores dinâmicos no HTML (reaproveitar helper `escapeHtml` de `src/lib/escapeHtml.ts`) para evitar quebra de markup.

### 2. Reimpressão de lote já existente

A função `handleReimprimirLote` continua chamando o mesmo `CupomPrint`, então automaticamente passa a imprimir com QR Code — nenhuma mudança adicional necessária.

## Fora do escopo

- `ValeGasQRCode.tsx`, `ValeGasControle`, `ValeGasAcerto`, contexto `ValeGasContext`, RLS, edge functions, banco, `App.tsx`, rotas.
- Mudança no código/numeração dos vales — o QR continua codificando exatamente `c.codigo` (`VG-AAAA-NNNNN`), que já é o identificador validado pelo fluxo de venda pública.

## Arquivos

- **Editar:** `src/pages/financeiro/ValeGasEmissao.tsx`

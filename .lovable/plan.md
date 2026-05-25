## Ajustar marca d'água dentro do quadro de assinatura (Orçamento Padrão)

**Arquivo:** `src/services/orcamentoPadraoPdfService.ts` (linhas 219-255)

### Problema
O quadro de assinatura tem 18mm de altura, mas a inicial (marca d'água) é renderizada com fonte ~46pt (≈16mm), que visualmente "estoura" o quadro e some atrás da linha de assinatura, parecendo estar fora.

### Mudanças
1. **Aumentar o quadro** para `sigBoxH_mm = 32mm` (largura mantida em 140mm) para acomodar a marca d'água + linha de assinatura **dentro** do quadro.
2. **Calibrar a inicial** para caber confortavelmente dentro: `fs = Math.min(70, sigBoxH_mm * 2)` e desenhar centralizada no quadro.
3. **Mover a linha de assinatura para dentro do quadro**, próxima à base (ex.: `sigBoxY + sigBoxH - 6mm`), com margens laterais internas (`sigBoxX + 10` até `sigBoxX + sigBoxW - 10`).
4. **Rótulo "ASSINATURA (fornecedor)"** permanece logo abaixo do quadro (fora dele).
5. Manter opacidade 0.12, cor azul e GState reset como já está.

### Fora de escopo
- Não alterar metadados de assinatura digital, carimbo da unidade, cabeçalho, tabela de itens, observações ou outras seções.
- Não tocar em `ValeGasEmissao`, `Orcamentos.tsx`, RLS, edge functions ou rotas.

## Objetivo

Substituir a marca d'água atual (texto "ASSINADO DIGITALMENTE" / "ORÇAMENTO") por uma marca d'água em estilo Adobe: a **primeira letra** do nome da unidade (ou empresa, como fallback) renderizada em tamanho gigante, centralizada na página, com aparência de inicial monumental.

## Onde alterar

Apenas `src/services/orcamentoFundeparPdfService.ts`, dentro da função `gerarFundeparPdf`, no bloco da marca d'água que adicionamos por último.

Os dados da unidade/empresa já são carregados em `fetchFornecedor()` e expostos em `f.nome_fantasia` / `f.razao_social`. Vou reutilizar esses campos sem nova query.

## Lógica

1. Determinar a inicial:
   - Pegar `f.nome_fantasia` (ou `f.razao_social` como fallback).
   - Remover espaços/artigos iniciais e extrair o primeiro caractere alfanumérico.
   - `toUpperCase()`. Se vazio → usar `"●"` como fallback neutro.

2. Renderizar em cada página (loop `pageCount` já existe):
   - Fonte: `helvetica` bold (única fonte vetorial garantida no jsPDF; serif/Times também está disponível e dá visual mais "Adobe" — usar `times` bold para um traço mais clássico).
   - Tamanho: ~260pt para ocupar boa parte da página A4.
   - Opacidade: ~0.07 via `GState` (já temos esse padrão).
   - Cor: cinza neutro `(120,120,120)` independente de assinatura — a info "assinado" fica no carimbo PAdES e no card da tela.
   - Sem rotação (estilo Adobe inicial é vertical, não diagonal).
   - Posição: centro horizontal e vertical da página, com pequeno ajuste de baseline para a letra ficar opticamente centrada.

3. Manter o reset de `GState` e `setTextColor(0,0,0)` ao final do loop (como já está) para não vazar estilo para conteúdos futuros.

## Observações

- Nada muda na tela do modal nem em outros PDFs (recibo, comprovante, declaração).
- Não há mudança de dados, RLS, rotas ou estrutura — só ajuste visual no gerador do PDF Fundepar.
- A marca d'água passa a ser a mesma independentemente de o orçamento ser assinado ou não, conforme o pedido (estilo Adobe = inicial da empresa).

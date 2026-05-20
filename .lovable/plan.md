## Problema

No orçamento da Forte Gás (Colégio Militar), o campo "Observações" preenchido na tela não aparece no PDF gerado. Verifiquei `src/services/orcamentoFundeparPdfService.ts`: a propriedade `observacoes` existe na interface `FundeparPdfData`, é repassada pelas telas que chamam `imprimirFundepar`, mas o gerador do PDF nunca desenha esse conteúdo.

## Ajuste

Em `src/services/orcamentoFundeparPdfService.ts`, dentro de `gerarFundeparPdf`, após o `autoTable` de itens e antes do bloco da data por extenso:

1. Se `d.observacoes` estiver preenchido (trim não vazio):
   - Adicionar um pequeno espaçamento.
   - Escrever rótulo em negrito "Observações:" (fonte 10).
   - Quebrar o texto com `doc.splitTextToSize(d.observacoes, larguraÚtil)` respeitando as margens (14mm de cada lado).
   - Desenhar as linhas em fonte normal 9-10, atualizando `y` linha a linha (~4mm cada).
   - Garantir `doc.addPage()` caso `y` ultrapasse a área útil antes de seguir para o bloco de data/assinatura/carimbo (manter o layout atual quando couber tudo na mesma página, que é o caso comum).

2. Não alterar nenhuma outra seção (cabeçalho, tabela, assinatura, carimbo, fluxo de assinatura digital).

## Escopo

- Arquivo único: `src/services/orcamentoFundeparPdfService.ts`.
- Nenhuma mudança em telas, banco, RLS, edge functions ou tipos.
- Sem mexer no fluxo de assinatura PAdES (a posição da linha de assinatura continua sendo calculada pelo `y` corrente, então funciona naturalmente após o bloco de observações).

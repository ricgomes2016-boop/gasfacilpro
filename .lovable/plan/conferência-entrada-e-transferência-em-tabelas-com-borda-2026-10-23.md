# Conferência: Entrada e Transferência em tabelas com borda

## Entrada em DD/MM (card com borda, igual à tabela de contagem)
- Título: **Entrada em 23/10** (data da contagem selecionada).
- Linhas: uma por loja. Colunas: Loja | P13 (Cheio, Vazio, Total) | P20 | P45 | Água.
- **Cheio**: digitado (entrada manual do dia), sem perguntar início/fim.
- **Vazio**: automático = −cheio (entrou 100 cheios, saem 100 vazios). Só leitura.
- **Total**: cheio + vazio (fica 0, mostrando que o vasilhame total não muda).
- Transferências recebidas de outras lojas aparecem somadas no Cheio da loja destino, com indicação "recebido de ...".
- Botão "Salvar entradas" grava todas as lojas de uma vez.
- Some o formulário atual com selects de loja/produto.

## Transferência em DD/MM (card com borda, em tabela)
- Título: **Transferência em 23/10**.
- Acima da tabela: **Loja de origem** (no portal, já vem a loja autorizada do conferente; se tiver só uma, fixa).
- Linhas: todas as lojas da empresa (exceto a origem). Colunas: Loja | P13 (Cheio, Vazio) | P20 | P45 | Água.
- O conferente digita no **Cheio** da loja para onde enviou (ex.: linha Colgas Ibaiti, P13 Cheio = 62).
- **Vazio** automático: a mesma quantidade volta de vazio da loja destino para a origem.
- Efeito automático:
  - Origem: cheio −62, vazio +62.
  - Destino (Ibaiti): cheio +62 aparece na Entrada dela, vazio −62.
- Botão "Salvar transferências" grava tudo; corrigir é só alterar o número (0 remove).
- A janela de transferência atual deixa de ser usada.

## Ordem da tela (mantida)
Data da contagem → Tabela de contagem → Entrada → Transferência → Venda do dia.

## Detalhes técnicos
- `ConferenciaEstoque.tsx`: substituir as seções atuais de Entrada/Transferência por dois `SectionCard` com tabelas no mesmo estilo da tabela de contagem (cabeçalho sticky da coluna loja, cards por loja no celular).
- Entrada continua em `estoque_conferencia_movimentos` tipo `entrada_manual` (upsert por dia+loja+grupo). Transferência: um registro `transferencia` por origem+destino+grupo+dia; salvar faz upsert/remoção quando 0 (sem mudança de tabela; se faltar índice único, migração só adiciona índice).
- Vazios da entrada e da transferência são derivados (não gravados): `conferenciaFluxo.ts` ganha função para saldo de vazios considerando entrada (−q), transferência enviada (+q) e recebida (−q), com testes (ex.: Usagas → Ibaiti 62).
- Portal: Edge Function aceita salvar em lote (`entries`, `transfers`) com as mesmas validações (origem autorizada, destino mesma empresa e ativo, inteiro ≥ 0).
- Datas pelo dia físico, regra atual mantida.

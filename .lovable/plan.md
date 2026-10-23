# Conferência de Estoque: nova ordem dos blocos

## Nova ordem da tela (de cima para baixo)

1. Card **Data da contagem**
2. **Tabela de contagem** (cheio/vazio por loja)
3. Card **Entrada**
4. Card **Transferência para filial**
5. Card **Venda do dia** (fluxo Inicial → Entradas → Transferências → Contagem → Venda)

## Pergunta "início ou final do dia"

- Aparece somente ao clicar no campo **Cheio** da tabela de contagem.
- Campo **Vazio**, Entrada e Transferência não perguntam mais: usam diretamente a data da contagem selecionada.
- Os campos de Entrada e Transferência ficam liberados sem precisar escolher o momento.

## Detalhes técnicos

- `ConferenciaEstoque.tsx`: mover a section "Entrada/Transferência" e a tabela/cards mobile para logo após o card de data; mover a section "Fluxo do dia de venda" para o fim.
- Remover `pedirMomento`/checagens de `momentoConfirmado` em `registrarEntrada`, `abrirTransferencia`, `registrarTransferencia`, input de entrada e botão Transferir.
- Na tabela, manter `readOnly`/`onFocus` de momento só nos inputs de cheio; vazio fica editável normalmente, mas salvar contagem continua exigindo momento confirmado (pergunta abre se ainda não escolhido).
- Lógica de datas (movimentos pela data física) inalterada.

# Entrada e Transferência mais fáceis de ler no celular

## O que muda
- No celular, a coluna "Lojas" das tabelas **Entrada** e **Transferência** fica bem mais estreita (cerca de 96px em vez de 220px), com letra um pouco menor e o nome da loja quebrando em duas linhas se precisar. Assim sobra espaço para ver P13, P20, P45 e Água.
- Ela continua fixa ao rolar para o lado, para você saber sempre de qual loja é a linha.
- O rótulo "Matriz/Filial" vira uma linha pequena abaixo do nome.
- No computador nada muda: a coluna continua com 220px, igual à tabela de contagem.
- O mesmo ajuste também vale para a tabela de Contagem no celular, para as três ficarem iguais.

## Detalhes técnicos
- Em `ConferenciaEstoque.tsx`, `COL_LOJAS` passa a ser responsivo: `w-[96px] min-w-[96px] max-w-[96px] sm:w-[220px] sm:min-w-[220px] sm:max-w-[220px]`.
- Células de loja: `px-1.5 text-xs sm:px-2 sm:text-sm break-words leading-tight`; cabeçalho "Lojas" `text-xs sm:text-base`.
- Verificar com Playwright em 384px de largura que P13 aparece ao lado da coluna fixa.

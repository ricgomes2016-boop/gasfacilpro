# Conferência de Estoque — coluna Total por produto e cards detalhados

## O que muda
1. **Tabela (computador e celular):** em P13, P20, P45 e Água, ao lado de "Cheio" e "Vazio" entra uma coluna **Total** (cheio + vazio), calculada sozinha e sem edição, que mostra o total de vasilhames de cada produto por loja.
2. **Linha de totais no fim da tabela**, com a soma de todas as lojas selecionadas por coluna.
3. **Aviso de referência:** o título da tabela e os cards mostram "Saldo inicial do dia DD/MM/AAAA", para deixar claro que a contagem é a do começo do dia.
4. **Cards de cima** (Cheios, Vazios, Total): cada card continua com o número geral e passa a mostrar a quantidade de cada produto, por exemplo:
   - Cheios: 186 P13 · 2 P20 · 6 P45 · 20 Água
   - Vazios: a mesma divisão
   - Total: cheio + vazio de cada produto

O salvamento continua igual: só cheio e vazio são gravados; o total é só exibido.

## Detalhes técnicos
- Arquivo: `src/pages/estoque/ConferenciaEstoque.tsx`.
- `resumo` passa a acumular por grupo (`porGrupo[key].cheio/vazio`) com `useMemo`.
- Cabeçalho: `colSpan` do grupo de 2 para 3, subcoluna "Total"; `colSpan` geral de 9 para 13.
- Células Total somente leitura, em destaque; linha `tfoot` com os totais gerais.
- Layout do celular: um bloco "Total" em cada produto.

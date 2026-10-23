# Conferência de estoque: fluxo do dia claro e profissional

## Regra padrão
Cada dia de venda tem um fluxo fechado:

```text
Dia 22/10
  Inicial (contagem do início de 22/10 ou do fim de 21/10)   812
+ Entradas de 22/10                                          456
= Total disponível                                         1.268
- Transferências de 22/10 (VJ Gás)                            62
= Disponível para venda                                    1.206
- Contagem de fechamento (fim de 22/10 ou início de 23/10) 1.099
= Venda de 22/10                                             107
```

- A contagem do **início de 23/10** fecha a venda de **22/10** e vira o **inicial de 23/10**.
- Entradas e transferências feitas em **23/10** entram só no fluxo de **23/10**, cuja venda sai na contagem do fim de 23/10 ou início de 24/10.

## O que muda na tela
1. **Seletor "Dia de venda"** no topo (ex.: 22/10), com o fluxo acima mostrado por produto em uma linha do tempo de 7 passos, com a venda em destaque verde.
2. **Estoque de abertura**: inicial do dia vem da contagem anterior (início do dia ou fim do dia anterior), sem precisar digitar; Master ainda pode ajustar.
3. **Entradas e transferências** registradas sempre no dia em que aconteceram, com rótulo "Entrada de 23/10".
4. **Contagem de fechamento**: a pergunta "início ou final do dia?" continua; o sistema mostra "Esta contagem fecha a venda de 22/10 e abre o dia 23/10".
5. Status do dia: "Aberto" (sem contagem de fechamento) ou "Fechado" com a venda.
6. Cards do topo reorganizados: Inicial, Entradas, Transferências, Fechamento, Venda — por produto (P13, P20, P45, Água).
7. Visual mais limpo no celular e no computador, mantendo a tabela simples (cheio/vazio/total) para quem não é Master.

## Detalhes técnicos
- Primeiro passo: confirmar em `ConferenciaEstoque.tsx` e na função `estoque-conferencia-portal` qual data é usada hoje para gravar/ler `estoque_conferencia_movimentos` e `estoque_conferencia_fechamentos`.
- Movimentos indexados pela data real do acontecimento (= dia de venda); contagem de início de D é fechamento de D−1 e abertura de D (já existe em `datasApuracao`).
- Inicial de D = ajuste Master de D, senão fechamento de D−1.
- Nova `calcularFluxoDia` em `conferenciaFluxo.ts` com teste 812 + 456 − 62 − 1099 = 107 e teste de que entrada de 23/10 não altera a venda de 22/10.
- Nada é apagado; contagens já salvas continuam valendo.

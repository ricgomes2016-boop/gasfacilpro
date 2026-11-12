# Relatórios em planilha na Conferência de Estoque

## O que o usuário verá
Novo botão **Relatórios** no topo da Conferência (ao lado de Histórico), para Master e conferentes. Abre uma janela com:
- **Tipo**: Entradas, Vendas ou Transferências recebidas
- **Período**: data inicial e final (padrão: mês atual)
- **Loja**: uma loja ou todas (conferente vê só as lojas liberadas para ele)
- Prévia na tela e botão **Baixar planilha (Excel)**

## Colunas de cada planilha
- **Entradas**: Data | Loja | Produto (P13, P20, P45, Água) | Quantidade (cheios)
- **Vendas**: Data da venda | Loja | Produto | Quantidade — venda apurada pela mesma regra da tela (inicial + entradas − transferências enviadas − fechamento; contagem de início do dia fecha a venda do dia anterior)
- **Transferências recebidas**: Data | Loja que recebeu | Loja de origem | Produto | Quantidade

Cada planilha termina com linha de total por produto. Dias sem contagem de fechamento aparecem como "sem fechamento" nas vendas, em vez de um número errado.

## Detalhes técnicos
- Nova função pura `src/lib/estoque/conferenciaRelatorios.ts` que monta as linhas a partir de movimentos, contagens e ajustes de saldo, reutilizando `calcularFluxoDia`/`resolverSaldoInicial`/`datasApuracao`.
- Portal: nova ação `report` na Edge Function `estoque-conferencia-portal`, validando usuário e lojas autorizadas no servidor (limite de 186 dias). ERP: leitura direta com RLS existente.
- Componente `RelatoriosConferenciaDialog.tsx` (ResponsiveDialog), exportação com `xlsx` já usado na tela.
- Testes em `conferenciaRelatorios.test.ts`: exemplo 812 + 456 − 62 − 1099 = 107 de venda em 22/10; entrada 187 em 23/10 aparece em 23/10; transferência 36 Usagas→Sertaneja aparece como recebida pela Sertaneja.

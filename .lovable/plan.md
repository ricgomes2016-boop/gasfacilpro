## Análise

Encontrei três problemas principais na tela `/caixa/acerto`:

1. **Erro 400 na consulta de pedidos**
   - A requisição do console mostra um filtro inválido enviado ao backend: `valor...=lte.2026-06-12`.
   - Isso indica que alguma consulta/filtro de pedidos está sendo montada com coluna errada ou parâmetros desalinhados.

2. **Resumo automático com valores impossíveis**
   - O card mostra, por exemplo, cartão débito/crédito/PIX com `QTD 0` e valores enormes, enquanto o total final é pequeno.
   - A causa provável está no parser de pagamentos múltiplos: valores como `R$5.000,00` podem ser lidos errado em alguns fluxos, e a contagem por forma compara a forma original com a chave normalizada, por isso fica `0`.

3. **Avisos de acessibilidade em Dialog**
   - Há avisos de `DialogContent requires DialogTitle` / `Missing Description` no console.
   - Na própria tela de acerto existe `DialogTitle`, mas falta descrição; também vou revisar os diálogos acionados nessa rota para eliminar o aviso quando vier desta tela.

## Plano de correção

1. **Blindar o cálculo do resumo automático**
   - Criar um parser único e seguro para valores BR (`R$ 1.587,56`, `1587.56`, `1.587,56`).
   - Usar esse parser tanto em `metricas` quanto em `confirmarAcerto` e `abrirEdicao`.
   - Corrigir a contagem (`QTD`) por forma de pagamento para contar formas normalizadas, inclusive pagamentos múltiplos.
   - Garantir que percentuais sejam calculados somente sobre o total real das vendas e não gerem números acima de 100% quando o total estiver correto.

2. **Corrigir filtros de canais e período**
   - Manter `unidade_id` obrigatório em todas as consultas da tela.
   - Ajustar a filtragem de Portaria/PDV/Gás do Povo sem gerar URL inválida e sem misturar pedidos entre canais.
   - Revisar a origem do erro 400 para impedir que `valor` receba data por engano em consultas de pedidos usadas na tela.

3. **Tornar a confirmação mais confiável**
   - Antes de finalizar, validar que cada pedido ainda pertence à unidade atual e ainda está pendente de acerto.
   - Após o update, exigir retorno da linha atualizada; se não atualizar, mostrar falha clara ao usuário.
   - Evitar sucesso parcial silencioso.

4. **Corrigir avisos de Dialog no console**
   - Adicionar `DialogDescription`/descrição acessível nos diálogos desta tela.
   - Se o aviso vier de componente chamado pela tela, corrigir no componente correspondente sem alterar outros fluxos.

5. **Validação após implementação**
   - Conferir novamente os logs/requisições da rota `/caixa/acerto`.
   - Confirmar que o resumo automático da Morumbi Gás não exibe valores de outras empresas nem valores inflados.
   - Confirmar que o pedido #9 e pedidos similares entram no canal correto e podem mudar para `finalizado` sem erro silencioso.
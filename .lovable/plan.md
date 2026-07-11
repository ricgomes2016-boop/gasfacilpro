## Objetivo
Adicionar o campo **"Taxa de entrega (opcional)"** na etapa de Pagamento de **Vendas / Nova Venda** (componente `PaymentSection.tsx`) quando a forma de pagamento **Gás do Povo** for selecionada — mesmo comportamento já existente no PDV (`PDVPayment.tsx`).

## Por que
O campo foi implementado no PDV, mas o fluxo Nova Venda (usado por vendedores e entregadores) usa outro componente (`src/components/vendas/PaymentSection.tsx`) que não recebeu a alteração. Por isso o usuário não vê o campo ao escolher Gás do Povo em Nova Venda.

## Escopo (somente frontend)
Arquivo único: `src/components/vendas/PaymentSection.tsx`.

### Alterações
1. Novo estado local `taxaEntregaGasPovo: string` (input mask de moeda igual ao `valorDisplay`).
2. Renderizar bloco condicional quando `forma === "gas_do_povo"`:
   - Label "Taxa de entrega (opcional)"
   - `Input` com máscara `formatCurrency`
   - Nota: "Cobrada à parte do Gás do Povo. Após adicionar, escolha a forma de recebimento da taxa."
   - Estilo consistente com o restante da seção (borda tracejada, tokens semânticos — sem cores hardcoded).
3. No `addPagamento`, quando `forma === "gas_do_povo"` e há taxa > 0:
   - Após adicionar o pagamento Gás do Povo, pré-preencher `valorDisplay` com o valor da taxa e trocar `forma` para `""` (obriga o usuário a escolher onde recebeu a taxa: dinheiro / pix / cartão).
   - Limpar `taxaEntregaGasPovo`.
4. Incluir a taxa como **texto informativo** no pagamento Gás do Povo (novo campo opcional `info?: string` no objeto `Pagamento`, ou reaproveitar `operadora_nome` — preferência: adicionar `info` opcional para não misturar semânticas). A taxa em si vira **um segundo pagamento** normal (dinheiro/pix/etc.), como no PDV.
5. Resetar `taxaEntregaGasPovo` em `resetExtraFields()`.

### O que NÃO muda
- Nenhuma alteração em `paymentRoutingService.ts`, edge functions, banco, ou fluxo de finalização — a taxa entra no array `pagamentos` como uma linha adicional já suportada.
- Nenhuma mudança no PDV (já está correto) nem em outros consumidores.
- Sem novas dependências, sem novas rotas.

## Verificação
- Abrir Vendas → Nova Venda, adicionar 1× Gás P13, ir em Pagamento, clicar em "Gás do Povo": o campo "Taxa de entrega (opcional)" deve aparecer.
- Preencher taxa, clicar Adicionar: pagamento Gás do Povo entra na lista, e o formulário fica pronto para adicionar a taxa como pagamento separado (dinheiro/pix/cartão).
- Sem taxa: comportamento atual preservado.

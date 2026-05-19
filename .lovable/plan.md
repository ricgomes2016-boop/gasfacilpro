# Adicionar "Boleto" no Editar Entrega (Caixa › Acerto Financeiro)

## Problema
No modal "Editar Entrega" do menu Caixa › Acerto Financeiro, o dropdown de "Forma" de pagamento não lista **Boleto**, embora o roteamento financeiro (`paymentRoutingService.ts`) já trate `boleto` corretamente (gera conta a receber).

## Alteração (1 arquivo)

**`src/pages/caixa/AcertoEntregador.tsx`**

1. Incluir `"Boleto"` no array `formasPagamento` (linha 61–63), entre "Fiado" e o fim — para aparecer no `<Select>` do modal.
2. Adicionar mapeamentos de label nos dois dicionários (linhas 44–59):
   - `boleto: "Boleto"` (chave minúscula)
   - `Boleto: "Boleto"` (chave já capitalizada)
3. Adicionar no mapa de normalização (linhas 556–563):
   - `"Boleto": "boleto"`

## Fora de escopo
- Emissão automática do boleto Asaas ao salvar a edição (o fluxo de Nova Venda já faz isso; aqui só estamos permitindo selecionar a forma). A geração do boleto continua sendo feita via botão "Emitir cobrança (Asaas)" na tela de Contas a Receber.
- Mudanças no `paymentRoutingService` — já suporta `boleto`.
- Mudanças no PDV ou em outras telas.

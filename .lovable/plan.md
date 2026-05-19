# Emissão opcional de boleto no Editar Entrega

## Objetivo
Ao salvar uma "Editar Entrega" no Acerto Financeiro com forma de pagamento **Boleto**, exibir um diálogo perguntando:
> "Deseja emitir o boleto agora?"

- **Sim** → cria o `contas_receber` (fluxo atual) **e** dispara automaticamente a emissão no Asaas (mesmo fluxo do `EmitirBoletoAsaasDialog`).
- **Não** → mantém o comportamento atual: cria apenas o `contas_receber`, sem emitir no Asaas (usuário poderá emitir depois em Contas a Receber).

## Escopo
Apenas o fluxo de Editar Entrega em `src/pages/caixa/AcertoEntregador.tsx`. Nada muda em Nova Venda nem em Contas a Receber.

## Alterações

### 1. `src/pages/caixa/AcertoEntregador.tsx`
- Após o usuário clicar em "Salvar" no modal de Editar Entrega, se `formaPagamento === "Boleto"`:
  - Abrir um `AlertDialog` (shadcn) com título "Emitir boleto?" e os botões **Não, apenas registrar** e **Sim, emitir agora**.
- Persistir a edição (fluxo atual via `paymentRoutingService`) em ambos os casos.
- Se o usuário escolher **Sim**:
  - Após a criação do `contas_receber`, recuperar o `id` do registro recém-criado.
  - Chamar a edge function `asaas-api` com `action: 'create_charge'` e `billingType: 'BOLETO'` (mesmos parâmetros usados em `EmitirBoletoAsaasDialog`: cliente, valor, vencimento, descrição, `conta_receber_id`).
  - Atualizar `asaas_payment_id`, `asaas_invoice_url` e `asaas_bank_slip_url` no `contas_receber`.
  - Toast de sucesso/erro. Em caso de erro na emissão, **não** reverter o `contas_receber` — apenas avisar que o boleto pode ser emitido manualmente depois.

### 2. Reuso de lógica
- Extrair a chamada do Asaas em uma função utilitária (ex.: `emitirBoletoAsaas(contaReceberId)`) reutilizando o que já existe em `EmitirBoletoAsaasDialog`, para não duplicar código. Se preferir manter simples, replicar inline.

## Fora de escopo
- Nenhuma mudança em `paymentRoutingService.ts`.
- Nenhuma mudança em Nova Venda, Contas a Receber ou no `EmitirBoletoAsaasDialog`.
- Sem alterações de schema/RLS.

## Objetivo

1. Adicionar campo **"Seu Número"** (referência interna que aparece impressa no boleto) no diálogo de emissão Asaas.
2. Garantir que, ao finalizar pedido com forma **Boleto**, o atendente possa emitir o boleto na hora — inclusive quando há entregador.

---

## 1. Campo "Seu Número" no boleto

Arquivo: `src/components/financeiro/EmitirBoletoAsaasDialog.tsx`

- Novo state `seuNumero` (string).
- Pré-preenche com o número do pedido (`pedidos.numero_sequencial`) quando `conta.pedido_id` existir; cai para últimos 8 caracteres do `id` da conta como fallback.
- Novo `<Input>` "Seu Número (aparece impresso no boleto)" — opcional, max 25 caracteres (limite Asaas).
- Ao chamar `action: "create_charge"` no edge `asaas-api`, enviar:
  - `externalReference`: o `seuNumero` informado (em vez do `conta.id`).
  - Manter `description` como está.
- Persistir o valor em `contas_receber` numa coluna nova `seu_numero text`.

### Migração

```sql
ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS seu_numero text;
```

(coluna simples, sem alterar RLS/grants existentes).

### Edge function `asaas-api`

Sem mudança estrutural — `externalReference` já é repassado ao Asaas; apenas o cliente passará o novo valor.

---

## 2. Emissão na finalização da venda

Arquivo: `src/pages/vendas/NovaVenda.tsx`

Hoje a busca da `conta_receber` para abrir o Asaas só roda quando `temBoleto && !entregador.id`. Resultado: se o pedido tem entregador, o atendente nunca vê a opção.

Mudanças:

- Remover a condição `!entregador.id` — sempre que `temBoleto`, buscar a `conta_receber` e setar `boletoAsaasConta`.
- No `printDialog`, manter o texto "Em seguida abriremos a emissão do boleto Asaas." **e** adicionar um botão secundário **"Pular emissão"** que limpa `boletoAsaasConta` antes de navegar, para o atendente decidir.
- Sem mudanças no fluxo de impressão nem na lógica de criação de `contas_receber`.

---

## Resumo de arquivos

- `supabase/migrations/<novo>.sql` — adiciona `contas_receber.seu_numero`.
- `src/components/financeiro/EmitirBoletoAsaasDialog.tsx` — campo "Seu Número", envio como `externalReference`, persistência.
- `src/pages/vendas/NovaVenda.tsx` — remove restrição de entregador, adiciona botão "Pular emissão".

Sem mexer em `App.tsx`, rotas, providers ou em outras telas.

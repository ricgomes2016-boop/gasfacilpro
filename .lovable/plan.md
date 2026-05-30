# Vale Gás × Contas a Receber — Acerto do título do parceiro

## Problema

Hoje o fluxo financeiro do Vale Gás cobra duas vezes (ou nenhuma):

1. **Emissão do lote** (`ValeGasEmissao.tsx`) — só gera `contas_receber` se o operador marcar o checkbox opcional **"Gerar conta a receber"**. Se esquecer, o parceiro nunca aparece em Contas a Receber.
2. **Venda paga com Vale Gás** (`paymentRoutingService.ts` → case `vale_gas`) — gera **um título por venda** vinculado ao parceiro, com vencimento = hoje. Isso é incorreto: quem deve é o parceiro pelo lote, não o cliente final pela venda. O resultado é que Contas a Receber enche de títulos pequenos do parceiro (um por vale consumido), além do título do lote.

Regra correta: **o parceiro paga o lote**. A venda apenas consome o voucher.

## Mudanças

### 1. Emissão do lote sempre gera Contas a Receber
Arquivo: `src/pages/financeiro/ValeGasEmissao.tsx`

- Remover o checkbox **"Gerar conta a receber"** (o título passa a ser obrigatório).
- Manter o campo **"Vencimento do título"** (default = hoje + 10 dias, editável).
- Após `emitirLote`, sempre inserir em `contas_receber`:
  - `cliente` = nome do parceiro, `vale_gas_parceiro_id` preenchido
  - `descricao` = `"Vale Gás - Lote {numero_inicial}-{numero_final} ({qtd} vales)"`
  - `valor` = `lote.valor_total`, `vencimento` = data escolhida
  - `status = "pendente"`, `forma_pagamento = "vale_gas"`, `origem = "vale_gas_lote"`
  - `unidade_id` da unidade atual
- Se o `insert` falhar, reverter (ou alertar) — não deixar lote órfão de título.
- Ajustar `formData` inicial e o reset para remover `gerarContaReceber`.

### 2. Venda com Vale Gás deixa de criar Contas a Receber
Arquivo: `src/services/paymentRoutingService.ts` (case `"vale_gas"`)

- **Remover o `insertContasReceber`** desse case.
- Manter: atualizar o registro `vale_gas` para `status="utilizado"`, gravar `data_utilizacao`, `venda_id`, `cliente_id`, `cliente_nome` (rastreabilidade).
- Atualizar o comentário do header (linhas 124–130) para refletir que Vale Gás **não** gera `contas_receber` na venda — o título vive no lote.

### 3. Limpeza dos títulos antigos duplicados (opcional, a confirmar)
Migration `UPDATE` (via tool `supabase--insert`) que marca como `cancelada` (ou deleta) os títulos legados com `origem = 'vale_gas'` (origem da venda, **não** `vale_gas_lote`) que ainda estejam `pendente`. Só rodar após confirmação do usuário, pois afeta dados existentes.

## Fora de escopo

- Estrutura da tabela `contas_receber`, RLS, App.tsx, rotas e providers.
- Lógica de Conferência de Cartão, Asaas, fluxo de boleto.
- Tela `ContasReceber.tsx` (já refatorada na rodada anterior — os títulos do lote aparecerão naturalmente com `forma_pagamento = "vale_gas"`).

## Perguntas

1. **Vencimento padrão do título do lote**: manter `hoje + 30 dias` (default atual) ou mudar para **10 dias** como no seu exemplo (20/05 → 30/05)?
2. **Títulos antigos** gerados por venda com vale_gas (origem `vale_gas`, não `vale_gas_lote`) que estão `pendente` em Contas a Receber: deseja que eu rode uma limpeza marcando-os como `cancelada`, ou prefere manter o histórico e só ajustar daqui para frente?

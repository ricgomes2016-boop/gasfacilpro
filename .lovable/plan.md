## Objetivo

Hoje a tela da conta bancária tem um card "Boletos" — mas ele mostra **boletos a pagar (fornecedores)**. A intenção do usuário (referência Asaas) é diferente: ver **cobranças emitidas para clientes** e poder **gerar uma nova cobrança** (boleto ou Pix) direto da conta.

Vamos adicionar um novo card rápido **"Cobranças"** ao lado dos atuais, visível apenas em contas com provedor integrável (Asaas, PagBank) — onde realmente conseguimos emitir.

## Onde aparece

- Card "Cobranças" no `QuickShortcuts` da conta bancária (mobile e desktop).
- Aba `cobrancas` correspondente em `ContaBancariaDetalhe.tsx`.
- Só aparece quando `getBankProvider(conta.banco)` ∈ {`asaas`, `pagbank`}. Em contas comuns / caixa o card não é renderizado.
- O card atual "Boletos" (a pagar) continua igual — só renomearemos visualmente para **"Boletos a pagar"** para evitar confusão com Cobranças.

## Tela "Cobranças" (novo `CobrancasPanel`)

Layout inspirado no print do Asaas:

1. Header com botão primário **"Nova cobrança"** (abre dialog) + filtro por status (Todas / Pendentes / Pagas / Vencidas) e busca por cliente.
2. KPIs compactos: total emitido no mês, total recebido, em aberto, vencido.
3. Sub-abas leves (chips):
   - **Todas as cobranças**
   - **Avulsas** (cobranças únicas)
   - **Parcelamentos** (mesma `parent_id` / `parcela_numero`)
   - **Assinaturas** (vinculadas a `contratos_recorrentes`)
4. Lista de cobranças (tabela desktop / cards mobile) com: cliente, vencimento, valor, status, forma (Boleto/Pix), ações (ver link, copiar linha digitável, copiar Pix copia-e-cola, cancelar).

Fonte de dados: tabela existente `boletos_emitidos` filtrada por `conta_bancaria_id = conta.id`. Para "Assinaturas" cruzar com `contratos_recorrentes` via `contrato_id` (já existente em `boletos_emitidos` quando aplicável).

## Geração de nova cobrança

- Em conta **Asaas**: reutiliza o componente já existente `EmitirBoletoAsaasDialog` (apenas pré-seleciona a `conta_bancaria_id` atual).
- Em conta **PagBank**: novo `EmitirCobrancaPagBankDialog` (mesma UX) que chama a edge function `pagbank-api` com `action: "create_boleto_charge"` ou `"create_pix_charge"` (já implementadas na etapa anterior). Insere o registro em `boletos_emitidos` com `provedor = 'pagbank'`.

Ambos os dialogs compartilham os mesmos campos: cliente, valor, vencimento, descrição, tipo (Boleto/Pix/Boleto+Pix), juros/multa opcionais.

## Arquivos

Novos:
- `src/components/financeiro/conta-detalhe/CobrancasPanel.tsx`
- `src/components/financeiro/EmitirCobrancaPagBankDialog.tsx`

Editados:
- `src/components/financeiro/conta-detalhe/QuickShortcuts.tsx` — adicionar item `cobrancas` (ícone `Receipt` ou `FileText`) e renomear `boletos` → "Boletos a pagar".
- `src/pages/financeiro/ContaBancariaDetalhe.tsx` — incluir `cobrancas` em `shortcuts` quando `provider` existir, adicionar `<TabsTrigger>` e `<TabsContent>` renderizando `CobrancasPanel`.
- `src/components/financeiro/EmitirBoletoAsaasDialog.tsx` — aceitar prop opcional `contaBancariaId` para pré-seleção.

## Fora de escopo

- Webhook de baixa automática (já existe parcial para Asaas / PagBank).
- Conciliação automática com `contas_receber` (mantém o vínculo atual).
- Cobrança recorrente nova (assinaturas) — por enquanto só listamos as existentes; criar assinatura nova fica num passo futuro.

## Objetivo

Permitir configurar integrações bancárias direto da página da conta (Pix/Boleto/Extrato/Conciliação), começando com **PagBank** e aproveitando a integração **Asaas** já existente no projeto.

Observação importante: verifiquei o banco e a empresa **Forte Gás** ainda **não tem chave Asaas configurada** nem contas bancárias cadastradas. O plano cobre os dois cenários: (a) se já existir chave Asaas para a unidade/empresa, criamos a conta já vinculada; (b) se não existir, abrimos o passo de configuração antes.

Também não consigo assistir o vídeo do YouTube — se quiser que eu incorpore algo de lá, me passe os pontos em texto.

---

## 1. Card "Configurações" nas contas bancárias

Arquivo: `src/components/financeiro/conta-detalhe/QuickShortcuts.tsx` + `src/pages/financeiro/ContaBancariaDetalhe.tsx`.

- Adicionar item `{ id: "config", label: "Configurações", icon: Settings }` em `ALL_ITEMS`.
- Aparecer **apenas em contas com provedor integrável** (Asaas, PagBank, Itaú Pix, etc.). Critério: função utilitária `getBankProvider(banco)` que devolve `"asaas" | "pagbank" | "itau" | null`. Esconder o card quando `null` ou quando `tipo === "caixa_interno"`.
- Nova `<TabsContent value="config">` que renderiza `<IntegracaoBancariaPanel conta={conta} provider={provider} />`.

## 2. Painel de integração `IntegracaoBancariaPanel`

Novo: `src/components/financeiro/conta-detalhe/IntegracaoBancariaPanel.tsx`.

Conteúdo dinâmico por `provider`:
- **Status da conexão** (badge verde/vermelho) com botão "Testar conexão".
- **Toggle Sandbox / Produção**.
- Campos de credenciais (mascarados, com botão "alterar").
- Lista de **capacidades habilitadas**: Extrato, Saldo, Pix, Boleto, Maquininha (conforme provider).
- Link "Como obter as credenciais" + URL da documentação oficial.
- Botão "Sincronizar agora" (chama edge function correspondente).

Persistência: linha em `integracoes_config` (`unidade_id`, `integracao_id='pagbank'|'asaas'|...`, `config` jsonb, `ativo`). Já existe RLS de admin/gestor.

## 3. Integração PagBank

### Credenciais (secrets)
Pedir via `add_secret`:
- `PAGBANK_API_TOKEN_SANDBOX`
- `PAGBANK_API_TOKEN_PROD`

Por unidade, gravar em `integracoes_config.config`:
```json
{ "ambiente": "sandbox" | "producao", "email_conta": "...", "webhook_token": "..." }
```

### Edge function `pagbank-api` (`supabase/functions/pagbank-api/index.ts`)
Ações suportadas:
- `get_account` – saldo + dados da conta (`GET /accounts/{id}` ou `GET /balance`).
- `list_transactions` – extrato no período → grava em `extrato_bancario`.
- `list_orders` / `list_receivables` – recebíveis de maquininha → grava em `pagamentos_cartao` + `contas_receber` (D+1/D+30 como já fazemos para PagBank PlugPag).
- `create_pix_charge` – `POST /orders` com `qr_codes` → devolve `qr_code` + `txid`, cria `contas_receber` com `forma_pagamento='pix'` e referência externa.
- `create_boleto_charge` – `POST /orders` com `charges[].payment_method.type='BOLETO'` → cria `contas_receber` + `boletos_emitidos`.
- `test_connection` – ping em `/public/payment-methods`.

Base URL: `https://sandbox.api.pagseguro.com` ou `https://api.pagseguro.com`. Auth: `Authorization: Bearer ${token}`.

### Webhook `pagbank-webhook`
Endpoint público para receber notificações `CHARGE.PAID`, `ORDER.PAID`, atualizar `contas_receber.status='recebido'` e baixar saldo.

### UI específica do PagBank
Dentro de `IntegracaoBancariaPanel` quando `provider==='pagbank'`:
- Campos: ambiente (toggle), e-mail da conta, token (digitado uma vez, salvo em secret).
- Capacidades: Extrato, Saldo, Pix, Boleto, Conciliação de maquininha (link para `/financeiro/cartoes`).
- Botões: Testar conexão · Sincronizar extrato (últimos 30 dias) · Importar recebíveis.

## 4. Auto-criar conta bancária do Asaas

Novo botão na lista de contas (`ContasBancarias.tsx`): **"+ Importar conta do Asaas"** (visível quando a unidade ativa tem `configuracoes_empresa.asaas_api_key` preenchida).

Fluxo:
1. Chama edge function `asaas-api` com `action='get_account_info'` (a função já existe; adicionar essa ação se faltar) → `GET /myAccount` e `/finance/balance`.
2. Faz `insert` em `contas_bancarias` com:
   - `nome = "Asaas - <nome unidade>"`
   - `banco = "Asaas"` (entra na lista de `getBankProvider → 'asaas'`)
   - `tipo = 'corrente'`
   - `agencia/conta/chave_pix` do retorno
   - `saldo_inicial = saldo_atual = balance.totalBalance`
   - `unidade_id` da unidade ativa
3. Grava `integracoes_config` com `integracao_id='asaas'`, `config={"vinculada_conta_id": <id>, "ambiente": sandbox?}`.
4. Toast "Conta Asaas criada e sincronizada".

Para Forte Gás especificamente: como a empresa **ainda não tem chave Asaas**, o botão direciona primeiro para `/configuracoes/asaas` para colar a chave (sandbox por padrão); ao salvar, oferece "Criar conta bancária agora".

## 5. Detecção do provedor (`getBankProvider`)

`src/lib/bancos/bankProviders.ts` (novo):

```text
Asaas              -> asaas
PagBank/PagSeguro  -> pagbank
Itau               -> itau (futuro)
default            -> null (sem card Configurações)
```

## 6. Entregáveis

Arquivos novos:
- `src/components/financeiro/conta-detalhe/IntegracaoBancariaPanel.tsx`
- `src/components/financeiro/conta-detalhe/providers/PagBankConfigForm.tsx`
- `src/components/financeiro/conta-detalhe/providers/AsaasConfigForm.tsx`
- `src/lib/bancos/bankProviders.ts`
- `supabase/functions/pagbank-api/index.ts`
- `supabase/functions/pagbank-webhook/index.ts`

Alterações:
- `QuickShortcuts.tsx` – item Configurações.
- `ContaBancariaDetalhe.tsx` – TabsContent `config`.
- `ContasBancarias.tsx` – botão "Importar conta do Asaas".
- `supabase/functions/asaas-api/index.ts` – ação `get_account_info`.

Secrets a solicitar quando o usuário confirmar: `PAGBANK_API_TOKEN_SANDBOX`, `PAGBANK_API_TOKEN_PROD`, `PAGBANK_WEBHOOK_TOKEN`.

## 7. Fora do escopo desta entrega

- Integração Itaú / BB / Sicoob (fica preparada via `bankProviders.ts`).
- Conciliação automática de extrato PagBank com Contas a Receber existentes (próxima fase).

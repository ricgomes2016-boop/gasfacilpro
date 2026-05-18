## Situação atual

Boa notícia: a base do Asaas já está pronta no projeto, só não está exposta nem ligada na emissão de boletos. O que existe hoje:

- **Edge Function `asaas-api`** — já implementa criar cliente, criar cobrança (BOLETO/PIX), listar, consultar, pegar linha digitável, QR Code PIX, saldo. Lê a API key salva em `configuracoes_empresa.asaas_api_key` por empresa, com toggle sandbox/produção.
- **Página `src/pages/config/AsaasConfig.tsx`** — formulário completo para colar a API key, alternar sandbox/produção, testar conexão e ver saldo. **Hoje essa página não tem rota** (não está em nenhum arquivo de `src/routes/`) e não há link no menu.
- **Integrações** — o card "Asaas" não aparece em `src/pages/integracoes/data.ts`.
- **Cobranças / Emissão de Boleto** — `src/pages/financeiro/Cobrancas.tsx` e `EmissaoBoleto.tsx` ainda não chamam o `asaas-api`. Hoje a emissão de boleto é manual/local, sem boleto registrado de verdade.

## O que vou entregar

### 1. Tornar a configuração acessível
- Registrar a rota `/configuracoes/asaas` (componente `AsaasConfig`) em `src/routes/configRoutes.ts`, restrita a `admin`/`gestor`/`financeiro`.
- Adicionar o card **Asaas (Boleto + PIX registrado)** em `src/pages/integracoes/data.ts` com status "disponível", categoria "pagamento", e botão que abre `/configuracoes/asaas`.
- Texto orientando: criar conta em asaas.com (Forte Gás), gerar API Key em Configurações → Integrações → API, colar aqui, testar.

### 2. Emissão real de boleto no fluxo do financeiro
- Em **Contas a Receber** e em **Cobranças**, no item/lançamento aberto, adicionar ação **"Emitir boleto (Asaas)"**:
  1. Verifica/cria cliente no Asaas (busca por CPF/CNPJ; se não existir, cria).
  2. Cria cobrança `billingType: BOLETO` com `value`, `dueDate` (= data de vencimento do lançamento), `description` e `externalReference` = id do `contas_receber`.
  3. Salva no lançamento: `asaas_charge_id`, `linha_digitavel`, `boleto_url`, `nosso_numero` (campos novos em `contas_receber`).
  4. Mostra modal com linha digitável (copiar), PDF do boleto (link Asaas) e botão "Enviar por e-mail / WhatsApp".
- Mesma ideia para **PIX** (mesma cobrança, action `get_pix_qrcode`) — opcional, posso entregar junto já que a função suporta.

### 3. Migração de banco (pequena)
Adicionar em `contas_receber`:
- `asaas_charge_id text`
- `linha_digitavel text`
- `boleto_url text`
- `nosso_numero text`

### 4. Validação de credenciais Forte Gás
Como sua conta é da **Forte Gás**, a API key é específica daquela empresa no Asaas. A página já é por empresa (`empresa_id`), então basta:
- Estar logado/contexto na empresa Forte Gás.
- Colar a API key gerada no painel Asaas da Forte Gás.
- Manter o ambiente em **Produção** (sandbox só serve para testes, não emite boleto bancário real).

## Fora do escopo (perguntar antes se quiser incluir)
- Webhook Asaas para marcar `contas_receber` como `recebida` automaticamente quando o boleto for pago. Recomendo fazer numa segunda etapa — eu te oriento depois sobre o URL do webhook para colar no painel Asaas.
- Cobrança via cartão de crédito.
- Geração de carnê (várias parcelas de uma vez).

## Detalhes técnicos
- Sem mudança no `asaas-api` (já cobre tudo que precisamos).
- Novos campos via `supabase--migration`.
- Novos componentes: `EmitirBoletoAsaasDialog.tsx` (reusado em Contas a Receber e Cobranças).
- Toda chamada via `supabase.functions.invoke("asaas-api", { body: { action, ... } })`.

## O que preciso de você antes de implementar
1. Confirmar que vai usar **Produção** (boletos reais) — neste caso, você precisa ter a conta Asaas da Forte Gás já aprovada com dados bancários completos.
2. Você já tem a **API Key de Produção** da Forte Gás em mãos? (Se ainda não, te explico o passo a passo no painel Asaas antes de pedir o secret.)
3. Quer que eu já inclua a **cobrança PIX** no mesmo fluxo, ou só Boleto agora?
4. Quer o **webhook de baixa automática** agora ou em uma segunda etapa?


## Diagnóstico

O erro "Failed to send a request to the Edge Function" no toast confirma: a edge function `importar_xml_outlook` **não existe**. O front está OK, falta o backend completo.

O código do Base44 mostra o fluxo correto que o usuário quer:
1. Conectar Outlook (OAuth Microsoft Graph)
2. Buscar emails de um remetente (ex: `nfe@ggti.geq.com.br`)
3. Filtrar por período (data início/fim ou mês)
4. Baixar anexos `.xml` de NF-e
5. Parsear XML → extrair fornecedor, produto, qtd, preço, NF, CFOP, data
6. Salvar em `purchases` (no nosso caso: tabela `transp_compras`)
7. Mostrar status: "Última importação", lista de XMLs processados

## Plano

### 1. Backend — Conexão Outlook + Importação XML

**Tabela nova: `transp_outlook_config`** (1 registro por unidade)
- `id`, `unidade_id` (unique), `empresa_id`
- `microsoft_refresh_token` (text, criptografado)
- `microsoft_user_email` (text)
- `filtro_remetente` (text, ex: `nfe@ggti.geq.com.br`)
- `ultima_importacao` (timestamptz)
- `ultimo_status` (text)
- `ultimo_total_importados` (int)
- RLS: `unidade_belongs_to_user_empresa(unidade_id)`

**Secrets necessários (pedir ao usuário):**
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID` (ou `common`)
- `MICROSOFT_REDIRECT_URI` (ex: `https://transporte.gasfacilpro.com.br/transportadora/compras/outlook-callback`)

**3 Edge Functions novas:**

a) **`outlook-oauth-start`** — gera URL de consentimento Microsoft Graph (scopes: `Mail.Read offline_access`) e devolve para o front redirecionar.

b) **`outlook-oauth-callback`** — recebe `code`, troca por `access_token`+`refresh_token`, salva `refresh_token` em `transp_outlook_config` para a unidade ativa.

c) **`importar_xml_outlook`** — função principal:
   1. Lê `transp_outlook_config` da unidade
   2. Usa `refresh_token` → obtém `access_token` fresh
   3. Chama Graph API: `GET /me/messages?$filter=from/emailAddress/address eq '<filtro>' and hasAttachments eq true and receivedDateTime ge <inicio>&$top=50&$expand=attachments`
   4. Para cada anexo `.xml`: faz parse (regex/XML simples) extraindo de `<infNFe>`:
      - `<emit><xNome>` → fornecedor
      - `<ide><nNF>` → número NF
      - `<ide><dhEmi>` → data
      - `<det><prod><xProd>`, `<qCom>`, `<vUnCom>`, `<vProd>`, `<CFOP>` → produtos
   5. Para cada item de produto na NF, faz upsert em `transp_compras` (chave: `numero_nf` + `unidade_id` + `produto`) — não duplica
   6. Atualiza `ultima_importacao`, `ultimo_status`, `ultimo_total_importados`
   7. Retorna `{ total_importados, total_emails, ja_existentes, erros }`

### 2. Frontend — `src/pages/transportadora/TranspCompras.tsx`

Substituir os 2 botões atuais por um fluxo mais completo (sem remover layout existente):

- **Botão "Conectar Outlook"** (se não conectado) → chama `outlook-oauth-start`, abre popup/redirect para Microsoft
- **Quando conectado**: mostra `📧 {email_conectado}` + botão "Desconectar"
- **Campo "Filtrar remetente"** (input pequeno, opcional, default vazio = todos) — salva em `transp_outlook_config`
- **Botão "Importar XML do Outlook"** + **"Buscar XML agora"** (mantém ambos, mesma ação) → chama `importar_xml_outlook`
- **Linha de status** (substitui o placeholder atual):
  - `Última importação: {data formatada}` (de `transp_outlook_config.ultima_importacao`)
  - `{ultimo_total_importados} XMLs no último ciclo`
  - Badge de status (sucesso/erro)
- **Modal/Drawer "Resultado da Importação"** ao concluir: lista NFs novas, NFs já existentes, erros — com link para abrir cada compra

### 3. Página de callback OAuth

Nova rota: `/transportadora/compras/outlook-callback` → componente simples que pega `?code=` da URL, chama `outlook-oauth-callback`, mostra "✅ Outlook conectado" e redireciona de volta para `/transportadora/compras`.

### 4. O que NÃO vou fazer
- Não vou copiar a UI inteira do Base44 (resumos, gráficos, tabela de duplicatas) — usuário pediu apenas "importar XML de compra"
- Não vou criar nova rota `/compras` separada — tudo continua em `/transportadora/compras`
- Não vou mexer em `Compras.tsx` legado
- Não vou usar Gmail (apenas Outlook, como pedido)
- Não vou refatorar `App.tsx`/rotas/providers

## Arquivos tocados

```text
NOVO  supabase migration  (tabela transp_outlook_config + RLS)
NOVO  supabase/functions/outlook-oauth-start/index.ts
NOVO  supabase/functions/outlook-oauth-callback/index.ts
NOVO  supabase/functions/importar_xml_outlook/index.ts
NOVO  src/pages/transportadora/OutlookCallback.tsx
NOVO  src/components/transportadora/compras/OutlookConnectionPanel.tsx
NOVO  src/components/transportadora/compras/ResultadoImportacaoDialog.tsx
EDIT  src/pages/transportadora/TranspCompras.tsx  (integrar painel + status real)
EDIT  src/routes/transportadoraRoutes.ts  (adicionar rota /compras/outlook-callback)
```

## Pré-requisitos do usuário (vou pedir via add_secret)

1. Criar app no **Azure Portal** → Microsoft Entra ID → App registrations:
   - Redirect URI: `https://transporte.gasfacilpro.com.br/transportadora/compras/outlook-callback`
   - API permissions: `Mail.Read`, `offline_access` (delegated)
2. Fornecer: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` (use `common` para qualquer conta Microsoft)

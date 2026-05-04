## Objetivo

Em **Configurações → Unidades**, transformar o diálogo de edição em **abas** e adicionar uma aba **Fiscal** completa, incluindo certificado digital A1 (upload), tokens NFC-e/CSC, ambiente (homologação/produção), série/numeração, regime tributário, CNAE, IE, IM, etc. Também adicionar **Inscrição Estadual** e **Inscrição Municipal** ao cadastro principal.

## 1. Migração de banco (`unidades`)

Adicionar colunas (todas nullable):

**Identificação fiscal**
- `inscricao_estadual` text
- `inscricao_municipal` text
- `inscricao_estadual_st` text (Substituição Tributária)
- `regime_tributario` text — Simples Nacional / Lucro Presumido / Lucro Real / MEI
- `cnae_principal` text
- `razao_social` text
- `nome_fantasia` text

**Certificado Digital A1**
- `certificado_a1_path` text (path no Storage)
- `certificado_a1_senha` text (criptografada — armazenada apenas via edge function futura; por ora texto restrito ao gestor via RLS)
- `certificado_a1_validade` date
- `certificado_a1_titular` text

**NFe / NFC-e / CT-e**
- `nfe_ambiente` text — `homologacao` | `producao` (default `homologacao`)
- `nfe_serie` integer (default 1)
- `nfe_proximo_numero` integer (default 1)
- `nfce_serie` integer (default 1)
- `nfce_proximo_numero` integer (default 1)
- `nfce_csc_id` text (ID do Token CSC SEFAZ)
- `nfce_csc_token` text (Código de Segurança do Contribuinte)
- `cte_serie` integer
- `cte_proximo_numero` integer

**Configurações fiscais padrão**
- `cfop_padrao_venda` text (default `5102` / `5656` para gás)
- `cfop_padrao_devolucao` text (default `1202`)
- `natureza_operacao_padrao` text (default `Venda de mercadoria`)
- `aliquota_icms_padrao` numeric(5,2)
- `aliquota_pis_padrao` numeric(5,2)
- `aliquota_cofins_padrao` numeric(5,2)
- `cst_csosn_padrao` text

**Contador / Responsável fiscal**
- `contador_nome` text
- `contador_cpf_cnpj` text
- `contador_crc` text
- `contador_email` text
- `contador_telefone` text

**Provedor de emissão**
- `provedor_nfe` text (ex.: `focus_nfe`, `tecnospeed`, `enotas`, `nenhum`)
- `provedor_nfe_token` text
- `provedor_nfe_url` text

Storage bucket privado **`certificados-fiscais`** (não-listável) para upload do `.pfx` com RLS restringindo acesso ao `empresa_id` do usuário (admin/gestor).

## 2. UI — `src/pages/config/Unidades.tsx`

Refatorar o `Dialog` de edição usando `Tabs` (mantém todo o restante da página):

```text
[ Geral ] [ Endereço ] [ Operação ] [ Fiscal ]
```

- **Geral**: Nome, Razão Social, Nome Fantasia, CNPJ, **Inscrição Estadual**, **IE Substituto Tributário**, **Inscrição Municipal**, CNAE, Regime Tributário (Select), Telefone, Email.
- **Endereço**: Endereço, Número, Bairro, CEP, Cidade, Estado.
- **Operação**: Chave PIX, Horários (abertura/fechamento), Bairros atendidos.
- **Fiscal** (nova) — sub-seções com `<Card>`:
  1. **Certificado Digital A1**: upload `.pfx/.p12` (input file → Supabase Storage `certificados-fiscais`), campo senha (type=password), data de validade, titular. Badge mostrando "Válido até …" / "Vencido".
  2. **Ambiente NFe/NFC-e**: Select Homologação/Produção, alerta visual quando produção.
  3. **Numeração**: Série e próximo número de NFe, NFC-e e CT-e (grid).
  4. **Token NFC-e (CSC)**: ID CSC + Token CSC.
  5. **Tributação padrão**: Regime, CFOP venda, CFOP devolução, Natureza da operação, alíquotas ICMS/PIS/COFINS, CST/CSOSN.
  6. **Provedor de Emissão**: Select (Focus NFe / TecnoSpeed / eNotas / Nenhum), URL, Token.
  7. **Contador**: Nome, CPF/CNPJ, CRC, Email, Telefone.

Atualizar `handleSave` para gravar todos os novos campos. Manter `Unidade` type cast com `as any` (types regenerados automaticamente após migração).

## 3. Segurança

- Senha do certificado e token CSC: campos `type="password"` com botão olho.
- Bucket `certificados-fiscais` privado; políticas RLS de `storage.objects` permitindo apenas admin/gestor da mesma empresa (path prefix = `empresa_id/unidade_id/...`).
- Ignorar memória de segurança (não logar senhas).

## Arquivos

- **Migração nova**: `supabase/migrations/<ts>_unidades_fiscal.sql` — ALTER TABLE + bucket + policies.
- **Edição**: `src/pages/config/Unidades.tsx` — refator do Dialog para Tabs + nova aba Fiscal + upload de certificado.

Sem mudanças em `App.tsx`, rotas ou providers.

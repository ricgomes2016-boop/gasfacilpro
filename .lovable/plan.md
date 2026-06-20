## Objetivo

Permitir que cada **unidade** tenha seu próprio app do cliente (nome, logo e identificação), independente da empresa-mãe. Hoje o app sempre exibe a marca da empresa (ex.: "Central Gas"), mesmo quando a unidade visitada é "Forte Gás".

## Causa atual

- A unidade "Forte Gás" pertence à empresa "Central Gas" no banco.
- A tabela `unidades` não tem `slug` nem `logo_url`.
- `AuthCliente.tsx` exibe `empresa?.nome` e `empresa?.logo_url` no logo (apesar de já capturar `unidadeNome` do parâmetro `&unidade=`, o logo continua vindo da empresa).
- O link gerado em `AplicativoCliente.tsx` usa `?empresa=<slug-da-empresa>&unidade=<id>`, então a empresa "vence" o branding.

## Mudanças

### 1. Banco — branding por unidade

Migration:
- `ALTER TABLE public.unidades ADD COLUMN slug text UNIQUE`, `ADD COLUMN logo_url text`, `ADD COLUMN cor_primaria text`.
- Função `public.get_unidade_by_slug(_slug text)` (SECURITY DEFINER) para resolver unidade publicamente sem expor outras colunas sensíveis (retorna `id, nome, slug, logo_url, cor_primaria, empresa_id, empresa_nome, empresa_slug`).
- `GRANT EXECUTE ... TO anon, authenticated`.

### 2. Tela "Aplicativo do Cliente" (`src/pages/clientes/AplicativoCliente.tsx`)

- Adicionar campos editáveis para a unidade ativa: **slug do app** (com sugestão automática a partir do nome — ex.: `forte-gas-matriz`) e **logo do app** (upload em bucket existente ou URL).
- Mudar `appLink` para preferir o slug da unidade quando existir:
  - Com slug de unidade: `https://clientes.gasfacilpro.com.br?u=<slug-unidade>`
  - Fallback atual: `?empresa=<slug-empresa>&unidade=<id>`
- QR code e compartilhamento usam o novo link.

### 3. Login do cliente (`src/pages/auth/AuthCliente.tsx`)

- Ler `?u=<slug-unidade>` além de `?empresa=` e `?unidade=`.
- Quando `u` estiver presente, chamar `get_unidade_by_slug` e usar:
  - `displayName` = `unidade.nome` (já é o caso quando `unidadeNome` existe).
  - **Logo** = `unidade.logo_url` em vez de `empresa.logo_url` (correção principal — hoje o logo só usa a empresa).
  - `empresaSlug` derivado da unidade para o restante do fluxo (cadastro, busca de produtos etc.).
- Persistir `cliente_unidade_slug` no `localStorage` análogo ao `cliente_empresa_slug`.

### 4. `ClienteContext.tsx` e `ClienteCadastro.tsx`

- Aceitar `?u=` como fonte primária; resolver `empresaSlug` via unidade quando vier por aí. Comportamento legado (`?empresa=`) preservado.
- Salvar `unidade_id` no cadastro/sessão do cliente (campo já passado hoje quando `&unidade=` está na URL — mantém).

### 5. Forte Gás existente

- Não migrar dados automaticamente. Após o deploy, basta o usuário entrar em **Aplicativo do Cliente** com a unidade "Forte Gás" selecionada, definir slug `forte-gas-cg` (ou similar) e fazer upload do logo da Forte Gás. O link gerado abrirá com a marca correta.
- A empresa independente "Forte Gás" (slug `forte-gas`) continua funcionando normalmente.

## Fora de escopo

- Não mexer em `App.tsx`, providers ou rotas.
- Tela "versão nova" do Nova Venda intocada (mantém regra anterior).
- Sem mudanças em RLS de outras tabelas.

## Resumo técnico

```text
unidades + slug, logo_url, cor_primaria
        │
        ▼
get_unidade_by_slug(slug) ──► AuthCliente (?u=…)  → logo + nome da unidade
                              ClienteContext      → empresa_id derivada
AplicativoCliente: edita slug/logo da unidade e gera link com ?u=
```

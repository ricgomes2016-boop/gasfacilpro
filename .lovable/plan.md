

## Portal do Contador — subdomínio `contabil.gasfacilpro.com.br`

Aproveita a infraestrutura existente (role `contador`, tabelas `documentos_contabeis`, `notas_fiscais`, `extrato_bancario`, `ContadorLayout`) e cria um portal dedicado, isolado e escalável para vários contadores acessarem seus clientes (empresas) — começando pela Central Gás.

---

### 1. Roteamento por subdomínio

**`src/lib/subdomain.ts`** — adicionar:
- Tipo: `"contador"` em `SubdomainApp`
- Mapa: `contabil → "contador"`, `contador → "contador"`, `contabilidade → "contador"`
- `getCanonicalHostnameForApp("contador")` → `contabil.<base>`
- `getSubdomainDefaultRoute("contador")` → `/contador`
- `isRouteAllowedForSubdomain("contador", path)` → libera apenas `/auth`, `/contador/*`
- `inferAppFromPath`: `/contador` → `"contador"`

**`src/pages/Auth.tsx`** + novo **`src/pages/auth/AuthContador.tsx`** — login dedicado (email + senha), validação de role `contador`, branding "Portal Contábil".

**`src/App.tsx` (não refatorar — apenas adicionar rotas)**:
```
/contador                  → Dashboard
/contador/xml              → Entrada XML (NF-e/NFC-e/CT-e)
/contador/despesas         → Despesas escaneadas
/contador/financeiro       → Importação OFX/PDF + extrato
/contador/empresas         → Selecionar empresa cliente
/contador/configuracoes    → Perfil
```
Todas envoltas por `<ProtectedRoute allowedRoles={["contador","admin","gestor","financeiro"]}>`.

---

### 2. Modelo multi-empresa para o contador

Um contador atende **várias empresas**. Hoje a tabela `profiles.empresa_id` vincula a uma só. Solução:

**Nova tabela `contador_empresas`** (migration):
```
id uuid pk, contador_user_id uuid → auth.users, empresa_id uuid → empresas,
permissoes jsonb default '{"xml":true,"despesas":true,"financeiro":true}',
ativo boolean default true, created_at, updated_at
UNIQUE(contador_user_id, empresa_id)
```
RLS: contador vê apenas seus próprios vínculos; admin/super_admin gerencia.

**Função RPC `get_contador_empresas(_user_id uuid)`** retorna empresas + unidades acessíveis. Vínculo inicial (Central Gás) feito via insert tool após criação do usuário contador.

**Novo contexto `ContadorContext`** (`src/contexts/ContadorContext.tsx`): seleção de empresa ativa + lista de unidades dessa empresa (substitui o `EmpresaContext` quando `subdomainApp === "contador"`).

---

### 3. Telas

**Layout**: reutiliza `ContadorLayout.tsx` adicionando seletor de empresa no topo + seletor de unidade (loja). Novos itens no menu:
- Início, Empresas, **Entrada XML**, **Despesas**, **Financeiro**, Documentos, Calendário, Solicitações, Comunicados.

#### A) Dashboard (`/contador`)
- Cards: empresa ativa, total de XMLs do mês, despesas pendentes de classificação, extratos importados, fechamento do mês.
- Lista das últimas movimentações por loja.

#### B) Entrada XML (`/contador/xml`)
Reutiliza tabela `notas_fiscais`. Adiciona:
- Upload `.xml` (drag-and-drop, múltiplos arquivos, até 5MB cada) → bucket privado novo `contabil-xmls`.
- **Edge function `parse-nfe-xml`**: lê XML, extrai `chave_acesso`, `numero`, `serie`, `tipo` (nfe/nfce/cte/mdfe), `valor_total`, `destinatario_*`, `remetente_*`, `data_emissao`, salva linha em `notas_fiscais` com `xml_url`, `unidade_id`, `status='importado'`, evita duplicidade pela chave.
- Filtros: empresa, loja, tipo, mês, status, busca por chave/número.
- Tabela com download do XML, visualização DANFE (link `danfe_url` se existir), exportação ZIP do mês.

#### C) Despesas escaneadas (`/contador/despesas`)
**Nova tabela `despesas_contabeis`** (migration):
```
id uuid pk, empresa_id uuid, unidade_id uuid,
descricao text, fornecedor text, cnpj_fornecedor text,
data_despesa date, valor numeric,
categoria text, forma_pagamento text,
arquivo_url text, arquivo_nome text, arquivo_mime text,
ocr_texto text, ocr_metadata jsonb,
status text default 'pendente' check in ('pendente','classificada','baixada','rejeitada'),
observacoes text, uploaded_by uuid, contador_baixou_em timestamptz, contador_user_id uuid,
created_at, updated_at
```
RLS: tenant via `unidade_belongs_to_user_empresa`; contador acessa via vínculo em `contador_empresas`.

UI: 
- Botão **"Escanear despesa"** (câmera mobile) + upload arquivo (PDF/imagem).
- **Edge function `ocr-despesa`** (Lovable AI Gateway, `google/gemini-2.5-flash` com imagem) — extrai fornecedor, CNPJ, data, valor, sugere categoria.
- Lista filtrável por loja/mês/status; botão "Marcar como baixada" + download em lote (ZIP).

#### D) Financeiro — Importação (`/contador/financeiro`)
- **Importar OFX** → parser client-side (`ofx-js`) ou edge function `parse-ofx`; cada transação vira linha em `extrato_bancario` (campos `data`, `descricao`, `valor`, `tipo`, `conta_bancaria_id`, `unidade_id`, `conciliado=false`). Detecta duplicidade por hash `(conta+data+valor+descricao)`.
- **Importar PDF** (extrato bancário) → edge function `parse-extrato-pdf` usa Lovable AI (`google/gemini-2.5-pro` PDF) para extrair tabela de transações estruturada → mesmo destino.
- Tabela de extratos com status conciliação, totais por mês, exportação CSV/Excel.
- Aba secundária: lista de **lançamentos contábeis exportáveis** (já existente em `ExportacaoContabil.tsx`) — link cruzado.

#### E) Empresas (`/contador/empresas`)
Lista de empresas vinculadas ao contador via `contador_empresas`. Permite trocar a empresa ativa e ver resumo de cada loja.

---

### 4. Storage

Novos buckets privados:
- `contabil-xmls` — XMLs de NF (RLS via signed URL)
- `contabil-despesas` — comprovantes escaneados
- `contabil-extratos` — OFX/PDF originais

Políticas: leitura/escrita só para `contador` vinculado à empresa dona da unidade, + staff (`admin`, `gestor`, `financeiro`).

---

### 5. Sugestões profissionais (área contábil)

Recursos que valem a pena adicionar agora ou no roadmap, baseados no que escritórios brasileiros realmente usam (Domínio, Alterdata, Sage, Conta Azul, Omie, Conttagora):

| Recurso | Valor para o contador | Sugestão |
|---|---|---|
| **Plano de contas customizável** | Classificar despesas/receitas direto no padrão da contabilidade | Tabela `plano_contas` por empresa + select na despesa |
| **Centro de custo** (loja, frota, administrativo) | DRE gerencial por loja | Já existe `unidade_id` — reaproveitar |
| **Conciliação automática OFX × Contas a Pagar/Receber** | Reduz 80% do trabalho manual | Match por valor+data±3d |
| **Geração de SPED Fiscal/Contribuições** | Obrigação acessória mensal | Roadmap — exportador a partir de `notas_fiscais` |
| **Calendário de obrigações** (DAS, DCTFWeb, ECD, ECF, EFD, GIA) | Evita multas | Estender `ContadorCalendario` com presets |
| **DRE gerencial mensal por loja** | Gestor + contador conversam o mesmo número | Já existe — habilitar visão multi-loja para o contador |
| **Chat empresa ↔ contador + solicitação de documentos** | Comunicação central | Estender `solicitacoes_contador` (existente) com anexos |
| **Recibo digital com assinatura do contador** quando baixa despesa | Auditoria | Coluna `assinatura_hash` em `despesas_contabeis` |
| **Importação automática de XML via SEFAZ** (manifesto do destinatário) | Captura NF-e emitidas contra a empresa | Roadmap — edge function diária |
| **Conciliação cartão D+1/D+30** | Já existe (`conciliacao_cartao`) | Expor view consolidada para contador |
| **Painel "Pendências do mês"** (XML faltando, despesa sem categoria, OFX não importado) | Foco do contador no que está atrasado | Card no dashboard |

Implementação recomendada agora: **plano de contas + classificação na despesa + painel de pendências do mês** — entrega valor imediato com baixo esforço. Demais itens entram em iteração posterior.

---

### 6. Resumo de arquivos

**Migrations (1)**: criar `contador_empresas`, `despesas_contabeis`, `plano_contas`, índices, RLS, função `get_contador_empresas`.

**Buckets (3)**: `contabil-xmls`, `contabil-despesas`, `contabil-extratos`.

**Edge functions (3)**: `parse-nfe-xml`, `ocr-despesa`, `parse-extrato-pdf`.

**Frontend novos**:
- `src/pages/auth/AuthContador.tsx`
- `src/pages/contador/ContadorDashboard.tsx`
- `src/pages/contador/ContadorXML.tsx`
- `src/pages/contador/ContadorDespesas.tsx`
- `src/pages/contador/ContadorFinanceiro.tsx`
- `src/pages/contador/ContadorEmpresas.tsx`
- `src/contexts/ContadorContext.tsx`
- `src/hooks/useContadorEmpresas.ts`
- `src/components/contador/SeletorEmpresaUnidade.tsx`

**Editar (mínimo, sem refatorar)**:
- `src/lib/subdomain.ts` — adicionar `"contador"`
- `src/pages/Auth.tsx` — case `"contador"`
- `src/App.tsx` — adicionar 6 rotas `/contador/*` no bloco existente
- `src/components/contador/ContadorLayout.tsx` — novos itens de menu + seletor de empresa
- `src/components/auth/ProtectedRoute.tsx` — quando `subdomainApp === "contador"` redirecionar contador para `/contador`

**Vínculo inicial Central Gás**: insert de uma linha em `contador_empresas` ligando o user contador ao `empresa_id` da Central Gás.

**DNS**: o usuário deve apontar `contabil.gasfacilpro.com.br` (registro A `185.158.133.1`) e adicionar o domínio em **Project Settings → Domains**.


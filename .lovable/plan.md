## Objetivo

Eliminar a duplicação entre as abas **Documentos** e **Certidões e Vencimentos** em `Configurações > Documentos da Empresa`. Hoje, ao subir uma certidão (ANP, CNDs, Sintegra) na aba de Certidões, o arquivo fica isolado em `certidoes_empresa` e não aparece na listagem geral de Documentos — o usuário precisa subir o mesmo PDF duas vezes.

A solução **não duplica dados nem cria nova tabela**: a aba **Documentos** passa a ler também de `certidoes_empresa` e exibir cada certidão como um item da lista (somente leitura por essa aba). A aba **Certidões** continua sendo o único lugar para emitir/atualizar/remover certidões e controlar vencimento.

## Mudanças (somente frontend, em `src/pages/config/DocumentosEmpresa.tsx`)

### 1. Lista unificada na aba "Documentos"
- Adicionar uma segunda query a `certidoes_empresa` (filtrada pela unidade atual) ao lado da query existente de `documentos_empresa`.
- Normalizar cada certidão para o mesmo shape do documento, com:
  - `nome`: "ANP — Revenda GLP", "CND Federal", etc. (mapeado pelo `tipo`)
  - `categoria`: `"certidao"` (nova entrada em `CATEGORIAS`)
  - `arquivo_nome` / `arquivo_url`: derivados do `arquivo_url` em storage (`certidoes-empresa`)
  - Campos extras: `data_vencimento`, `status`, `origem` (para badge)
  - Flag `__origem: "certidao"` para o renderizador saber que é read-only por aqui
- Concatenar `documentos + certidoes` no `filtered`, mantendo busca e filtro por categoria.

### 2. Nova categoria "Certidões"
- Adicionar `{ value: "certidao", label: "Certidões" }` em `CATEGORIAS`.
- Trocar um dos cards de stats (ex: "Documentos Fiscais") por **"Certidões"** mostrando a contagem de `certidoes_empresa`, com sub-texto "X vencendo em 30d" quando aplicável.

### 3. Render diferenciado para certidões na lista
- Para itens com `__origem === "certidao"`:
  - Badge da categoria mostra **"Certidão"** + um segundo badge colorido com o status de vencimento (reaproveitando a lógica de `statusBadge` que já existe em `CertidoesEmpresaTab.tsx` — extrair para `src/lib/certidoes/status.tsx` para reuso).
  - Botão **Download** funciona normalmente (signed URL no bucket `certidoes-empresa`).
  - Botão **Excluir** é substituído por um botão **"Gerenciar"** que muda a aba ativa para `certidoes` (controlled `Tabs` com `value`/`onValueChange`).
  - Não exibir na busca duplicado: cada certidão aparece **uma única vez**, vinda de `certidoes_empresa`.

### 4. Bloquear upload manual de certidões pela aba Documentos
- No diálogo "Enviar Documento", se o usuário escolher categoria **"Certidões"**, mostrar um aviso inline:
  > "Para certidões com controle de vencimento (ANP, CNDs, Sintegra), use a aba **Certidões e Vencimentos**."
  com um botão "Ir para Certidões" que troca a aba.
- Desabilitar o botão "Salvar Documento" enquanto a categoria for `certidao`.

### 5. Aba "Certidões e Vencimentos" — sem mudança funcional
- Continua exatamente como está (única origem da verdade para certidões).
- Apenas adicionamos um pequeno texto no topo:
  > "Os PDFs enviados aqui aparecem automaticamente na aba **Documentos**."

## Detalhes técnicos

- Sem migration. Tabelas e buckets já existem (`documentos_empresa`, `certidoes_empresa`, `documentos-empresa`, `certidoes-empresa`).
- A query de certidões usa o `useQuery` com a mesma `queryKey: ["certidoes_empresa", unidadeAtual?.id]` já usada no `CertidoesEmpresaTab`, então uploads invalidam ambas as visualizações automaticamente.
- Download de certidão usa `supabase.storage.from("certidoes-empresa").createSignedUrl(arquivo_url, 60)` (o `arquivo_url` salvo é o path interno, não a URL pública).
- Tabs vira controlado: `const [tab, setTab] = useState("documentos")`.
- Extrair `statusBadge` e `diasAteVencimento` para `src/lib/certidoes/status.tsx` para evitar duplicação entre `CertidoesEmpresaTab` e `DocumentosEmpresa`.

## Arquivos afetados

- `src/pages/config/DocumentosEmpresa.tsx` — lista unificada, controle de tabs, bloqueio de upload de certidão
- `src/components/config/CertidoesEmpresaTab.tsx` — importar `statusBadge` do novo lib + adicionar nota informativa
- `src/lib/certidoes/status.tsx` *(novo)* — `statusBadge` e `diasAteVencimento` reutilizáveis

## Resultado para o usuário

- Sobe a CND Federal na aba **Certidões** → ela aparece imediatamente também em **Documentos** com badge de vencimento, sem upload duplicado.
- Tentar subir uma "Certidão" pelo botão genérico de Documentos → o sistema redireciona para a aba correta, evitando criar registros paralelos.
- Uma única fonte da verdade para cada certidão; documentos avulsos (contratos, alvarás, seguros, etc.) continuam no fluxo normal.
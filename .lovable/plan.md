## Plano — Orçamentos: correção + aba Fundepar

### 1) Corrigir "Novo Orçamento" (não conseguia adicionar cliente/produto)

Causa provável encontrada em `src/pages/financeiro/Orcamentos.tsx`:
- As consultas de `clientes` e `produtos` não filtram por `unidade_id`/`empresa_id`. Em empresas com muitos registros o limite padrão de 1000 do Supabase pode esconder os itens, e os Comboboxes ficam vazios. Além disso, o INSERT em `orcamentos` não envia `unidade_id`, o que pode bloquear por RLS.
- O `value` do `CommandItem` usa template string com campos possivelmente `null` ("undefined undefined"), atrapalhando o filtro.

Ações:
- Filtrar `clientes` por `empresa_id` (via `useEmpresa`) e ainda priorizar os vinculados à `unidade_atual` via `cliente_unidades`. Usar a RPC `autocomplete_clientes_v2` com debounce no `CommandInput` (server-side, mesma usada na tela de Vendas).
- Filtrar `produtos` por `unidade_id = unidadeAtual.id` e `ativo = true`.
- Sanitizar `CommandItem.value` (sem `undefined`).
- Incluir `unidade_id: unidadeAtual.id` no insert do orçamento.
- Mostrar aviso ("Selecione uma unidade") se `unidadeAtual` estiver vazio.
- Ajustar listagem para filtrar `orcamentos` por `unidade_id` da unidade atual.

### 2) Nova aba "Orçamento Fundepar"

UI:
- Substituir o botão único "Novo Orçamento" por um menu com duas opções:
  - "Orçamento padrão" (atual)
  - "Orçamento Fundepar" (novo)
- Adicionar abas no topo da tela: **Todos | Padrão | Fundepar**, filtrando por um novo campo `tipo` (`padrao` | `fundepar`).

Dialog Fundepar — campos do cabeçalho (iguais ao PDF anexado):
- Município
- NRE (Núcleo Regional de Educação)
- Estabelecimento (escola)
- Forma de pagamento (default "À VISTA")
- Período de validade (data inicial + final)
- Itens: nº, descrição, quantidade, valor unitário, valor total (calculado)
- Cliente: opcional (a "escola" funciona como destinatário) — pode buscar/cadastrar opcionalmente

Geração do PDF (impressão):
- Layout idêntico ao PDF enviado: faixa "ESTADO DO PARANÁ / Instituto Paranaense de Desenvolvimento Educacional", título "Pesquisa de Preço 2026" (ano dinâmico), cabeçalho com Município/NRE/Estabelecimento, dados do fornecedor da `empresa`/`unidade` ativa: Razão Social, Nome Fantasia, CNPJ, Inscrição Estadual, Endereço, Cidade/UF, Fone, E-mail.
- Tabela "Orçamentos de Itens – GÁS ENGARRAFADO" com itens.
- Rodapé: "Cidade, dd de mmmm de aaaa", linha de assinatura "ASSINATURA (fornecedor)" e bloco **CARIMBO/CNPJ** desenhado como um carimbo (borda dupla retangular, levemente inclinado, cor preto/azul) contendo: Razão Social, CNPJ, IE, Endereço completo e telefone — extraídos automaticamente da empresa/unidade ativa.
- Implementação via `jsPDF` + `jsPDF-autotable` (já usados em outros relatórios do projeto) num novo serviço `src/services/orcamentoFundeparPdfService.ts`. Botão "Imprimir Fundepar" no diálogo de visualização e na lista (ações da linha quando `tipo='fundepar'`).

### 3) Banco de dados

Migração na tabela `public.orcamentos`:
- `tipo text not null default 'padrao'` (`padrao` | `fundepar`)
- `municipio text`
- `nre text`
- `estabelecimento text`
- `forma_pagamento text`
- `validade_inicio date`
- (mantém `validade` como validade final)

Sem alteração em RLS (segue regras existentes por `unidade_id`).

### Detalhes técnicos
- Tipos atualizados após migração (auto).
- Reaproveitar `useEmpresa()` e `useUnidade()` já presentes.
- PDF buscará os dados de carimbo de `empresas` (razão social, cnpj, ie, telefone, email) + `unidades` (endereço, cidade, uf) com fallback entre os dois.
- Não tocar em `App.tsx`, providers ou rotas.

### Arquivos
- editar: `src/pages/financeiro/Orcamentos.tsx`
- criar: `src/components/financeiro/orcamentos/FundeparDialog.tsx`
- criar: `src/services/orcamentoFundeparPdfService.ts`
- migration: adicionar campos em `orcamentos`

### Fora de escopo
- Login/RBAC, refactors em outras telas, alterações de tema global.

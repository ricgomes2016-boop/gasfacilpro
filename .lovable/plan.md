## Problema

Na tela **Gestão Financeira → Orçamentos**, aba **Padrão**, não há botão para imprimir/salvar PDF nem para assinar digitalmente. Esses recursos só existem hoje para orçamentos Fundepar.

## Solução

Adicionar geração de PDF e assinatura digital (PAdES via `assinar-pdf`) para o orçamento Padrão, reaproveitando exatamente a mesma infraestrutura do Fundepar.

### 1. Novo serviço `src/services/orcamentoPadraoPdfService.ts`

Espelha `orcamentoFundeparPdfService.ts`, mas com layout comercial limpo:

- Reusa `fetchFornecedor(empresa_id, unidade_id)` (mesma lógica) para puxar dados da unidade/empresa.
- Cabeçalho: razão social + nome fantasia da unidade, CNPJ, endereço, telefone, e-mail.
- Bloco "**ORÇAMENTO Nº {numero}**" com data de emissão e validade.
- Bloco do **cliente** (nome, telefone, endereço).
- Tabela de itens (descrição, qtd, valor unit., subtotal) via `jspdf-autotable`.
- Linha de **desconto** (se > 0) e **Total Final**.
- **Observações** (se houver).
- Data por extenso, **linha de assinatura** + **caixa de aparência da assinatura digital** (mesma marca d'água com a inicial da unidade do Fundepar) + **carimbo** da unidade.
- Exporta `gerarOrcamentoPadraoPdf(data)` e `imprimirOrcamentoPadrao(data)` (mesma assinatura de `imprimirFundepar`), incluindo `assinar?: boolean` que chama `assinarPdfRemoto` com a caixa visível posicionada acima da linha de assinatura.

### 2. Alterações em `src/pages/financeiro/Orcamentos.tsx`

- Importar `imprimirOrcamentoPadrao`.
- Criar `reimprimirPadrao(orc, assinar)` que:
  - Busca itens do orçamento em `orcamento_itens` por `orcamento_id` (mesmo padrão usado pelo Fundepar via `editFundepar`).
  - Busca dados do cliente.
  - Chama `imprimirOrcamentoPadrao({ ...campos, assinar, unidade_id, empresa_id })`.
- Na **linha da tabela** (orçamentos `tipo === 'padrao'`): adicionar botões `Printer` (imprimir) e `PenLine` (imprimir com assinatura digital), ao lado dos atuais Visualizar/Duplicar/Excluir.
- No **viewDialog**: adicionar dois botões na seção do orçamento padrão — "Imprimir" e "Imprimir com Assinatura Digital".
- No **diálogo de Novo Orçamento Padrão**: trocar o botão único "Salvar Orçamento" por dois:
  - "Salvar"
  - "Salvar e Imprimir" (chama `createMutation` e, ao sucesso, dispara `imprimirOrcamentoPadrao` com os dados recém-salvos).

### 3. Escopo intencionalmente fora

- Sem mexer em `bia-core.ts`, webhooks, preços, RLS ou qualquer backend.
- Sem alterar PDF/fluxo do Fundepar.
- Sem alterar `App.tsx`, rotas ou providers.
- Sem migração de banco (campos `numero`, `valor_total`, `desconto`, `observacoes`, `validade`, `cliente_nome`, `unidade_id`, `empresa_id` já existem no orçamento, e os itens já são lidos pelo fluxo atual).

## Arquivos

- **Criar:** `src/services/orcamentoPadraoPdfService.ts`
- **Editar:** `src/pages/financeiro/Orcamentos.tsx`

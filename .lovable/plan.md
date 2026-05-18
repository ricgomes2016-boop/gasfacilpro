
# Contas a Receber — validação da data de recebimento e edição com histórico

## 1. Validação na liquidação (modal individual e em lote)

Em `src/pages/financeiro/ContasReceber.tsx`, no `handleReceber` e `handleBulkReceber`, antes do UPDATE:

- `dataRecebimento` deve ser:
  - **>= data da venda** (`conta.data_venda` ou fallback `conta.created_at`). No lote, valida contra cada conta selecionada (usa a maior data de venda do conjunto como mínimo).
  - **<= hoje** (Brasília, via `getBrasiliaDate`).
- Se inválida, abortar com `toast.error("A data do recebimento deve estar entre a data da venda (DD/MM/AAAA) e hoje.")` e não fechar o modal.

No input `type="date"` também aplicar `min` (data da venda) e `max` (hoje) como feedback visual.

## 2. Editar data de recebimento de contas já recebidas

Apenas **admin/gestor** (via `useAuth` + `has_role`). Para outros perfis o botão não aparece.

- Adicionar item no menu de ações (`DropdownMenu` ou `...`) das linhas com `status = 'recebida'`: **"Editar data de recebimento"**.
- Abrir um pequeno dialog (`Dialog` simples) com:
  - Input `type="date"` (default = `data_recebimento` atual).
  - Botões Cancelar / Salvar.
- Mesma validação do item 1 (entre data da venda e hoje).
- Ao salvar:
  - `UPDATE contas_receber SET data_recebimento = <nova> WHERE id = <id>`
  - Acrescentar linha ao campo `observacoes` no formato:
    ```
    [Data de recebimento alterada de DD/MM/AAAA para DD/MM/AAAA por <nome do usuário> em DD/MM/AAAA HH:mm]
    ```
  - `toast.success` e refetch.

Nome do usuário: usar `profile.full_name` ou `user.email` já disponível no contexto.

## 3. Coluna "Vencimento" — critério

Mantém o que já está implementado (qualquer dia após o vencimento = vermelho "X dias em aberto"). Sem faixas de aging. Sem mudança.

## 4. Gate de permissão

Helper local `podeEditarDataRecebimento = role === 'admin' || role === 'gestor'` para esconder o item do menu para `financeiro` e demais perfis.

## Fora do escopo

- Não cria tabela de histórico separada — registro fica no campo `observacoes` (consistente com como recebimentos parciais já são logados).
- Não altera `paymentRoutingService`, lançamentos bancários, nem reverte movimentações antigas.
- Não muda filtros, exportações XLSX/PDF.

## Detalhes técnicos

- `ContaReceber` interface já tem `data_venda` e `data_recebimento`.
- Comparação de datas: usar strings `YYYY-MM-DD` (lexicográfica funciona) ou `new Date(d + "T12:00:00")` para evitar fuso.
- Hoje: `format(getBrasiliaDate(), "yyyy-MM-dd")`.
- Reaproveitar `format(..., "dd/MM/yyyy")` de `date-fns`.


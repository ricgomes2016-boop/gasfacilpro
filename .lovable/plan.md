# Gestão de Empenhos (Licitações Ganhas)

## Visão geral

Reaproveitar a infra existente de **`vale_gas` / `vale_gas_parceiros`** (que já tem status `disponivel`/`utilizado`, vínculo a parceiro, pedido e cliente) e criar uma camada de **Empenhos** acima dela. Cada empenho é um lote de vales físicos numerados pelo usuário, vinculado a um Parceiro (órgão público) e opcionalmente a uma `licitacao`.

```text
licitacao (ganha) ─┐
                   ├─► empenho ──► vale_gas[31..40]  (status=disponivel)
parceiro (órgão) ──┘                      │
                                          ▼ venda no balcão
                                 pedido + cliente_final (escola)
                                          │
                                          ▼
                                  vale.status=utilizado
                                  empenho.qtd_entregue++
```

---

## 1. Banco de dados (uma migration)

### 1.1 Nova tabela `empenhos`
- `id`, `created_at`, `updated_at`
- `unidade_id` (NOT NULL, FK unidades) e `empresa_id` (preenchido por trigger via unidade)
- `parceiro_id` (NOT NULL, FK `vale_gas_parceiros`) — o órgão público
- `licitacao_id` (FK `licitacoes`, opcional)
- `numero_empenho` (text, NOT NULL) + UNIQUE `(empresa_id, numero_empenho)`
- `data_empenho` (date, default hoje)
- `produto_id` (FK `produtos`, NOT NULL)
- `produto_nome` (text, snapshot)
- `quantidade` (int, NOT NULL, >0)
- `valor_unitario` (numeric(15,2), NOT NULL)
- `valor_total` (numeric generated: `quantidade * valor_unitario`)
- `quantidade_entregue` (int, default 0) — mantido por trigger
- `status` (text: `aberto` | `parcial` | `concluido` | `cancelado`)
- `observacoes` (text)
- `nfe_id` / `nfe_numero` / `nfe_chave` (text, nullable) — preenchidos quando a NF-e é emitida
- RLS por `empresa_id` (mesmo padrão das outras tabelas)

### 1.2 Extensão de `vale_gas`
- Adicionar `empenho_id uuid` (FK `empenhos`, ON DELETE RESTRICT, index).
- Adicionar `cliente_final_id uuid` (FK `clientes`) — distinguindo o consumidor (escola) do parceiro pagador (prefeitura).
- Sem mudança nos status existentes (`disponivel` → `utilizado`).

### 1.3 Triggers
- `fn_empenho_fill_empresa`: preenche `empresa_id` a partir da `unidade_id`.
- `fn_empenho_atualizar_saldo`: AFTER INSERT/UPDATE/DELETE em `vale_gas` quando `empenho_id` not null → recalcula `quantidade_entregue` = count(status='utilizado') e ajusta `status` (`aberto`/`parcial`/`concluido`).
- Validação: na inserção de `vale_gas` com `empenho_id`, garantir que `parceiro_id` = parceiro do empenho.

### 1.4 RPC `vincular_vales_empenho(empenho_id, numero_inicial, numero_final)`
- SECURITY DEFINER, valida:
  - `(final - inicial + 1) = empenho.quantidade` (regra 2).
  - Nenhum número do intervalo já existe em `vale_gas` (unique global já cobre, mas retorna erro amigável).
  - Empenho ainda não tem vales vinculados (1 intervalo por empenho; reemissão exige cancelar).
- Insere os N vales (status `disponivel`, `parceiro_id`, `produto_id`, `valor`, `empenho_id`, `unidade_id`) em batch.
- Retorna `{ ok, vales_criados }`.

### 1.5 RPC `consumir_vale_empenho(parceiro_id, numero_vale, cliente_final_id, pedido_id)`
- SECURITY DEFINER. Usado pela tela de venda.
- Localiza vale por `(parceiro_id, numero)`. Erros explícitos:
  - "Vale não encontrado para esse parceiro" / "Vale já consumido" / "Vale cancelado".
- Atualiza `status='utilizado'`, `data_utilizacao=now()`, `cliente_final_id`, `venda_id=pedido_id`.
- Retorna `{ ok, vale, empenho_saldo }`.

---

## 2. Edge function `emitir-nfe-empenho` (mock + hook focusNfeService)

Quando o usuário confirma o intervalo de vales, a UI chama essa function que:
- Monta payload de NF-e (cliente = órgão/parceiro, itens = N x produto do empenho).
- **Obrigatório**: `informacoes_adicionais_contribuinte = "Ref. ao Empenho nº {numero_empenho}"` (regra 3).
- Chama `focusNfeService.emitirNFe(...)` (já existe no front; aqui chamamos via fetch direto ao Focus NFe usando secret `FOCUS_NFE_TOKEN` se presente; se ausente, retorna `{ ok: true, mock: true }` para não bloquear o fluxo).
- Grava `nfe_id/numero/chave` no empenho.

Retorna 200 sempre, com flag `mock` quando token não está configurado.

---

## 3. Frontend

### 3.1 Nova aba **Empenhos** em `src/pages/operacional/Licitacoes.tsx`
Adicionar `Tabs` no topo: **Licitações** (atual) | **Empenhos** (novo). Sem refator do código atual de Licitações.

Conteúdo da aba Empenhos = novo componente `src/components/licitacoes/EmpenhosPanel.tsx`:
- Header com botão **"Novo Empenho"** e filtros (parceiro, status, busca por número).
- Tabela com colunas: Nº Empenho · Parceiro · Produto · Qtd · Entregue · Saldo · Progresso (barra) · NF-e · Status · Ações.
- Ações por linha:
  - **Vincular Intervalo de Vales** (só se ainda não vinculado) → abre modal.
  - **Ver Detalhes** → drawer/dialog com lista de vales (número, status, escola que usou, data, pedido).
  - **Emitir NF-e** (se ainda não emitida) — opcional fora do fluxo automático.

### 3.2 Componentes novos (em `src/components/licitacoes/`)
- `NovoEmpenhoModal.tsx` — form: Parceiro (Select de `vale_gas_parceiros`), Licitação (opcional), Nº Empenho, Data, Produto, Quantidade, Valor Unitário. Mostra total calculado.
- `VincularValesModal.tsx` — campos Número Inicial / Final. Mostra ao vivo `final - inicial + 1` e compara com `empenho.quantidade`; botão Salvar **desabilitado** quando diferente, com mensagem "A quantidade do intervalo não bate com o empenho" (regra 2). Ao confirmar:
  1. Chama RPC `vincular_vales_empenho`.
  2. Em sucesso, dispara edge function `emitir-nfe-empenho` (regra 3); toast de NF-e ok/mock.
- `EmpenhoDetalheDialog.tsx` — lista de vales com filtro por status; mostra escola (`cliente_final_id` → join `clientes`).

### 3.3 Ajustes em `src/pages/vendas/NovaVenda.tsx` (regra 4)
- No bloco de "Canal de Venda / Parceiro" (já existente para vale-gás), quando o parceiro selecionado tiver empenhos abertos:
  - Renderizar campo **"Número do Vale Físico"** (obrigatório).
  - Ao sair do campo / submeter, chamar `consumir_vale_empenho` antes de finalizar o pedido. Sucesso → vincular `vale.venda_id = pedido.id`. Falha → bloquear submit com toast de erro específico.
- Apenas alteração de UI/fluxo desse formulário; sem refator estrutural do componente.

### 3.4 Rota
`Licitacoes.tsx` já é roteada em `operacionalRoutes.ts`; nada novo a registrar — a nova aba vive dentro dela.

---

## 4. Fora de escopo
- Importação automática de e-mails de empenho (entrada continua manual).
- Conciliação financeira do pagamento da prefeitura (já tratada em Contas a Receber existentes).
- Mudanças no app do entregador.

---

## 5. Segurança / RLS
- `empenhos`: SELECT/INSERT/UPDATE/DELETE para usuários da mesma `empresa_id` com role admin/gestor/financeiro (mesmo padrão de `licitacoes`).
- RPCs SECURITY DEFINER validam que o `empenho.empresa_id` pertence ao usuário (`get_user_empresa_id()`).
- Edge function valida JWT em código e usa service role só para escrever na tabela `empenhos`.

---

## 6. Ordem de execução
1. Migration (tabelas + triggers + RPCs + RLS).
2. Edge function `emitir-nfe-empenho`.
3. `EmpenhosPanel` + modais + aba em `Licitacoes.tsx`.
4. Hook do campo "Número do Vale Físico" em `NovaVenda.tsx`.
5. Teste manual: criar empenho 10 unidades → vincular 31–40 → simular venda com vale 35 → conferir saldo 9 e NF-e gravada.

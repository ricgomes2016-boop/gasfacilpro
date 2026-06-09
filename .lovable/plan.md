## Objetivo

Permitir editar e cancelar pedidos agendados na lista, descobrir o motivo do pedido do Borelli não ter sido agendado, e disparar lembrete 10 min antes da entrega.

---

## 1. Por que o pedido do Borelli não está como "agendado"

Verifiquei no banco: o pedido #44 (SUPERMERCADO BORELLI) foi criado hoje às 20:35, mas com `agendado = false`, `data_agendamento = null` e `data_entrega = null`. Ou seja, a Bia **criou o pedido sem chamar a tool com os campos de agendamento** — o LLM caiu no fluxo de "pedido imediato".

Causa provável: o `system prompt` instrui o modelo a calcular a data, mas confia 100% na decisão dele. Em mensagens ambíguas ("agende … amanhã às 8h"), o Gemini às vezes ignora os campos opcionais.

**Correção:** parsing determinístico no servidor — antes de chamar a tool, extrair expressões de data/hora ("amanhã", "sexta", "dia 15", "às 8h", "às 14:30") e injetar `data_entrega`/`hora_entrega` no payload se o LLM não preencheu, ou rejeitar e re-perguntar. Como fallback, log explícito de cada `criar_pedido` mostrando se foi imediato ou agendado.

---

## 2. Filtro e visualização de agendados em `Pedidos.tsx`

- Adicionar tab/filtro **"Agendados"** (além de Hoje / Pendentes / Entregues etc.).
- Critério: `agendado = true AND status NOT IN ('entregue','cancelado')`.
- Mostrar colunas extras quando agendado: **Data agendada** e **Hora**, ordenando por `data_agendamento` ASC.
- Badge azul "📅 Agendado para 10/06 08:00" na linha do pedido.

---

## 3. Editar agendamento

Novo item no `DropdownMenu` da linha: **"Editar agendamento"** (só aparece se `agendado=true`).

Abre dialog `EditarAgendamentoDialog` com:
- Campo **Data** (input date)
- Campo **Hora** (input time)
- Lista de itens com **quantidade editável** (+ / −)
- Botão "Salvar" → atualiza `pedidos.data_entrega`, `data_agendamento` (recombinado), e faz `update` em `pedido_itens.quantidade` por item. Recalcula `valor_total`.
- Botão "Cancelar agendamento" → `update pedidos set status='cancelado'` (mantém histórico). Confirma via `AlertDialog`.

Permissão: respeitar o trigger `validar_alteracao_data_entrega_pedido` (só admin/gestor pode mudar data). Para os demais, esconder os campos de data e permitir só quantidade.

---

## 4. Lembrete 10 minutos antes

**Schema (migration):**
- Coluna `pedidos.lembrete_enviado_em timestamptz` (null por padrão).

**Edge function `notificar-agendamentos`:**
- Busca pedidos com `agendado=true`, `status IN ('pendente','confirmado')`, `lembrete_enviado_em IS NULL`, e `data_agendamento BETWEEN now() AND now() + interval '10 minutes'`.
- Para cada um, insere em `notificacoes` para todos os usuários (admin/gestor/atendente) da empresa daquela unidade:
  - título: "⏰ Agendamento em 10 min"
  - mensagem: "Pedido #N · Cliente X · Bairro Y · entrega às HH:MM"
  - link: `/vendas/pedidos`
- Marca `lembrete_enviado_em = now()`.

**Cron (pg_cron + pg_net):**
- Job a cada 1 minuto chamando a edge function (via `net.http_post`).

**UI:** o `NotificacoesPopover`/sino já existente exibe automaticamente. Adicionar som curto e badge contador (já existe).

---

## 5. Arquivos afetados

- `src/pages/vendas/Pedidos.tsx` — filtro Agendados, coluna data, menu "Editar agendamento".
- `src/components/pedidos/EditarAgendamentoDialog.tsx` — **novo**, dialog de edição/cancelamento.
- `supabase/functions/ai-assistant/index.ts` — parsing determinístico de data/hora pré-tool + log.
- `supabase/functions/notificar-agendamentos/index.ts` — **nova** edge function.
- Migration:
  - `ALTER TABLE pedidos ADD COLUMN lembrete_enviado_em timestamptz`
  - `pg_cron` job 1-min para invocar a função.

---

## 6. Validação

1. Pelo chat da Bia: *"agende 1 P13 pro Borelli amanhã 8h"* → pedido aparece com badge agendado, `data_agendamento` correta.
2. Em `/vendas/pedidos` → tab "Agendados" lista o pedido; editar quantidade e horário → mudanças persistem.
3. Cancelar agendamento → status vira "cancelado", some da lista de agendados.
4. Criar pedido agendado para daqui a 9 minutos → dentro de 1 minuto aparece notificação no sino dos admins/atendentes.

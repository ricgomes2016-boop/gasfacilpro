

# 5 Melhorias Inteligentes para a Bia — Plano Completo

## Resumo

Implementar todas as 5 melhorias sugeridas para a Bia em uma única entrega:

1. **Pós-entrega automático** — avaliação via WhatsApp
2. **Lembrete de recompra inteligente** — já existe (`recompra-whatsapp-dispatch`), melhorar
3. **Detecção de área de entrega** — validar bairros atendidos
4. **Relatório diário via WhatsApp** — resumo para o gestor
5. **Detecção de insatisfação** — tom empático + flag para gestor

---

## 1. Pós-Entrega Automático

**O que faz:** Quando um pedido muda para status "entregue", a Bia envia mensagem pedindo avaliação (1 a 5 estrelas via emoji). O cliente responde com um número e a Bia registra.

**Alterações:**
- **Nova edge function `pos-entrega-feedback/index.ts`** — Disparada pelo trigger existente `fn_notif_status_pedido`. Adaptar para também invocar essa function quando status = "entregue"
- Na verdade, mais simples: **adicionar lógica no `bia-core.ts`** para detectar que o cliente respondeu com avaliação (1-5 ou estrelas) após entrega recente
- **Nova tabela `avaliacoes_entrega`** — `pedido_id`, `cliente_id`, `nota` (1-5), `comentario`, `created_at`
- **Alterar `notificacoes_status_pedido`** — já existe trigger que gera mensagem de entrega. Adicionar lógica na edge function de envio (`status-whatsapp-dispatch`) para incluir pedido de avaliação na mensagem de entrega
- **Alterar `bia-core.ts`** — no `isPostOrderFollowUp`, detectar respostas de avaliação (1-5) e salvar na tabela

**Fluxo:**
1. Pedido muda para "entregue" → trigger existente gera mensagem "✅ Pedido entregue!"
2. Mensagem agora inclui: "De 1 a 5, como foi a entrega? 😊"
3. Cliente responde "5" → Bia detecta, salva avaliação, agradece

## 2. Lembrete de Recompra — Melhorias

**Já existe:** `recompra-whatsapp-dispatch` calcula ciclo médio e envia WhatsApp. `recompra-alerts` gera alertas.

**Melhorias:**
- **Adicionar configuração no RegrasBia.tsx** — `recompra_ativa: boolean`, `recompra_mensagem_personalizada: string`
- **Salvar no `regras_bia`** JSONB
- **Alterar `recompra-whatsapp-dispatch`** para ler config e respeitar se desabilitado

## 3. Detecção de Área de Entrega

**O que faz:** A Bia verifica se o bairro informado pelo cliente está na lista de bairros das `rotas_definidas` da unidade. Se não estiver, informa educadamente.

**Alterações:**
- **`bia-core.ts`** — nova função `checkDeliveryArea(supabase, unidadeId, endereco)` que consulta `rotas_definidas.bairros` e valida
- **`buildSystemPrompt`** — injetar instrução: "Se o endereço do cliente estiver fora da área de entrega, informe educadamente e sugira buscar na loja"
- **Adicionar configuração no RegrasBia.tsx** — `validar_area_entrega: boolean`

## 4. Relatório Diário via WhatsApp

**O que faz:** Edge function agendada (pg_cron) que roda às 19:00 BRT, consulta pedidos do dia, faturamento, top produtos, e envia resumo via WhatsApp para o número do gestor.

**Alterações:**
- **Nova edge function `relatorio-diario/index.ts`** — consulta `pedidos`, `movimentacoes_caixa`, calcula KPIs e envia via WhatsApp
- **Configuração no RegrasBia.tsx** — `relatorio_diario_ativo: boolean`, `relatorio_diario_telefone: string` (telefone do gestor)
- **pg_cron** — agendar execução diária às 19:00

## 5. Detecção de Insatisfação

**O que faz:** No prompt da Bia, instruir para detectar palavras de frustração (demora, ruim, péssimo, atraso, reclamação) e:
- Mudar tom para empático
- Pedir desculpas e oferecer solução
- Marcar conversa com flag `insatisfacao: true` na metadata

**Alterações:**
- **`bia-core.ts` / `buildSystemPrompt`** — adicionar bloco de instruções sobre detecção de insatisfação
- **Metadata nas mensagens** — salvar `{ insatisfacao: true }` quando detectado
- **Painel de conversas** — filtrar conversas com insatisfação (futuro, não nesta entrega)

---

## Tabelas Novas

| Tabela | Colunas |
|---|---|
| `avaliacoes_entrega` | `id`, `pedido_id`, `cliente_id`, `nota` (1-5), `comentario`, `telefone`, `created_at` |

## Arquivos Modificados

| Arquivo | Ação |
|---|---|
| `supabase/functions/_shared/bia-core.ts` | Avaliação pós-entrega, área de entrega, insatisfação no prompt |
| `src/pages/config/RegrasBia.tsx` | Novas configs: recompra, área de entrega, relatório diário |
| `supabase/functions/relatorio-diario/index.ts` | **Nova** — relatório diário via WhatsApp |
| `supabase/functions/recompra-whatsapp-dispatch/index.ts` | Ler config de empresa |
| `fn_notif_status_pedido` | Incluir pedido de avaliação na mensagem de entrega |
| Todos os 5 webhooks | Passar nova lógica de avaliação |
| 1 migration | Criar tabela `avaliacoes_entrega` |
| 1 pg_cron | Agendar relatório diário |

## Ordem de Implementação

1. Migration (tabela `avaliacoes_entrega`)
2. Config UI (RegrasBia.tsx — todas as novas opções)
3. Lógica da Bia (bia-core.ts — avaliação, área, insatisfação)
4. Trigger de entrega (incluir pedido de avaliação)
5. Edge function relatório diário + pg_cron
6. Melhorias recompra
7. Deploy de todos os webhooks


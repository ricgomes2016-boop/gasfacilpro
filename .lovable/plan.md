# Diagnóstico read-only — "Bia falhou mas disse que o pedido foi feito" (/fortegas)

Nenhum código, banco, função ou configuração foi alterado. Nenhum pedido de teste foi criado.

## Fatos apurados (janela 48–72h)

1. **Nenhum pedido foi criado pela Bia.** Consulta em `pedidos` das últimas 72h com `origem_pedido in ('site','assistente_bia','whatsapp')`, `canal_venda ilike '%site%'` ou `observacoes ilike '%bia%'`: **0 linhas**. Os pedidos recentes da unidade Forte Gás (`3a3dbca4-…`) são todos `origem_pedido='erp'`/`balcao_pdv`, canais Entregador/PDV/Disk.
2. **Não há pedido sem item, pedido duplicado nem par cliente/produto/valor repetido** — consequência direta do item 1 (nenhum pedido de origem site existe).
3. **Houve exatamente uma interação da Bia do site**: `chamadas_recebidas` id `fbd894aa-…`, `created_at 2026-08-29 12:32:43 UTC`, `unidade_id 3a3dbca4-…`, `tipo='voip'`, `status='atendida'`, `cliente_id NULL` e sem nome (telefone não encontrado na base). `observacoes = "🤖 Pedido criado pela Bia (site institucional)"`.
4. **Logs da Edge Function `bia-site-chat` não estão disponíveis** — `edge_function_logs` retorna vazio e `function_edge_logs` não tem nenhuma linha com `bia-site-chat` na janela (retenção/nenhuma invocação registrada). Portanto não há evidência de 4xx/5xx, timeout, erro de AI gateway ou invocações repetidas próximas; a evidência utilizável é a do banco.

## Causa raiz provável

**Mensagem falsa de "pedido realizado" originada em `identificar_cliente`, não em `criar_pedido`.**

Em `supabase/functions/bia-site-chat/index.ts:295-303`, a tool `identificar_cliente` — chamada logo no primeiro passo, apenas para buscar o telefone — grava em `chamadas_recebidas` com o texto fixo `"🤖 Pedido criado pela Bia (site institucional)"`. Ou seja, **basta o cliente digitar o telefone para o ERP registrar/exibir "Pedido criado pela Bia"**, mesmo sem nenhum pedido. O horário 12:32:43 UTC de 29/08 coincide com o relato, e não existe pedido correspondente.

Fatores agravantes identificados na leitura do código (contribuem para "conversa não funcionou"):

- **Sem persistência do histórico no servidor.** O histórico vive só em `sessionStorage` do navegador (`BiaChatWidget.tsx:100-131`) e é reenviado inteiro a cada turno. Perda de aba/refresh = perda de contexto; não há como auditar a conversa depois.
- **Resposta final pode se perder após o pedido existir.** No loop de tool calling (linhas 188-265), se a chamada seguinte ao gateway falhar (429/402/5xx) *depois* de `criar_pedido` ter inserido pedido + item, a função retorna erro e o usuário vê "instabilidade" — pedido gravado, resposta perdida. O inverso também: erro de tool volta como texto ao modelo, que pode narrar sucesso indevidamente.
- **Sem idempotência.** `criar_pedido` não tem chave de deduplicação; qualquer retry do usuário (o widget não bloqueia reenvio de conteúdo igual, só `loading`) poderia gerar pedido duplicado. Não ocorreu agora, mas o risco é real.
- **Fallback genérico após 5 iterações** (linha 262-265) devolve "tive um problema" sem indicar se um pedido foi ou não criado.

**Incidente mais provável:** às 12:32 UTC de 29/08 o usuário informou o telefone, a Bia registrou a chamada com o rótulo enganoso "Pedido criado pela Bia", a conversa não avançou até a confirmação (telefone não cadastrado exigiria nome/endereço) e nenhum pedido foi criado. Não houve pedido real, duplicação nem pedido órfão.

## Proposta de correção mínima e segura (não implementada)

1. **Corrigir o rótulo enganoso** (1 linha): em `identificar_cliente`, gravar `observacoes = "🤖 Atendimento iniciado pela Bia (site institucional)"`. O texto de pedido criado só deve ser escrito em `criar_pedido`.
2. **Marcar a chamada quando o pedido de fato nascer**: em `criar_pedido`, após sucesso, atualizar a `chamadas_recebidas` mais recente daquele telefone/unidade para "Pedido nº N criado pela Bia" (ou inserir registro próprio), mantendo rastreabilidade.
3. **Idempotência leve em `criar_pedido`**: antes do insert, verificar pedido da mesma unidade + cliente + valor nos últimos 5 minutos com `origem_pedido='site'`; se existir, retornar o mesmo número em vez de criar outro.
4. **Não perder a confirmação**: se `criar_pedido` teve sucesso e a chamada seguinte ao gateway falhar, retornar uma `reply` determinística com o número do pedido em vez do erro genérico.
5. Opcional (fora do mínimo): persistir a conversa em `ai_conversas`/`ai_mensagens` com `unidade_id`, para auditoria de incidentes futuros — hoje não há trilha.

Nada acima foi aplicado; aguardando sua aprovação.

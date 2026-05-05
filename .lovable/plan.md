
## Diagnóstico (dados reais dos últimos 7 dias)

Consultei `chamadas_recebidas` e `pedidos` no banco e encontrei o seguinte:

- **48 chamadas registradas / apenas 1 com `pedido_gerado_id`** — ou seja, o link chamada → pedido praticamente nunca acontece, e o popup não evolui para "pedido confirmado".
- **Toda ligação cria 2 linhas em `chamadas_recebidas`**: uma do `goto-webhook` (telefone com `+`, `tipo='telefone'`, sem `observacoes`) e outra do `elevenlabs-bia-tools/identificar_cliente` (telefone sem `+`, `tipo='voip'`, "Recebida pela Bia (IA - ElevenLabs)"). Resultado: 2 popups por ligação, e o link cai na linha errada.
- **Pedidos da Bia (#427–#435) foram criados normalmente**, mas o UPDATE que liga `pedido_gerado_id` à chamada não acerta porque:
  1. Em uma das ligações o pedido foi criado **antes** do `identificar_cliente` rodar (chamada 16:13:08, pedido 16:12:11). O lookup procura chamada `voip` sem pedido nos últimos 10 min — mas a Bia chamou `criar_pedido` antes da chamada existir no banco.
  2. O lookup filtra `tipo='voip'`, mas o webhook GoTo grava `tipo='telefone'` — então linhas do GoTo nunca são linkadas.
- **Caller-ID untrusted (0800)**: quando a chamada vem via 0800 GoTo, `identificar_cliente` registra a chamada com `telefone=null` e o popup tem só "Bia atendendo" — sem nenhum identificador útil até o cliente ditar o telefone.
- **Edge function `elevenlabs-bia-tools` sem logs** no dashboard (não aparece em function_edge_logs) — provavelmente está sendo chamada via gateway próprio (não via supabase.functions.invoke), o que dificulta debugar.
- **Voz/preço/desconto**: já configurados corretamente (Bella + regras P13/desconto/água ativas no agente).
- **Popup atual** (`CallerIdPopup.tsx`) já mostra "Bia atendendo" durante a ligação e atualiza quando chega o pedido — UI ok, falta consistência dos dados.

## Plano de correção (6 ajustes)

### 1. Eliminar a duplicação de chamadas (`goto-webhook` + Bia)
Hoje cada ligação grava 2 registros. Vou:
- No `elevenlabs-bia-tools/identificar_cliente`: em vez de **inserir** uma nova chamada, fazer **UPSERT/UPDATE** na chamada `recebida` mais recente da Central Gas dos últimos 2 min (qualquer `tipo`), preenchendo `cliente_id`, `cliente_nome`, observação "Bia atendendo" e padronizando `tipo='voip'`.
- Se não houver chamada anterior (cenário em que GoTo não disparou webhook), aí sim insere uma nova.

Resultado: **1 popup por ligação**, com a info da Bia consolidada.

### 2. Linkar pedido à chamada de forma robusta (`criar_pedido`)
Trocar o lookup atual (`tipo='voip'`, últimos 10 min, sem `pedido_gerado_id`) por:
- Buscar a **chamada mais recente da Central Gas nos últimos 15 min sem `pedido_gerado_id`** (qualquer `tipo`, qualquer status).
- Se não achar (ex.: pedido criado antes do registro chegar), **inserir uma nova linha** já com `pedido_gerado_id` setado e `cliente_nome`/`telefone` do pedido — assim o popup aparece de qualquer jeito.
- Se a chamada anterior existir mas tiver `cliente_id` divergente do pedido, atualizar para o `cliente_id` correto.

### 3. Popup mostra dados úteis quando caller é untrusted
Quando vem do 0800 e `identificar_cliente` cai no ramo "perguntar verbalmente", o popup hoje fica genérico. Vou:
- Gravar `observacoes='📞 Bia perguntando telefone (0800)'` para deixar claro o estado no popup.
- Quando a Bia receber o telefone do cliente e re-chamar `identificar_cliente`, fazer UPDATE da mesma linha (passo 1) com o telefone real e o nome do cliente — o popup atualiza ao vivo via realtime.

### 4. Remover linhas órfãs antigas
Marcar todas as `chamadas_recebidas` com `status='recebida'` há mais de 30 min sem `pedido_gerado_id` como `status='atendida'` — uma limpeza única para o popup parar de mostrar lixo antigo.

### 5. Adicionar logs estruturados no fluxo
Hoje não vejo logs da `elevenlabs-bia-tools` no dashboard. Vou:
- Adicionar `console.log` claros nos pontos críticos: entrada da action, resultado do lookup de chamada, sucesso/falha do UPDATE.
- Conferir se a function está realmente sendo chamada como Supabase Edge Function (URL `…/functions/v1/elevenlabs-bia-tools`) — se estiver indo por outra rota (proxy), os logs vão para outro lugar e precisamos ajustar a URL no agente da ElevenLabs.

### 6. Validação pós-deploy
Depois de aplicar:
- Fazer 1 ligação de teste e checar via SQL: deve haver **1 linha** em `chamadas_recebidas` com `pedido_gerado_id NOT NULL` e `cliente_nome` preenchido.
- Conferir se o popup aparece no canto inferior direito do ERP em tempo real (mesmo com a aba minimizada, via notificação desktop).
- Validar que não existem duas chamadas para a mesma ligação.

## Resultado esperado

- Toda ligação → **1 popup** que evolui de "Bia atendendo" para "Pedido #XXX confirmado".
- Notificação desktop dispara mesmo com o sistema em background.
- Pedido linkado à chamada em 100% dos casos (mesmo quando a ordem dos eventos inverte).
- Operador consegue rastrear cada ligação no histórico com cliente, pedido e duração.

## Detalhes técnicos

- Arquivos a editar: `supabase/functions/elevenlabs-bia-tools/index.ts` (passos 1, 2, 3, 5).
- 1 migração curta para o passo 4 (UPDATE pontual nas chamadas órfãs).
- Sem mudança em `CallerIdPopup.tsx` — a UI já está correta, o problema era de dados.
- Sem mudança no agente ElevenLabs (voz/prompt já ajustados).

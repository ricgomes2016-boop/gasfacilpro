

## Plano: Chat Inteligente do Entregador com IA

### Problema Atual
O `ChatBase.tsx` é apenas um chat humano-para-humano (entregador ↔ base). O entregador não consegue dar comandos por voz/texto como "lança um gás na rua central, 20" ou "transfira 20 gás para a filial ABMF".

### Solução
Transformar o chat do entregador em um chat com IA que entende comandos em linguagem natural, usando a mesma edge function `ai-assistant` (que já tem tools de `criar_pedido`, `registrar_movimentacao_estoque`, etc.), adicionando a tool de transferência de estoque que falta.

### Alterações

**1. Nova Edge Function: `entregador-chat-ia/index.ts`**
- Edge function dedicada para o contexto do entregador
- Reutiliza a lógica do `ai-assistant` mas com system prompt adaptado para o entregador
- Entende comandos coloquiais: "lança um gás", "transfira 20 gás", "quanto tem de P13?"
- Inclui tool `criar_transferencia_estoque` (cria registro em `transferencias_estoque` + itens)
- Inclui tools existentes: `criar_pedido`, `registrar_movimentacao_estoque`, consultas SQL
- Recebe `entregador_id` e `unidade_id` no body para contexto
- System prompt instruindo: "Você é o assistente do entregador. Entenda comandos rápidos como 'lança 1 gás na rua X, 20' (criar pedido), 'transfira 20 P13 pra filial Y' (transferir estoque)"

**2. Reescrever `src/components/entregador/ChatBase.tsx`**
- Substituir o chat humano por chat com IA (streaming SSE, igual `AiAssistantChat`)
- Manter o botão flutuante e Sheet existentes
- Enviar mensagens para a edge function `entregador-chat-ia` em vez de `chat_mensagens`
- Manter `VoiceInputButton` para entrada por voz
- Renderizar respostas com `ReactMarkdown`
- Sugestões rápidas: "Lançar venda", "Consultar estoque", "Transferir gás"

**3. Tool `criar_transferencia_estoque` (na edge function)**
- Parâmetros: `unidade_destino_nome`, `itens` (array de produto_nome + quantidade)
- Busca `unidade_destino_id` por nome (ilike)
- Cria registro em `transferencias_estoque` com status "pendente"
- Cria itens em `transferencia_estoque_itens`

### Escopo
- 1 edge function criada (`entregador-chat-ia`)
- 1 componente reescrito (`ChatBase.tsx`)
- Zero mudanças de banco (tabelas já existem)
- O chat antigo com a base humana será substituído pelo chat IA

### Detalhes Técnicos
- Streaming SSE igual ao padrão `ai-assistant`
- Autenticação via Bearer token do Supabase
- Usa `LOVABLE_API_KEY` (já configurada) e Lovable AI Gateway
- Model: `google/gemini-3-flash-preview`


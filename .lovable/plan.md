## Objetivo

Permitir que comandos de voz como "lança um gás na Rua Aparecido Cassiano, 115, cartão, R$ 125" funcionem tanto no **Dashboard** quanto na **Nova Venda**, criando a venda corretamente.

---

## Mudanças

### 1. `supabase/functions/parse-sales-command/index.ts` — melhorar interpretação

**Etapa 1 (extração de pistas)** — adicionar campos:
- `complemento` (apto, bloco, fundos, etc.)
- `valor_informado` (número decimal quando o operador disser "no valor de R$ X", "por X reais", "cobrei X")
- `forma_pagamento_bruta` (texto livre: "cartão", "pix", "fiado", "dinheiro", "crédito", "débito")
- Reforçar a regra de capturar `numero` mesmo quando vem grudado na rua ("Rua X, 115" / "Rua X número 115" / "Rua X, 115 - apto 2").

**Etapa 3 (montagem da venda)** — atualizar prompt e schema:
- Mapear `forma_pagamento`:
  - "cartão" sem qualificador → `cartao_credito` (padrão mais comum)
  - "crédito" → `cartao_credito`
  - "débito" → `cartao_debito`
  - "pix", "dinheiro", "fiado" → idem
- Se `valor_informado` existir, retornar `preco_unitario` = valor_informado / quantidade (e marcar `preco_manual: true` no JSON de saída).
- Incluir `complemento` no JSON final.

### 2. `src/pages/vendas/NovaVenda.tsx` — respeitar preço manual

No `handleAiCommand` (linhas ~401-500), ao montar `itens` a partir de `data.itens`:
- Se o item vier com `preco_unitario` definido pela IA, **usar esse valor** em vez de sobrescrever pelo `produto.preco` cadastrado.
- Preencher `setCustomer(...)` também com `complemento: data.complemento` (já existe no destino, falta no source).

### 3. Dashboard — fazer o `VoiceAssistant` lançar venda

Hoje (`src/components/ai/VoiceAssistant.tsx`) o `sendToAI` sempre vai para `ai-assistant`. Vamos adicionar **roteamento de intenção** antes:

- Antes do `fetch(CHAT_URL)`, chamar `supabase.functions.invoke("parse-sales-command", { body: { comando: text, unidade_id } })`.
- Se a resposta tiver `itens` (intenção de venda detectada):
  - Salvar o payload em `sessionStorage` com chave `nova_venda_voz_payload`.
  - Navegar para `/vendas/nova?fromVoice=1` via `useNavigate`.
  - Falar: "Abrindo nova venda com os dados…" e fechar o painel de voz.
- Se a resposta for `tipo: "consulta_fiado"`, falar a `mensagem` retornada (sem ir para chat).
- Em qualquer outro caso (erro 422, comando não é venda), cai no fluxo atual (`ai-assistant` chat).

### 4. `src/pages/vendas/NovaVenda.tsx` — auto-preenchimento ao chegar com `?fromVoice=1`

No mount, ler `sessionStorage.getItem("nova_venda_voz_payload")`:
- Se existir, executar o mesmo bloco que `handleAiCommand` já roda após obter `data` (popular customer, itens, forma de pagamento), e limpar o storage.
- Não chamar a edge novamente — o payload já vem pronto.

---

## Detalhes técnicos

**Arquivos editados:**
- `supabase/functions/parse-sales-command/index.ts` (prompt das duas etapas + schema de saída)
- `src/pages/vendas/NovaVenda.tsx` (handleAiCommand respeita `preco_unitario`/`complemento`; novo `useEffect` para `?fromVoice=1`)
- `src/components/ai/VoiceAssistant.tsx` (roteamento de intenção antes do chat)

**Sem alterações em:**
- `App.tsx`, rotas, RLS, tabelas, brand themes, layouts.
- `ai-assistant` edge function (continua só para consultas/chat livre).

**Validação manual após implementar:**
1. Dashboard, microfone: "lança um gás na Rua Aparecido Cassiano 115, cartão, 125 reais" → deve abrir `/vendas/nova` já com endereço, item gás (preço R$ 125) e forma `cartao_credito`.
2. Nova Venda, microfone: mesma frase → mesmo resultado, sem navegar.
3. Dashboard, microfone: "como tá o fiado da Maria?" → fala a resposta (consulta_fiado).
4. Dashboard, microfone: "qual filial vendeu mais essa semana?" → fluxo de chat normal continua.

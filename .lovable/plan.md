
# Otimização da Bia: latência, identificação de endereço e voz

## Objetivos
1. Reduzir o tempo que a Bia leva pra responder após o cliente falar.
2. Evitar duplicação de cliente — quando a Bia pedir o endereço, ela deve buscar pelo telefone falado e, se houver cadastro, **usar o endereço já cadastrado** (apenas confirmar verbalmente).
3. Deixar a voz da Bia mais **jovem e natural** (Lily com ajuste fino), mantendo a apresentação "Bia da Central Gás".

---

## 1. Reduzir latência (resposta mais rápida)

A latência atual vem de: TTS lento + modelo pesado + tools que fazem várias queries em série + estabilidade alta da voz. Ações:

### 1a. Voz: trocar modelo TTS para o mais rápido
Atualizar o agente ElevenLabs (via `elevenlabs-update-bia-voice`) para usar:
- `tts.model_id = "eleven_flash_v2_5"` (latência ~75ms vs ~400ms do `eleven_turbo_v2_5`/multilingual). Lily soa muito bem em flash_v2_5 e mantém PT-BR.
- `tts.optimize_streaming_latency = 3` (otimização agressiva, ainda boa qualidade).
- `tts.expressive_mode = false` (já está, manter — expressivo aumenta latência).

### 1b. LLM: garantir modelo rápido
Verificar `agent.llm` no ElevenLabs e definir um modelo de baixa latência (ex: `gemini-2.0-flash` ou `gpt-4o-mini`) caso esteja em modelo "pro". Adicionar campo no edge function `elevenlabs-update-bia-voice` para permitir trocar `llm.model` via UI da página `AdminBiaVoz`.

### 1c. Tools: paralelizar e cortar consultas redundantes
Em `supabase/functions/elevenlabs-bia-tools/index.ts`:
- `identificar_cliente`: hoje busca cliente em série depois faz upsertChamada. Trocar por `Promise.all([buscaCliente, upsertChamada])`.
- `criar_pedido`: tabela de preços, produto, regras de horário e checagem de duplicado são feitas em série — paralelizar `getRegrasFuncionamento`, `getTabelaPrecosBia` e `produtos lookup`.
- Remover o `select limit 5` de "clientes mesmo telefone" que faz uma 2ª query — usar o telefone já normalizado do `identificar_cliente`.

### 1d. Saudação inicial mais curta
Reduzir `first_message` para ≤8 palavras (ex.: *"Oi, aqui é a Bia da Central Gás. Pois não?"*). Frase grande atrasa o primeiro turno.

---

## 2. Endereço: usar cadastro existente (anti-duplicação)

Hoje a Bia é instruída a **NÃO** ler o endereço cadastrado e **sempre** pedir verbalmente — isso gera duplicação porque, quando o cliente confirma "é o mesmo", a IA frequentemente cria cliente novo com endereço incompleto.

### Mudanças

**A. `identificar_cliente` (edge function)** — Quando o cliente é encontrado, retornar mensagem nova:
> "Cliente identificado: **{nome}**, endereço cadastrado **{rua, nº, bairro}**. Confirme dizendo: 'É a mesma entrega de sempre, na **{rua}**, número **{número}**?' — se o cliente confirmar (sim/isso/correto/igual), chame `criar_pedido` passando **APENAS** `cliente_id` (sem endereço/numero/bairro novos). Só peça endereço diferente se o cliente disser explicitamente que mudou."

**B. `criar_pedido` (edge function)** — Quando vier `cliente_id` sem endereço:
- Buscar `endereco/numero/bairro/cep` do cliente automaticamente e usar como `endereco_entrega`.
- **Nunca criar novo cliente** se `cliente_id` foi enviado.
- Se a Bia mandar endereço **diferente** do cadastrado para um `cliente_id` existente, **não criar cliente novo** — apenas registrar `endereco_entrega` no pedido (entrega pontual em outro lugar) e adicionar uma observação `"Endereço alternativo informado por telefone"`.

**C. Nova action `confirmar_endereco_cadastrado`** (opcional, mais robusta) — A Bia chama com `cliente_id` para reaproveitar o endereço. Retorna o pedido pronto pra criar.

**D. Atualizar o system prompt da Bia** (via página `/admin/bia/voz` → campo `prompt`) com regra clara:
- "Se `identificar_cliente` retornou `encontrado: true`, **confirme o endereço cadastrado em uma única frase** ('Confirma a entrega na Rua X, 123?'). Se o cliente disser sim, use só `cliente_id` ao criar o pedido. Nunca pergunte rua/número/bairro de novo se o cliente confirmou."
- "Nunca crie novo cliente se `identificar_cliente` retornou `cliente_id`."

---

## 3. Voz mais jovem e natural (Lily refinada)

Manter `voice_id = pFZP5JQG7iQjIQuC4Bku` (Lily). Ajustes:

| Parâmetro | Valor proposto | Por quê |
|---|---|---|
| `model_id` | `eleven_flash_v2_5` | Mais natural em PT-BR + baixa latência |
| `stability` | `0.35` | Mais variação emocional → menos robótica |
| `similarity_boost` | `0.75` | Mantém o timbre jovem da Lily |
| `style` | `0.45` | Acrescenta expressividade jovem |
| `use_speaker_boost` | `true` | Clareza no telefone |
| `speed` | `1.02` | Levemente acima do natural — soa mais "viva" |

Aplicar em 2 etapas:
1. Adicionar `model_id`, `style` e `optimize_streaming_latency` aos parâmetros aceitos pelo edge function `elevenlabs-update-bia-voice` (hoje só aceita speed/stability/similarity_boost/expressive_mode).
2. Expor no painel `AdminBiaVoz.tsx` um botão **"Aplicar preset Lily Jovem"** que envia esses valores de uma vez.
3. Rodar o preset automaticamente na primeira execução pós-deploy (script único de setup).

---

## Arquivos afetados

- `supabase/functions/elevenlabs-update-bia-voice/index.ts` — aceitar `model_id`, `style`, `optimize_streaming_latency`, `llm_model`.
- `supabase/functions/elevenlabs-bia-tools/index.ts` — paralelizar queries; reaproveitar endereço cadastrado em `criar_pedido` quando vier só `cliente_id`; nunca criar cliente novo se `cliente_id` informado; nova mensagem em `identificar_cliente`.
- `src/pages/admin/AdminBiaVoz.tsx` — novo preset "Lily Jovem", campos para model TTS e modelo LLM.
- Atualização do **system prompt** e **first_message** da Bia (via UI após deploy, ou script único).

## Validação
Após deploy: ligar no 4337717463 → confirmar (a) primeira fala em <2s, (b) Bia confirma endereço cadastrado em vez de pedir do zero, (c) tom da voz mais jovem.


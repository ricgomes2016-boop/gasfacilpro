# Bia: deixar mais lenta e mais gentil

## Diagnóstico (ElevenLabs ao vivo)

Configuração atual do agente `agent_2501kpf1v7ayf9r9nwdrjedmjt5s` (Sarah, voz `EXAVITQu4vr4xnSDxMaL`):

```json
{
  "speed": 1.08,            ← acelerada (default seria 1.0)
  "stability": 0.5,
  "similarity_boost": 0.8,
  "expressive_mode": false, ← sem expressividade emocional
  "model_id": "eleven_turbo_v2_5",
  "optimize_streaming_latency": 3
}
```

**Causa da pressa**: `speed: 1.08` (8% mais rápida que o natural).
**Causa da falta de gentileza**: depende de duas coisas — voz (TTS) + prompt do agente. O TTS atual é frio (`expressive_mode: false`, stability alta = monótona). E provavelmente o prompt diz "seja objetiva/rápida" mas não diz "seja calorosa".

## O que vou fazer

### 1. Ajustar TTS (voz)
Patch via `elevenlabs-update-bia-voice`:
- `speed: 0.95` (5% mais lenta que o natural — soa mais cuidadosa, sem virar lerda)
- `stability: 0.4` (um pouco menos = mais variação emocional, mais humana)
- `similarity_boost: 0.85` (mais aderência à voz Sarah, que é naturalmente acolhedora)

### 2. Estender a edge function `elevenlabs-update-bia-voice` para também ler/atualizar o **prompt** do agente
Hoje ela só mexe em TTS. Vou adicionar:
- `GET ?include=prompt` → retorna prompt atual (`agent.prompt.prompt`)
- `POST { prompt: "..." }` → patcha o prompt
- `POST { first_message: "..." }` → patcha a saudação inicial

### 3. Atualizar o prompt da Bia para ficar gentil
Adicionar/reforçar no início do system prompt:

> "Você é a Bia, atendente da Central Gás. Seu tom é **caloroso, paciente e gentil**, como uma recepcionista experiente que gosta do que faz. Sempre cumprimente o cliente com calma, agradeça quando ele responder, e use expressões como 'claro', 'com certeza', 'fico feliz em ajudar', 'um momentinho' (sem exagerar). Nunca corra. Se precisar de uma informação, peça com gentileza: 'Pode me dizer seu telefone com DDD, por favor?' em vez de 'Telefone?'. Confirme cada passo com o cliente antes de prosseguir."

Sem mexer em outras regras já existentes (ferramentas, fluxo de pedido, identificar_cliente etc.) — só **prepender** essas instruções de tom no começo.

### 4. First message mais acolhedor
Trocar a saudação inicial para algo como:
> "Oi, tudo bem? Aqui é a Bia, da Central Gás. Em que eu posso te ajudar hoje?"

(em vez do que provavelmente está hoje, mais seco)

### 5. Página de teste rápido em `/admin/bia-voz`
Pequena tela admin com:
- Sliders para speed (0.85–1.10), stability (0.2–0.7), similarity_boost (0.5–1.0)
- Textarea para o prompt
- Input para first message
- Botão "Salvar" (chama a edge function patchada)
- Botão "Testar com a Bia" (link/QR para ligar e ouvir)

Assim você ajusta sem depender de mim, e vai calibrando até ficar do jeito que quer.

## Arquivos que vou tocar

- `supabase/functions/elevenlabs-update-bia-voice/index.ts` — adicionar suporte a prompt + first_message
- `src/pages/admin/AdminBiaVoz.tsx` — nova página
- `src/routes/adminRoutes.ts` — adicionar rota
- Aplicar patch inicial via edge function (rodar 1 vez): speed 0.95, stability 0.4, novo prompt e first message

## O que NÃO vou fazer

- Trocar de voz (Sarah é boa, é só calibrar).
- Trocar de modelo (`eleven_turbo_v2_5` é o ideal pra latência baixa em telefone).
- Ativar `expressive_mode: true` agora — pode adicionar latência. Deixo como toggle na página caso queira testar depois.
- Mexer em ferramentas, identificar_cliente, criar_pedido — nada de regressão funcional.

## Resultado esperado

- Bia atende ~5% mais devagar, com leve variação emocional na fala.
- Tom verbal gentil e acolhedor desde o primeiro "oi".
- Você ganha um painel `/admin/bia-voz` para calibrar fino sem precisar me chamar.

## Diagnóstico

Configuração atual da Bia (ElevenLabs Conversational AI):
- **Voice ID**: `pFZP5JQG7iQjIQuC4Bku` (Lily — voz inglesa, sotaque carregado em PT)
- **Model**: `eleven_multilingual_v2` (qualidade alta, mas latência maior e prosódia mais "lida" no telefone)
- **stability 0.40 / similarity 0.85 / speed 0.98 / expressive_mode false**

A Vapi soava mais natural porque usava por padrão **OpenAI TTS** com vozes treinadas para conversação telefônica. No ElevenLabs, para aproximar dessa naturalidade em ligação, precisamos de:
1. Voz **nativa PT-BR** (não Lily multilingue).
2. Modelo **`eleven_turbo_v2_5`** ou **`eleven_flash_v2_5`** — feitos para conversa em tempo real, prosódia mais espontânea e latência menor (essencial em telefonia, onde latência alta força o modelo a "cortar" emoção).
3. **`style` > 0** (atualmente nem está setado) para dar entonação coloquial.
4. Reduzir `stability` p/ ~0.30 → mais variação humana.

## Plano

### 1. Aplicar preset "Brasileira Natural" via `elevenlabs-update-bia-voice`
Patch único no agente ElevenLabs:
```
voice_id: "FGY2WhTYpPnrIDTdsKH5"   // Laura — feminina, calorosa, funciona muito bem em PT
model_id: "eleven_turbo_v2_5"
stability: 0.30
similarity_boost: 0.80
style: 0.55
use_speaker_boost: true
speed: 1.0
optimize_streaming_latency: 3
expressive_mode: false              // expressive aumenta latência no telefone
```

### 2. Adicionar botão de preset "Brasileira Natural" em `src/pages/admin/AdminBiaVoz.tsx`
Hoje há `gentle / neutral / fast / lily_jovem`. Vou adicionar **`brasileira_natural`** com os parâmetros acima, para que você consiga voltar/alternar com 1 clique.

### 3. Botão extra "Preset Vapi-like (Sarah PT)"
Alternativa caso Laura não agrade — usa `EXAVITQu4vr4xnSDxMaL` (Sarah) com mesmos settings. Sarah tem timbre mais jovem/Vapi-like.

### 4. Aplicar imediatamente o preset "Brasileira Natural"
Após o deploy do botão, disparo a chamada para já deixar a Bia rodando com a nova voz. Você liga em **+55 43 2398-0020** e confirma.

## Resultado esperado
- Voz feminina PT-BR sem sotaque inglês.
- Latência menor (turbo + latency 3) → menos pausas robóticas entre frases.
- Entonação coloquial ("oi, tudo bem?" soando natural, não declamado).
- Se ainda não agradar, alternamos com 1 clique entre Laura / Sarah / Lily / presets antigos.

## Detalhes técnicos
- Sem mudança em `twilio-voice-webhook` nem em `register-call` — só patch no agente ElevenLabs via API `PATCH /v1/convai/agents/{id}`.
- `model_id` `eleven_turbo_v2_5` suporta PT nativo e é o recomendado pela ElevenLabs para Conversational AI em telefonia.
- Mantém `agent_output_audio_format: pcm_16000` (compatível com Twilio Media Streams).
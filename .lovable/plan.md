## Objetivo

Deixar a voz da Bia **mais meiga, doce e acolhedora**. Hoje ela usa **Sarah** (EXAVITQu4vr4xnSDxMaL) — voz neutra/profissional. Vamos trocar para uma voz mais carinhosa e permitir trocas futuras.

## Mudanças

### 1. Estender `elevenlabs-update-bia-voice/index.ts`
Adicionar suporte a:
- `voice_id` (string) — permite trocar a voz da Bia
- `style` (0-1) — controla expressividade/emoção (mais "estilo" = voz mais doce e calorosa)

### 2. Aplicar nova voz mais meiga
Trocar Sarah → **Matilda** (`XrExE9yKIg1WjnnlVkGX`) — voz feminina suave, calorosa, ótima para atendimento acolhedor em PT-BR no `eleven_turbo_v2_5`.

Configuração final:
- `voice_id`: `XrExE9yKIg1WjnnlVkGX` (Matilda)
- `speed`: 0.88 (calmo, natural)
- `stability`: 0.55 (permite leve variação emocional)
- `similarity_boost`: 0.85
- `style`: 0.4 (mais expressiva/meiga)

### 3. Confirmação "Bia da Central Gás"
Já está correto no `first_message`: *"Oi, tudo bem? Aqui é a Bia da Central Gás. Em que eu posso te ajudar?"* — manter.

### Alternativas de voz (caso Matilda não agrade)
- **Lily** (`pFZP5JQG7iQjIQuC4Bku`) — jovem, doce
- **Alice** (`Xb7hH8MSUJpSbSDYk0k2`) — confiante, calorosa
- **Jessica** (`cgSgspJ2msm6clMCkdW9`) — empática

Após aprovar, aplico via PATCH na ElevenLabs e você pode ligar para testar. Se não gostar de Matilda, troco em segundos.

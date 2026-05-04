## Ajustar velocidade da voz da Bia via API ElevenLabs

Os secrets `ELEVENLABS_API_KEY` e `ELEVENLABS_AGENT_ID` já estão configurados — ou seja, dá pra ajustar **automaticamente** sem você precisar entrar no painel.

### O que vou fazer

Criar uma edge function `elevenlabs-update-bia-voice` que:

- **GET** → consulta a config TTS atual do agente Bia (mostra `voice_id`, `model_id`, `speed`, `stability` etc.).
- **POST** com `{ "speed": 0.9 }` → faz `PATCH https://api.elevenlabs.io/v1/convai/agents/{agent_id}` ajustando apenas o bloco `conversation_config.tts.speed`, **preservando** voz, modelo e demais configurações.

Aceita parâmetros opcionais:
- `speed` (0.7–1.2, default `0.9`)
- `stability` (0–1, opcional)
- `similarity_boost` (0–1, opcional)

### Fluxo de execução (logo após aprovar)

1. Crio a function.
2. Chamo `GET` → te mostro o `speed` atual.
3. Chamo `POST { "speed": 0.9 }` → reduz 10%.
4. Te confirmo o resultado (status + valores aplicados).

Se quiser outra velocidade (ex. `0.85` mais devagar ainda, ou `0.95` só um toque), é só me dizer no momento.

### Arquivos
- `supabase/functions/elevenlabs-update-bia-voice/index.ts` — nova function (GET + POST)

### Observações
- A function NÃO precisa estar em `supabase/config.toml` — Lovable deploya com `verify_jwt = false` por padrão, e ela é uma ferramenta interna chamada por mim.
- Não mexe no System Prompt nem nas tools — só no parâmetro `tts.speed` do agente.
- Pode ser deletada depois se você preferir, ou deixada para ajustes futuros.
## Ajustes no atendimento da Bia (telefone)

Três mudanças solicitadas. Duas são alterações de código (greeting da operadora + prompt/textos da Bia). A terceira (velocidade da fala) precisa ser ajustada no painel da ElevenLabs, pois é lá que o agente de voz da Bia roda — explico abaixo.

### 1. Remover "Conectando você a Central Gás, um momento."

Essa frase é falada pelo Vonage (operadora) **antes** de transferir a chamada para a Bia. Está em `supabase/functions/vonage-voice-webhook/index.ts` (linha ~202-211).

**Ação:** remover o bloco `talk` do NCCO, deixando apenas o `connect`. A chamada será encaminhada direto para a Bia, sem mensagem intermediária.

```ts
const ncco: any[] = [
  {
    action: 'connect',
    from,
    timeout: 45,
    eventUrl: [EVENT_URL],
    eventMethod: 'POST',
    endpoint: [endpoint],
  },
];
```

### 2. Pedir só o primeiro nome (não o nome completo)

Trocar as instruções nas tools/prompts da Bia para pedir apenas o **primeiro nome**.

**Arquivos:**
- `supabase/functions/elevenlabs-bia-tools/index.ts` (linha 173):
  - De: `"Cliente novo. Peça o nome completo e endereço (rua, número, bairro)."`
  - Para: `"Cliente novo. Peça apenas o primeiro nome e o endereço (rua, número, bairro)."`
- `supabase/functions/bia-site-chat/index.ts` (linha 138): substituir "peça nome completo" por "peça o primeiro nome".
- Atualizar também o **System Prompt da Bia no painel ElevenLabs** para reforçar a regra (instrução textual abaixo).

### 3. Reduzir a velocidade da fala da Bia

A voz da Bia é gerada pela **ElevenLabs** via agente configurado no painel deles (não há `voice_settings` no código que possamos sobrescrever — o `elevenlabs-conversation-token` apenas emite token; o agente roda 100% no lado ElevenLabs). Portanto a velocidade precisa ser ajustada lá:

**Passos no painel ElevenLabs (vou te guiar após aprovar):**
1. Acessar `Conversational AI → Agents → [agente da Bia]`
2. Aba **Voice** → ajustar:
   - `Speed`: de `1.0` para **`0.9`** (10% mais devagar — fala mais natural)
   - `Stability`: manter ~`0.5`
3. Salvar.

Se preferir, posso aplicar via API (precisamos do `ELEVENLABS_API_KEY` já cadastrado e do `agent_id`), criando uma edge function temporária `update-bia-voice-settings` que faz `PATCH` em `https://api.elevenlabs.io/v1/convai/agents/{agent_id}` ajustando `tts.speed = 0.9`. Me confirme se quer essa via automatizada.

### Adicional: atualizar o System Prompt da Bia (ElevenLabs)

No painel da ElevenLabs, no **System Prompt** do agente da Bia, ajustar duas linhas:

- Substituir qualquer pedido de "nome completo" por **"primeiro nome"**.
- Adicionar: *"Fale em ritmo calmo e pausado, sem pressa."* (reforço do prompt além do `speed`).

Posso te entregar o prompt completo atualizado junto da implementação.

---

### Arquivos a editar
- `supabase/functions/vonage-voice-webhook/index.ts` — remover bloco `talk`
- `supabase/functions/elevenlabs-bia-tools/index.ts` — texto "primeiro nome"
- `supabase/functions/bia-site-chat/index.ts` — texto "primeiro nome"

### Decisão pendente
Quer que eu também crie a edge function temporária para ajustar a velocidade via API ElevenLabs automaticamente, ou prefere ajustar manualmente no painel?
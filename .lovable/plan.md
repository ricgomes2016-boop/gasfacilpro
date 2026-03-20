

# Corrigir: Bia nao reconhece audio

## Problema

A funcao `transcribeAudio` em `bia-core.ts` envia o audio usando o formato `input_audio` do OpenAI, mas o modelo configurado e `google/gemini-3-flash-preview`. O gateway Lovable AI com modelos Gemini **nao suporta o content type `input_audio`** — esse formato e exclusivo dos modelos OpenAI com suporte nativo a audio.

Codigo atual (linha 786-790):
```json
{
  "type": "input_audio",
  "input_audio": { "data": "base64...", "format": "ogg" }
}
```

Gemini espera midia inline via `image_url` com data URI, que funciona para qualquer tipo de midia (imagem, audio, video):
```json
{
  "type": "image_url",
  "image_url": { "url": "data:audio/ogg;base64,..." }
}
```

## Solucao

**Arquivo:** `supabase/functions/_shared/bia-core.ts` — funcao `transcribeAudio`

Alterar o formato do content block de `input_audio` para `image_url` com data URI base64, que e o formato compativel com Gemini via API OpenAI-compatible:

```typescript
content: [
  {
    type: "image_url",
    image_url: { url: `data:${mimeType};base64,${audioBase64}` },
  },
  {
    type: "text",
    text: "Transcreva EXATAMENTE o que a pessoa disse neste áudio...",
  },
],
```

Tambem adicionar `max_tokens: 2000` para garantir resposta completa.

### Arquivos modificados
- `supabase/functions/_shared/bia-core.ts` — apenas a funcao `transcribeAudio` (~5 linhas)


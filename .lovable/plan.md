

# Adicionar botão de microfone na Assistente IA

## Problema
O componente `AiAssistantChat` já possui suporte a voz (botão de microfone via `VoiceInputButton` e TTS via `TtsButton`), mas só exibe quando a prop `enableVoice={true}` é passada. A página `/assistente-ia` passa apenas `fullPage` sem `enableVoice`.

## Solução
Uma única alteração: adicionar `enableVoice` na chamada do componente em `AssistenteIA.tsx`.

### Arquivo: `src/pages/AssistenteIA.tsx`
- Mudar `<AiAssistantChat fullPage />` para `<AiAssistantChat fullPage enableVoice />`

Isso ativa:
- **Botão de microfone** no campo de input (Speech-to-Text via Web Speech API em pt-BR)
- **Botão de ouvir resposta** (TTS) em cada mensagem da IA


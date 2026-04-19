
Bia conversacional por voz no site Forte Gás — cliente fala no microfone, ela responde por voz, em tempo real.

## Abordagem: ElevenLabs Conversational AI (Agent)

Já temos `ELEVENLABS_AGENT_ID` configurado nos secrets — perfeito. Vou usar o SDK oficial `@elevenlabs/react` (`useConversation`) com WebRTC: latência baixa, transcrição + TTS + LLM tudo gerenciado pela ElevenLabs.

## O que vou fazer

**1. Edge function `elevenlabs-conversation-token`** (nova, pública)
- Gera token WebRTC de uso único usando `ELEVENLABS_AGENT_ID` + `ELEVENLABS_API_KEY`
- Mantém a API key segura no servidor

**2. Componente `BiaAvatarSite.tsx`** (novo)
- Avatar circular flutuante (canto inferior direito do site)
- Ao clicar: abre card com avatar grande + botão "Falar com a Bia"
- Pede permissão de microfone, busca o token, conecta via WebRTC
- Estados visuais: idle / conectando / ouvindo / falando (animação de ondas)
- Avatar pulsa quando `isSpeaking`
- Botão "Encerrar conversa" e fechar
- Mostra transcrição ao vivo do que cliente falou + última resposta da Bia (texto pequeno, opcional)

**3. Avatar visual**
- Gerar 1 imagem da Bia (ilustração profissional, paleta azul/laranja Forte Gás) via Lovable AI image
- Salvar em `src/assets/bia-avatar.png`

**4. Integração em `ForteGas.tsx`**
- Importar e renderizar `<BiaAvatarSite />` fixed bottom-right, posicionado para não sobrepor o botão WhatsApp

**5. Pacote**
- Adicionar `@elevenlabs/react` ao projeto

## Configuração necessária no painel ElevenLabs (usuário faz)
O agente (`ELEVENLABS_AGENT_ID`) precisa estar configurado com:
- **System prompt**: "Você é a Bia, atendente da Forte Gás… [info da empresa: produtos P13/P20/P45, água 20L, telefone (43) 3524-1094, WhatsApp (43) 99966-1816, endereço Rua Benjamin Constant, 110, Cornélio Procópio-PR, horário…]"
- **First message**: "Oi! Eu sou a Bia da Forte Gás. Como posso te ajudar?"
- **Language**: Portuguese (pt)
- **Voice**: feminina PT-BR
- **Authentication**: pode deixar público (sem auth) se quiser pular o token, ou manter privado e usar o token (recomendado)

Vou deixar o componente preparado pra ambos os modos — se o agente for público, usa só `agentId`; se privado, usa o token gerado pela edge function.

## Arquivos
- `supabase/functions/elevenlabs-conversation-token/index.ts` (novo)
- `src/assets/bia-avatar.png` (gerado)
- `src/components/site/BiaAvatarSite.tsx` (novo)
- `src/pages/publico/ForteGas.tsx` (montar componente)
- `package.json` (add `@elevenlabs/react`)

## Resultado
Visitante clica no avatar → permite microfone → fala normalmente → Bia responde por voz em tempo real, conversando sobre a Forte Gás, produtos, preços, horário, e direciona para WhatsApp se quiser fechar pedido.

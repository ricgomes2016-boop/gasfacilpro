## Objetivo
Tornar o tom do chat da Bia/Bot levemente mais formal (mas não excessivo) e simplificar ao máximo a experiência de chat.

## Arquivos a alterar

### 1. Edge function `ai-assistant` (linha ~585)
- **System prompt do GásBot**: ajustar instruções de tom para ser "direto, simples e levemente formal". Remover emojis, gírias e expressões muito coloquiais no prompt.
- **Simplificar a descrição de formatação**: manter apenas o essencial (tabelas, negrito, R$).

### 2. Edge function `bia-site-chat` (linha ~134)
- **System prompt da Bia**: alterar de "simpática, breve e objetiva (responda como em WhatsApp)" para "cordial, simples e objetiva". Manter frases curtas, mas sem gírias excessivas.
- **Regras de fluxo**: simplificar a linguagem das instruções internas.

### 3. Componente `AiAssistantChat.tsx` (linhas ~399-404)
- **Saudação inicial**: simplificar texto. Trocar "Olá! Sou o GásBot, assistente IA do sistema. Pergunte sobre dados, peça análises ou execute ações no sistema." por algo mais direto e levemente formal.
- **Loading**: trocar "Pensando..." por algo mais neutro (ex: "Processando...").

### 4. Componente `BiaChatWidget.tsx` (linhas ~99-104)
- **Saudação inicial padrão**: simplificar. Trocar "Oi! Sou a Bia da ${nomeLoja} 👋 Pra agilizar seu pedido, me passa seu telefone com DDD?" por algo mais direto, sem emoji, levemente formal.

### 5. Componente `VoiceAssistant.tsx` (linha ~302)
- **Label**: trocar "GásBot:" por "Assistente:".

## Critérios de aceite
- Nenhum emoji nos prompts de sistema ou saudações iniciais.
- Frases curtas e diretas.
- Tom cordial, sem ser robótico — evitar "Vossa Senhoria" ou "Prezado", mas também evitar "E aí", "beleza", "show".
- Nenhuma mudança de funcionalidade — apenas texto/prompt.
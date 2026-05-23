## Problema
A Bia (atendente IA por telefone — Twilio +5543 2398-0020) informou ao cliente o valor de R$ 102 pelo Gás P13, quando o preço oficial cadastrado em `configuracoes_empresa.regras_bia.tabela_precos` é R$ 125 (normal) / R$ 120 (com desconto).

## Diagnóstico
Tabela de preços do banco está correta: `gas_p13 = {preco: 125, preco_desconto: 120}`.

Causas combinadas:
1. **Tool `consultar_precos` (em `elevenlabs-bia-tools/index.ts`) retorna apenas `preco`, ignora `preco_desconto`** — Bia nunca soube do desconto via tool.
2. **A Bia provavelmente NÃO chamou `consultar_precos` antes de cotar** e alucinou o valor — o prompt do agente no ElevenLabs não obriga a consulta antes de informar preço.
3. **Nenhuma resposta de tool empurra a tabela proativamente** — `identificar_cliente` não envia preços, então ela depende 100% de chamar a tool certa na hora certa.

## Correções

### 1. `supabase/functions/elevenlabs-bia-tools/index.ts` — action `consultar_precos` (~linha 214)
- Retornar `preco` E `preco_desconto` para cada item.
- Mensagem reescrita com instrução explícita: "Cote SEMPRE o preço NORMAL primeiro; só ofereça o preço com desconto se o cliente pedir desconto, perguntar 'tem desconto?', mencionar concorrência ou hesitar no fechamento. NUNCA invente valores."

### 2. `elevenlabs-bia-tools/index.ts` — action `identificar_cliente` (~linha 333)
- Anexar a tabela de preços oficial dentro da `mensagem` retornada já no primeiro turno, para a Bia ter o valor antes mesmo de chamar `consultar_precos`. Formato curto: "Tabela oficial — P13: R$ 125 (R$ 120 com desconto); P20: R$ 210 (R$ 200); P45: R$ 410 (R$ 400); Água 20L: R$ 20. Use exclusivamente estes valores."

### 3. `elevenlabs-bia-tools/index.ts` — action `criar_pedido` (~linha 488)
- Continuar usando `preco` (normal) por padrão.
- Aceitar parâmetro novo opcional `usar_desconto: boolean` enviado pela Bia → quando true, usa `preco_desconto`. Registrar nas observações do pedido se aplicou desconto.

### 4. Atualizar o prompt do agente Bia no ElevenLabs (via `elevenlabs-update-bia-voice`)
- Adicionar bloco de regras de preço no system prompt:
  - "JAMAIS invente preços. Os únicos valores válidos são os retornados pela ferramenta `consultar_precos` (ou já fornecidos pela ferramenta `identificar_cliente`)."
  - "Cote primeiro o preço NORMAL. Só informe o preço com desconto se o cliente pedir desconto explicitamente."
  - "Se o cliente disser que viu outro valor, peça desculpa, confirme o preço da tabela e ofereça o preço com desconto."
- Será feito chamando o endpoint POST de `elevenlabs-update-bia-voice` com o `prompt` atualizado (mantendo as demais regras já existentes — a edge function lê o atual e faz patch).

## Critérios de aceite
- `consultar_precos` retorna `[{nome, preco, preco_desconto}, ...]`.
- `identificar_cliente` já entrega a tabela oficial na mensagem.
- Agente Bia no ElevenLabs com regra escrita proibindo inventar preços.
- Cliente que ligar e perguntar "quanto é o gás?" ouve "R$ 125,00", e se pedir desconto ouve "posso fazer por R$ 120,00".

## Observação
Não vou simular ligação real (não temos acesso a Twilio aqui). Após o deploy, peço para você ligar uma vez e validar a frase que a Bia diz. Se ainda inventar valor, ajustamos o prompt mais agressivamente.
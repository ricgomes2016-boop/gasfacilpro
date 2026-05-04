## Objetivo
Quando a Bia identifica o cliente pelo cadastro (via caller-id), ela NÃO deve recitar o endereço completo no telefone. Deve apenas pedir: "me confirma seu endereço" e aguardar o cliente falar. O endereço cadastrado serve só de referência interna — o que o cliente disser prevalece.

Motivo: as chamadas chegam via encaminhamento (GoTo 0800 → Vonage), e em muitos casos o número que chega é o do operador, não o do cliente real. Mesmo quando há match, o número pode ser de um familiar/antigo morador. Confirmar lendo o endereço em voz alta induz o cliente a dizer "isso" mesmo quando está errado.

## Mudança técnica

**Arquivo:** `supabase/functions/elevenlabs-bia-tools/index.ts` (action `identificar_cliente`, linhas ~156-174)

Ajustar o payload de retorno quando o cliente é encontrado:

1. **Remover** a frase em `mensagem` que recita rua/número/bairro.
2. **Trocar** por instrução para a Bia apenas perguntar: *"Me confirma seu endereço, por favor?"* — sem citar nada do cadastro.
3. Manter os campos `endereco`, `numero`, `bairro`, `cidade`, `endereco_completo` no JSON de retorno (uso interno do agente, não falado).
4. Adicionar instrução explícita no campo `mensagem`: *"NÃO leia o endereço cadastrado em voz alta. Pergunte abertamente e compare silenciosamente com o cadastro. Se o cliente ditar um endereço diferente, use o que ele falou."*

Para cliente novo (linha 173) — manter como está, já pede o endereço aberto.

## Resultado esperado
- Bia atende → "Oi, aqui é a Bia, com quem falo?" → cliente diz nome
- Bia: "Me confirma seu endereço, por favor?"
- Cliente dita endereço → Bia usa o que foi falado (não o do cadastro) ao criar o pedido

## Arquivos alterados
- `supabase/functions/elevenlabs-bia-tools/index.ts` (1 edit pontual no retorno de `identificar_cliente`)
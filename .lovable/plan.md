

# Análise Completa: Bia Repetindo Pagamento + Notificação Desktop

## Problema 1: Bia repetindo "Qual a forma de pagamento?"

### Diagnóstico da imagem

A cliente Janaína pediu gás, a Bia perguntou pagamento, ela respondeu "Sim em dinheiro" e "Dinheiro" **múltiplas vezes**, mas a Bia continuou repetindo a mesma pergunta. Isso indica duas causas raiz:

**Causa A — Histórico insuficiente ou duplicado:** O `loadHistory` carrega 20 mensagens, mas se a resposta da Bia é salva (`saveMessage`) **antes** de enviar ao WhatsApp, e o envio falha/demora, a próxima mensagem do cliente pode processar com um histórico onde a resposta da Bia anterior ainda não foi persistida, causando a IA perder contexto.

**Causa B — Prompt não injeta a mensagem atual como contexto explícito:** O system prompt diz "Se o cliente já informou pagamento, NÃO pergunte", mas a IA precisa reconhecer isso **dentro do histórico**. Se mensagens anteriores do user contendo "dinheiro" aparecem mas intercaladas com respostas da Bia repetitivas, a IA pode entrar em loop ao seguir o padrão da assistente.

**Causa C — Falta de extração explícita de dados já coletados:** O prompt diz "leia o histórico", mas não **resume** os dados já coletados para a IA. A IA precisa de um resumo explícito: "DADOS JÁ COLETADOS: pagamento=dinheiro".

### Correção em `bia-core.ts`

1. **Extrair dados já coletados do histórico** e injetá-los no system prompt como variáveis explícitas. Criar função `extractCollectedData(history)` que faz regex no histórico para identificar:
   - Pagamento mencionado pelo user (dinheiro/pix/cartão/fiado)
   - Produto mencionado
   - Endereço confirmado

2. **Injetar no prompt:** Adicionar seção `DADOS JÁ INFORMADOS PELO CLIENTE:` com os dados extraídos, seguida de: "NÃO pergunte novamente sobre nenhum desses itens."

3. **Reforçar anti-loop específico para pagamento:** Adicionar regra: "Se o histórico contém a palavra 'dinheiro', 'pix', 'cartão' ou 'fiado' em mensagem do CLIENTE, a forma de pagamento JÁ FOI DEFINIDA. Finalize o pedido."

---

## Problema 2: Notificação desktop não funciona com navegador minimizado

### Diagnóstico

O hook atual tem `if (!document.hidden) return;` — isso funciona quando a aba está em segundo plano mas **não** quando o navegador está minimizado (em muitos navegadores `document.hidden` é `true` quando minimizado, o que é correto). O problema real é que a Notification API do navegador **funciona com navegador minimizado** — a notificação aparece no sistema operacional.

No entanto, a limitação atual é:
- A notificação só dispara se `document.hidden === true`. Quando minimizado, isso **deveria** ser `true`. 
- A restrição real: **remover** a verificação `document.hidden` para que a notificação SEMPRE dispare (mesmo com a aba visível), garantindo cobertura total.
- Adicionar **som de alerta** na notificação para chamar atenção mesmo com o navegador minimizado.
- Usar `requireInteraction: true` para que a notificação **não feche automaticamente** até o atendente clicar.

### Correções

1. **Remover restrição `document.hidden`** — notificação sempre dispara
2. **Adicionar `requireInteraction: true`** — notificação persiste até ser clicada
3. **Adicionar vibração** via `navigator.vibrate` (se suportado)
4. **Manter o áudio do popup** como alerta complementar

---

## Arquivos a alterar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/_shared/bia-core.ts` | Criar `extractCollectedData()`, injetar dados coletados no prompt, reforçar anti-loop de pagamento |
| `src/hooks/useDesktopNotification.ts` | Remover `document.hidden` check, adicionar `requireInteraction: true` |

## Detalhes técnicos

### Nova função `extractCollectedData`:
```text
extractCollectedData(history[]) → { pagamento?, produto?, enderecoConfirmado? }
- Scan mensagens role="user" por: dinheiro/pix/cartão/fiado → pagamento
- Scan por: p13/p20/p45/gás/água → produto  
- Scan mensagens role="assistant" com "Entrego na" seguido de role="user" com "sim" → endereço confirmado
```

### Injeção no prompt (após ANTI-LOOP):
```text
DADOS JÁ INFORMADOS PELO CLIENTE (NÃO pergunte novamente):
- Pagamento: dinheiro ✅
- Produto: Gás P13 ✅
- Endereço confirmado: Sim ✅
→ FINALIZE O PEDIDO IMEDIATAMENTE.
```


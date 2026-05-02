## Diagnóstico do vídeo

Você discou **`0411152835921`** (com `04` da operadora na frente). A operadora não completou — ficou "Chamando..." 20s e caiu. **Nenhuma chamada do horário do vídeo (12:14 BRT) chegou ao Vapi.**

Logo depois (12:59 / 13:02 BRT) você ligou de novo e a Bia atendeu normalmente. Confirmei pelo transcript do Vapi: ela disse o preço, pegou endereço, pagamento, telefone e finalizou o pedido. **Está funcionando.**

Mas o transcript revelou outro problema, que é o que vou corrigir:

## Problemas identificados (na chamada que funcionou)

1. **"grama" em vez de "botijão"** — O ElevenLabs está pronunciando "1 g" como "1 grama". Ela falou: *"você gostaria de 1 **grama** s p 13"*, *"húngaro mais p 13"*, *"1 angramaz p 13"*. O modelo está abreviando "gás" como "g" e o TTS lê como "grama".
2. **Soletra mal o telefone** — Cliente disse `43 9 9 9 6 9 27 6 5` (10 dígitos), Bia repetiu `43, 9, 9, 9, 27, 5` (perdeu dígitos).
3. **Não chamou `criar_pedido`** — Apesar de ter coletado todos os dados, não vejo a tool sendo executada no fim. Confirmo nos logs do edge `vapi-tools` se chegou ou não.

## Sobre o número discado

Não é bug de software — é como você está discando. **Disque sem o `04`**:
- Correto: `+55 11 5283-5921` ou `01152835921` (com prefixo de operadora antes do DDD, ex: `04111 5283-5921` precisa do DDD logo após o código da operadora — você digitou `0411` que vira algo inválido)
- Mais simples: salve o contato como **`+551152835921`** e ligue pelo contato.

## Correções no código/Vapi

### 1. Reescrever o system prompt da Bia para travar a pronúncia
- Forçar dizer literalmente **"botijão"** ou **"botijão de gás P treze"** — proibir "gás P13" sozinho (o TTS lê "g" como "grama").
- Forçar soletrar números **um por um, em voz alta**: *"quatro-três, nove-nove-nove-seis-nove, dois-sete-seis-cinco"*.
- Adicionar regra: ao receber telefone, **ler de volta dígito por dígito** e pedir confirmação antes de criar pedido.
- Reforçar que **DEVE chamar `criar_pedido`** após confirmação do cliente (não só descrever).

### 2. Verificar logs do edge `vapi-tools`
- Conferir se `criar_pedido` foi chamada na call `019de8c8-88aa-722f-b03a-753ba8029585`.
- Se não foi: o problema é no prompt (não está acionando). Se foi e falhou: ajustar a edge function.

### 3. Aplicar via API do Vapi
Patch no assistant `3c591c22-23a8-414d-a14e-5097ab7e2daf` com o novo prompt.

## O que NÃO vou mexer

- Voz/idioma (Jessica pt-BR já está OK pelo transcript).
- Edge function `vapi-tools` (a menos que o log mostre erro).
- Webhook Vonage (chamadas estão chegando quando o número é discado certo).

## Próximo passo após implementar

Você liga de novo (discando `+551152835921` direto, sem o `04`), faz um pedido completo, e verifica em **Vendas → Pedidos** se aparece o registro com canal "telefone".
## Problema

Na ligação a Bia negociou desconto de R$ 125 → R$ 120, mas o pedido foi gravado como R$ 125.

Causa: o tool `criar_pedido` em `supabase/functions/elevenlabs-bia-tools/index.ts` só tem dois caminhos de preço:

1. `usar_desconto=true` → usa `preco_desconto` da tabela oficial (Regras da Bia).
2. Caso contrário → usa o preço normal.

Não existe forma da Bia informar um valor **negociado livre** (ex.: R$ 120 quando a tabela só tem 125 cheio e, digamos, 119 com desconto). Como a Bia provavelmente não passou `usar_desconto=true` (ou o `preco_desconto` da tabela não bate exatamente com 120), o pedido caiu no preço cheio.

## Solução

### 1. Edge function `elevenlabs-bia-tools` (action `criar_pedido`)

Aceitar dois novos parâmetros opcionais no body:

- `preco_unitario` (number) — preço final por unidade negociado na ligação.
- `desconto_unitario` (number) — alternativa: desconto em R$ por unidade.

Lógica nova (após resolver `precoUnitario` base como hoje):

```text
precoBase = (lógica atual: tabela > preco_desconto > preco_telefone > preco)

se body.preco_unitario for número > 0:
    candidato = Number(body.preco_unitario)
senão se body.desconto_unitario > 0:
    candidato = precoBase - Number(body.desconto_unitario)
senão:
    candidato = precoBase

# Trava de segurança: nunca abaixo do preco_desconto da tabela
# e nunca acima do preço cheio + 1 centavo
pisoMin = linha?.preco_desconto > 0 ? linha.preco_desconto : (precoBase * 0.5)
tetoMax = precoBase
precoFinal = clamp(candidato, pisoMin, tetoMax)

se precoFinal !== precoBase:
    flag negociado = true
```

- `valor_total = precoFinal * qty`
- `pedido_itens.preco_unitario = precoFinal`
- Observação do pedido: substituir `[Preço com desconto aplicado]` por `[Preço negociado: R$ X,XX/un]` quando `negociado=true`.
- Retornar `preco_unitario` e `preco_base` no response para a Bia confirmar verbalmente.

Sem mudanças em outras actions, RLS, schema do banco ou App.tsx.

### 2. Configuração do agente ElevenLabs (manual, fora do código)

Para a Bia conseguir usar o novo parâmetro, é preciso atualizar **no painel do agente ElevenLabs**:

- Tool `criar_pedido` → adicionar propriedade opcional `preco_unitario` (number, "Preço final negociado por unidade em reais, quando a Bia conceder qualquer desconto fora da tabela padrão").
- Prompt da agente → instruir: *"Sempre que você conceder qualquer desconto ou negociar um valor diferente do preço cheio (mesmo o `preco_desconto` da tabela), envie `preco_unitario` com o valor final acordado em reais. Nunca confie só em `usar_desconto`."*

Posso deixar uma nota nesse sentido em `CONFIG_ELEVENLABS_SIP_DIRECT.md` para registro, mas a edição do agente em si é feita por você no painel.

## Fora de escopo

- Mudanças no banco, RLS, types.ts, rotas, providers.
- Fluxo da Bia por WhatsApp (já usa `extractLatestNegotiatedDiscountPerUnit` em `bia-core.ts`).
- Telas do ERP (o pedido já aparece corretamente uma vez que `pedido_itens.preco_unitario` e `pedidos.valor_total` forem gravados certos).

## Perguntas

1. Confirma que o piso de segurança deve ser o `preco_desconto` da tabela (e, se ela for 0, 50% do preço cheio)? Ou prefere aceitar qualquer valor que a Bia mandar sem trava?
2. Quer que eu já edite o `CONFIG_ELEVENLABS_SIP_DIRECT.md` com a instrução do novo parâmetro, ou prefere só o código?

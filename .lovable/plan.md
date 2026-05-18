## Problema

Telefones com código do país (55) estão sendo salvos com um "5" sobrando na frente. Ex.: o número `(43) 9974-0993` chega como `554399740993` (12 dígitos) e o sistema corta só os 11 últimos → `54399740993`.

A causa está em duas funções que normalizam telefone com `slice(-11)` puro, sem remover o prefixo "55" do Brasil:

- `supabase/functions/_shared/bia-core.ts` linha **1175** — `createOrder` insere o cliente novo após pedido: `telefone: phone.replace(/\\D/g,"").slice(-11)`
- `supabase/functions/_shared/bia-core.ts` linha **358** — `normalizePhone()` (usada em `findCliente` e em vários webhooks)

Quando o número vem com 13 dígitos (`55 + DDD + 9 dígitos`), o `slice(-11)` funciona por sorte. Quando vem com 12 (`55 + DDD + 8 dígitos`, ou alguns formatos), sobra o "5".

## Correção

Substituir `slice(-11)` por uma normalização BR-aware:

```ts
function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  // Remove DDI 55 do Brasil quando presente (12 ou 13 dígitos)
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.slice(-11);
}
```

### Arquivos a alterar

1. `supabase/functions/_shared/bia-core.ts`
   - Reescrever `normalizePhone` (linha 358) com a lógica acima.
   - Linha 1175 dentro de `createOrder`: trocar o inline `phone.replace(/\D/g,"").slice(-11)` por uma chamada a `normalizePhone(phone)`.

Nenhuma outra mudança. Webhooks (zapi/meta/uazapi/gateway/evolution) já chamam `normalizePhone`, então herdam o fix automaticamente.

## Validação

- Caso "55" + 11 dígitos (13 total) → continua devolvendo 11 corretos.
- Caso "55" + 10 dígitos (12 total) → agora devolve 10 (sem o "5" sobrando) em vez de 11 errados.
- Caso já vier com 11 dígitos → inalterado.
- Caso vier com 10 dígitos (sem 9 móvel) → inalterado.

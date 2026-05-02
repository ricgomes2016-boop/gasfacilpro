## Problema
Mesmo com a janela de idempotência de 15 min no código da edge function `elevenlabs-bia-tools`, ainda é possível a Bia criar 2 pedidos para a mesma chamada. Causas possíveis:
- Duas chamadas de `criar_pedido` em paralelo (race condition: as duas leem o banco antes de qualquer INSERT acontecer).
- Pedido pendente já foi marcado como "entregue" / "saiu_entrega" entre as chamadas, então o filtro `status='pendente'` não encontra o anterior.

A janela de tempo no código sozinha não basta. Precisa de uma trava no banco.

## Solução: trava definitiva no PostgreSQL

Criar um índice único parcial em `pedidos` que impede 2 pedidos do mesmo cliente, na mesma unidade, no canal `telefone_ia`, dentro do mesmo minuto. Isso transforma o "duplicado" em erro de banco — impossível passar mesmo com race condition.

```sql
CREATE UNIQUE INDEX idx_pedidos_telefone_ia_dedupe
ON public.pedidos (
  cliente_id,
  unidade_id,
  date_trunc('minute', created_at)
)
WHERE canal_venda = 'telefone_ia';
```

## Ajuste no código da edge function

1. **Ampliar busca de duplicado**: além de `status = 'pendente'`, considerar TODOS os status (entregue, saiu_entrega, em_preparo) dentro da janela de 15 min — porque o pedido anterior pode já ter sido despachado.
2. **Capturar erro do índice único**: se o INSERT falhar por violação do índice (código `23505`), buscar o pedido existente e devolvê-lo como `duplicado: true` em vez de retornar erro.
3. Mensagem mais firme para a Bia: "Pedido já registrado nesta ligação. NÃO chame criar_pedido novamente. Apenas confirme verbalmente e finalize."

## Arquivos afetados
- Migration nova (índice único parcial em `pedidos`)
- `supabase/functions/elevenlabs-bia-tools/index.ts` (ampliar lookup + tratar erro 23505)

Após aprovação, aplico migration + deploy da edge function.
## Diagnóstico corrigido

Entregador é **Marcos Godoy** (nome no WhatsApp), cadastrado como **Marcos Antônio** com telefone `43988045994` na unidade **Forte Gás** (mesma empresa Central Gas). Ele mandou `01 gás Angélica Bolos 105,00 pix`, `01 gás Francisco Bayardo Lacerda 23 Ana Cláudia - 105,00 fiado`, `02 Águas tabacaria Bus - 15,00 cada pix` no WhatsApp da Forte Gás, e a Bia respondeu como cliente ("estamos fechados"), pulando o fluxo do entregador.

Causa raiz em `findEntregadorByPhone` (`supabase/functions/_shared/bia-entregador.ts`):

- WhatsApp entregou o `phone` como `4388045994` (10 dígitos, sem o "9" do celular).
- Cadastro tem `43988045994` (11 dígitos, com o "9").
- Comparação atual por `ilike '%últimos10%'` não bate (`4388045994` vs `3988045994`).

Não é problema de LID nem de unidade — é normalização de telefone brasileiro (dígito 9 do celular).

## Correção (só backend)

Editar apenas `supabase/functions/_shared/bia-entregador.ts`:

1. Em `findEntregadorByPhone`, gerar variantes do telefone recebido: últimos 8, últimos 10, últimos 11, "com 9 inserido depois do DDD" e "sem 9 depois do DDD". Buscar via `or(telefone.ilike.%v%,…)` com todas.
2. Resolver `empresa_id` da instância e buscar entregadores ativos em qualquer unidade dessa empresa; preferir match na própria unidade da instância quando houver múltiplos (caso do Marcos, que existe em 2 unidades).
3. Fallback por `senderName` (primeiro nome, `ilike`) só quando `phone` vier como `@lid` ou tiver menos de 8 dígitos — aceitar apenas se resultado for exatamente 1 entregador na empresa.
4. Manter `ativo=true` e retorno `null` silencioso; fluxo cliente segue intacto quando não achar.

Sem mudanças em UI, RLS, parser, `bia-core.ts` ou webhooks; o módulo é reimportado automaticamente pelos webhooks.

## Validação

- Marcos Godoy reenvia `01 gás Angélica Bolos 105,00 pix` de `43 98804-5994` para o WhatsApp da Forte Gás → Bia responde com o resumo pedindo `OK`.
- Cliente comum continua no fluxo normal.
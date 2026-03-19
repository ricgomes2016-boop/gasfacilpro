

# Corrigir erro RLS ao salvar parceiro

## Problema

A policy `tenant_isolation_vale_gas_parceiros` tem `WITH CHECK`:
```
has_role(auth.uid(), 'super_admin') OR unidade_belongs_to_user_empresa(unidade_id)
```

Diferente do `USING` (que permite `unidade_id IS NULL`), o `WITH CHECK` **nao permite NULL**. Quando o update e feito sem incluir `unidade_id` no payload, o valor existente (possivelmente NULL) falha na validacao.

## Correcao

### 1. Incluir `unidade_id` no payload de update (ValeGasParceiros.tsx)
No `handleSubmit`, adicionar `unidade_id: unidadeAtual?.id` ao `updatePayload` para que o campo sempre tenha um valor valido da empresa do usuario.

### 2. Garantir `unidade_id` no insert
Ja esta sendo feito via `addParceiro({ ..., unidade_id: unidadeAtual?.id || null })`, mas o `|| null` pode causar o mesmo problema. Trocar para `unidadeAtual?.id` sem fallback para null.

### Detalhes Tecnicos
- Arquivo: `src/pages/financeiro/ValeGasParceiros.tsx`
- Linha ~131: adicionar `unidade_id: unidadeAtual?.id` ao `updatePayload`
- Linha ~148: trocar `unidade_id: unidadeAtual?.id || null` por `unidade_id: unidadeAtual?.id`


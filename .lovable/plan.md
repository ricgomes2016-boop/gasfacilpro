## Problema

Em **Cadastros → Veículos**, as fotos não aparecem (capa, painel, frente, lados, traseira).

Causa: o componente `ImageUpload` salva o caminho usando `getPublicUrl(...)`, mas o bucket de storage `vehicle-photos` está marcado como **privado**. URLs públicas geradas para um bucket privado retornam erro/imagem em branco. Por isso o upload "funciona", mas a imagem nunca carrega depois.

O bucket `product-images` (usado em Produtos) já é público — por isso lá funciona.

## Correção

1. Marcar o bucket `vehicle-photos` como público (via `storage_update_bucket`).
2. Garantir políticas RLS em `storage.objects` para o bucket:
   - `SELECT` público (qualquer um lê).
   - `INSERT`/`UPDATE`/`DELETE` apenas para usuários autenticados.
   (Se já existirem políticas equivalentes, deixar como está.)

Nenhuma mudança em código React — `ImageUpload` continua igual.

## Fora do escopo

- Não migrar fotos antigas (URLs continuam válidas após tornar público).
- Não mexer em outros buckets.
- Sem alterações em telas, fluxo de upload ou schema da tabela `veiculos`.

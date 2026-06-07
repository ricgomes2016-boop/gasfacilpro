## Causa
A última correção de segurança revogou o SELECT da coluna `certificado_a1_path` (e `certificado_a1_senha`) da tabela `unidades` para os papéis `anon`/`authenticated`. Porém a constante `UNIDADES_PUBLIC_COLUMNS` em `src/lib/db/sensitiveColumns.ts` ainda inclui `certificado_a1_path` na lista de SELECT.

Resultado: toda query de unidades feita pelo client retorna erro de permissão → `unidades` fica `[]` → `UnidadeSelector` renderiza `null` (espaço vazio no header).

## Correção (apenas frontend, 1 arquivo)
Editar `src/lib/db/sensitiveColumns.ts`:
- Remover `certificado_a1_path` da string `UNIDADES_PUBLIC_COLUMNS`.
- Garantir que `certificado_a1_senha` também não esteja listada (não está, ok).
- Adicionar comentário avisando que essas duas colunas só são acessíveis via `service_role` (Edge Function), nunca pelo client.

## Fora do escopo
- Nenhuma mudança em migrations, RLS, App.tsx, contextos ou no componente `UnidadeSelector`.
- Edge Functions que precisam do certificado já usam `service_role`, então não são afetadas.

## Validação
Após o build, recarregar a página: o seletor de unidades deve voltar a aparecer no header com a lista correta.

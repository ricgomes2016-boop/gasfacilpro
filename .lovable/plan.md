## 1. Busca de cliente — aba Orçamento Padrão

**Problema:** No diálogo de novo Orçamento (Padrão), o autocomplete usa a RPC `autocomplete_clientes_v2` passando `_unidade_id = unidadeAtual.id`. Clientes que existem no cadastro da empresa mas que **não estão vinculados** na tabela `cliente_unidades` à unidade atual ficam invisíveis. Isso explica casos como "Rua Cambará, 260" que aparecem no cadastro geral, mas não no orçamento.

**Solução (somente front, sem mexer no RPC nem em RLS):**

Em `src/pages/financeiro/Orcamentos.tsx` (linhas 127-141):
- Manter a chamada principal com `_unidade_id` para priorizar clientes da unidade.
- Se o termo tiver ≥ 2 caracteres **e** o retorno vier vazio, fazer um **fallback automático** chamando a mesma RPC com `_unidade_id: null` (escopo empresa inteira).
- Marcar visualmente os resultados de fallback com um pequeno selo "outra unidade" no `CommandItem`, para o operador saber que o cliente não está vinculado à unidade ativa.
- Ao selecionar um cliente vindo do fallback, vincular automaticamente à unidade atual via `insert` em `cliente_unidades` (ignorar erro de duplicidade), de modo que a próxima busca já encontre direto.

Isso resolve tanto o caso do CNPJ/nome quanto o caso de endereço (Rua + número), que a RPC já trata.

## 2. Marca d'água com nome da empresa na assinatura digital

**Onde:** `supabase/functions/assinar-pdf/index.ts`.

Hoje a função aplica PAdES (assinatura criptográfica) e, opcionalmente, desenha um carimbo visível na última página. **Não há marca d'água** repetida em todas as páginas.

**Mudanças:**

1. Ao carregar o certificado da unidade, fazer também `select` no nome da empresa:
   ```ts
   .select("certificado_..., empresa_id, empresas:empresa_id(nome_fantasia, razao_social)")
   ```
   Resolver `empresaNome = empresas.nome_fantasia || empresas.razao_social || titular`.

2. Criar função `aplicarMarcaDagua(pdfDoc, texto)` que, para **cada página**:
   - Embeda Helvetica.
   - Desenha o texto `"Assinado digitalmente por ${empresaNome}"` em diagonal (rotação ~45°), centralizado, fonte ~48pt, cor cinza com opacidade ~0.12 (`rgb(0.5,0.5,0.5)` + `opacity: 0.12`).
   - Calcula posição usando `page.getSize()` para ficar centralizado independente do tamanho da página.

3. Chamar `aplicarMarcaDagua` dentro de `assinarPdf(...)` **antes** do bloco PAdES, para que a marca faça parte do hash assinado.

4. Aplicar também no fluxo `acao: "amostra"` para que a pré-visualização mostre a marca.

5. Não alterar o carimbo visível existente (continua opcional via `visivel`).

## 3. Fora de escopo

- Não alterar layout das telas.
- Não alterar a lógica do RPC `autocomplete_clientes_v2` nem RLS.
- Não mexer no fluxo Fundepar (já busca empresa inteira).
- Não alterar envio/criação de orçamento.

### Arquivos a editar

- `src/pages/financeiro/Orcamentos.tsx` — fallback de busca + auto-vínculo na unidade.
- `supabase/functions/assinar-pdf/index.ts` — marca d'água com nome da empresa em todas as páginas + lookup do nome.

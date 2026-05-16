## Objetivo

Adicionar um toggle **"Consolidar todas as unidades"** no `/vendas/relatorio` que, quando o usuário está com a **Matriz** selecionada no seletor de unidade, traz os dados somados de todas as unidades da empresa (ex.: "quantos P13 todas as lojas venderam juntas").

## Comportamento

- O toggle só **aparece** quando `unidadeAtual?.tipo === "matriz"`. Em qualquer filial fica oculto.
- Estado padrão: **desligado** (mantém comportamento atual = só dados da matriz).
- Quando ligado:
  - Queries de pedidos passam a filtrar por `empresa_id` em vez de `unidade_id`.
  - Aplica-se a **todas** as queries da página: `relatorio-vendas`, `relatorio-vendas-ano` (comparativo mensal), `vendas-historicas-manuais`, `produtos-custo` (nova aba Produtos Vendidos) e `produtos-lista`.
  - Um badge "Consolidado · N unidades" aparece ao lado do título para deixar claro o modo.
- A edição inline (canal, células mensais) continua funcionando — mas como envolve `unidade_id` em algumas inserções, **bloqueamos** a edição enquanto consolidado=ON, mostrando tooltip "Edição disponível por unidade".

## Escopo Técnico

**Arquivo alterado:** `src/pages/vendas/RelatorioVendas.tsx`

1. Novo state: `const [consolidado, setConsolidado] = useState(false);`
2. Derivar `isMatriz = unidadeAtual?.tipo === "matriz"`. Forçar `consolidado=false` quando trocar para filial (useEffect).
3. Helper `applyScope(query)`:
   - Se `consolidado && empresa?.id` → `query.eq("empresa_id", empresa.id)`
   - Senão se `unidadeAtual?.id` → `query.eq("unidade_id", unidadeAtual.id)`
4. Substituir as 4 ocorrências de `if (unidadeAtual?.id) query = query.eq("unidade_id", ...)` por `query = applyScope(query)`. Incluir `consolidado` e `empresa?.id` nas `queryKey` correspondentes.
5. Para `vendas-historicas-manuais` (não há `empresa_id` na tabela hoje): manter restrito à unidade quando consolidado (apenas matriz tem lançamentos) **OU** buscar `IN` em todas unidades da empresa via `unidades.id` já disponível no `UnidadeContext` (`unidades` exporta a lista). Usar `.in("unidade_id", unidades.map(u=>u.id))` quando consolidado.
6. UI: na barra de filtros (próximo ao período), adicionar:
   ```tsx
   {isMatriz && (
     <label className="flex items-center gap-2 text-sm">
       <Switch checked={consolidado} onCheckedChange={setConsolidado} />
       Consolidar todas as unidades
     </label>
   )}
   ```
   Adicionar badge "Consolidado" no header quando ativo.
7. Passar `consolidado` para `<ProdutosVendidosTab consolidado />` para que o `useQuery` de `produtos-custo` use a mesma lógica (filtrar por `empresa_id` ou pelas unidades).
8. Em `ProdutosVendidosTab.tsx`: aceitar props `consolidado?: boolean` e `unidadeIds?: string[]`, ajustar a query de custo para `.in("unidade_id", unidadeIds)` quando consolidado. Lista de filtros (cliente/entregador) já vem dos pedidos, então segue funcionando.
9. Desabilitar `alterarCanalVenda` e `CelulaMesEditavel` (props `editavel={false}`) quando consolidado=ON, com `title="Selecione uma unidade específica para editar"`.

**Sem migrations**, sem mudanças em RLS (RLS já permite admin/gestor ver unidades da empresa via `user_unidades`/policies existentes).

## Fora do escopo

- Não criar nova rota nem aba.
- Não alterar `App.tsx`, providers, rotas.
- Não somar dados de outras empresas.

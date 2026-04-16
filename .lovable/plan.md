
## Diagnóstico

Ao selecionar um cliente na busca da tela `/vendas/nova`, o layout mobile desconfigura. Analisando `CustomerSearch.tsx`:

**Causa raiz identificada:**

1. **Linha de busca (Telefone + Nome + Botão UserPlus)** usa `flex flex-col sm:flex-row gap-3` — em mobile fica em coluna (OK), mas o **botão UserPlus** tem `sm:mt-5 self-end` que em mobile fica `self-end` sem o `mt-5`, ficando alinhado à direita isoladamente.

2. **Quando o cliente é selecionado**, os campos `endereco`, `numero`, `bairro`, `cep` são preenchidos. A linha `<div className="grid gap-3 md:grid-cols-4">` (Endereço col-span-3 + Número) em mobile vira `grid-cols-1` (OK), mas dentro do endereço há `<div className="relative flex gap-1">` com Input + Botão Map — se o endereço preenchido for longo, o Input não tem `min-w-0` no wrapper `flex-1`, causando overflow.

3. **Indicador de coordenadas** `📍 lat, lng` aparece após seleção e usa texto sem `truncate`, podendo estourar.

4. **Dropdown de resultados** (`searchResults`) usa `position: absolute` dentro de um wrapper `relative w-full min-w-0`, mas o wrapper pai (`flex flex-col sm:flex-row`) em mobile coloca telefone e nome empilhados — o `searchRef` envolve ambos. O dropdown absoluto com `left-0 right-0` deveria funcionar, mas pode estar herdando largura errada.

5. **Falta de scroll horizontal**: o usuário menciona "não é possível arrastar para o lado" — isso é esperado pois `MainLayout` tem `overflow-x-hidden`. O problema real é que algo está vazando além da viewport e não há como ver. Precisamos **eliminar o vazamento**, não permitir scroll.

## Solução

### `src/components/vendas/CustomerSearch.tsx`

1. **Linha de endereço com botão de mapa**: adicionar `min-w-0` no wrapper `flex-1` do input para permitir que o Input encolha.
   ```tsx
   <div className="relative flex-1 min-w-0">
   ```

2. **Indicador de coordenadas**: adicionar `truncate` na tag `<p>`.

3. **Wrapper raiz do CardContent**: adicionar `min-w-0` para garantir que o Card não seja esticado por filhos.

4. **Botão UserPlus em mobile**: trocar `self-end` por `self-stretch sm:self-end` ou tornar full-width em mobile para alinhar visualmente.

5. **Dropdown de resultados após seleção**: garantir que o wrapper `relative z-50 w-full min-w-0` esteja contido — confirmar que `sm:max-w-md` não causa problema em telas estreitas (já está OK).

6. **Inputs Telefone/Nome com ícones**: já têm `pl-10` — verificar se o container `relative` tem `min-w-0` (adicionar onde faltar).

### `src/pages/vendas/NovaVenda.tsx`
- Confirmar que o wrapper que envolve `<CustomerSearch />` tem `min-w-0 w-full` (já feito em correção anterior, apenas validar).

## Validação
Após implementar, vou:
1. Abrir `/vendas/nova` em viewport 375x812 com browser
2. Buscar e selecionar um cliente com endereço longo
3. Tirar screenshot e confirmar que **nenhum elemento vaza horizontalmente** após a seleção
4. Verificar que o card "Cliente" mantém suas bordas dentro da viewport

## Arquivos
- `src/components/vendas/CustomerSearch.tsx` (principal)
- `src/pages/vendas/NovaVenda.tsx` (verificação apenas, se necessário)

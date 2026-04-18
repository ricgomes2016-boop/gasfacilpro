
## Problema

1. A página `/config/site-institucional` não mostra o **menu lateral (Sidebar)** nem o **cabeçalho (Header)** do ERP — está renderizando "solta".
2. Ao trocar a empresa para **Forte Gás**, o preview continua exibindo a **Central Gás**.

## Investigação

**Causa #1 — Layout ausente:** Preciso conferir como outras páginas de `/config/*` são renderizadas. Provavelmente as rotas em `configRoutes.ts` envolvem o componente em um `<AppLayout>` (com Sidebar + Header), mas a `SiteInstitucional` foi adicionada sem esse wrapper, ou o componente da página não usa o layout padrão como as demais.

**Causa #2 — Empresa não atualiza:** O componente usa `useEmpresa()` e mapeia por `empresa.slug`. Suspeitas:
- O slug da Forte Gás no banco pode não ser exatamente `"forte-gas"` (pode ser `"fortegas"`, `"forte_gas"`, ou outro).
- Ou o `EmpresaContext` não atualiza reativamente o `empresa.slug` quando o usuário troca via seletor.
- O `iframe` tem cache: mesmo trocando a URL, pode não recarregar — preciso forçar via `key={siteUrl}`.

## Plano

### 1. Adicionar Layout (Sidebar + Header) na página
Envolver o conteúdo de `SiteInstitucional.tsx` com o mesmo layout usado pelas demais páginas `/config/*` (ex: `<AppLayout>` ou `<DashboardLayout>` — vou identificar olhando uma página irmã como `Notificacoes.tsx` ou `PersonalizacaoVisual.tsx`).

### 2. Corrigir detecção da empresa Forte Gás
- Consultar a tabela `empresas` para descobrir o **slug real** da Forte Gás.
- Ajustar o mapa `SITES_INSTITUCIONAIS` para aceitar múltiplas chaves possíveis (slug, nome normalizado e/ou id), tornando o matching robusto:
  ```
  - Por slug exato
  - Fallback por nome normalizado (lowercase, sem acentos): "forte gas" → /fortegas
  - Fallback por nome: "central gas" → /centralgascp
  ```
- Forçar reload do `iframe` ao trocar de empresa adicionando `key={siteUrl}`.

### 3. Garantir reatividade
Confirmar que `useEmpresa()` expõe `empresa` reativo (já visto em `Header.tsx` — funciona). O `useMemo` já depende de `empresa?.slug`, então basta o matching estar correto.

## Arquivos a editar

- `src/pages/config/SiteInstitucional.tsx` — adicionar layout wrapper, melhorar matching por nome, adicionar `key` no iframe.

## Validação

Após aplicar: trocar entre Central Gás e Forte Gás no seletor de empresa do header → o preview e o link devem alternar entre `/centralgascp` e `/fortegas` automaticamente, com Sidebar e Header visíveis.

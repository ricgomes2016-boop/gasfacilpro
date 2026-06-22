## Problema

`useMapaOperacionalData` filtra por `unidade_id` somente quando ele existe. Se `unidadeAtual` ainda não carregou ou é nulo, as queries em `entregadores` e `pedidos` rodam **sem filtro**, e a RLS atual pode permitir que o usuário veja registros de outras unidades/empresas, causando vazamento. Além disso, `pedidos.unidade_id` pode estar nulo em registros antigos e ainda assim aparecer.

## O que será corrigido

### 1. `src/hooks/useMapaOperacionalData.ts`
- **Se não houver `unidadeId`, não faz fetch nenhum** — retorna listas vazias e `loading=false`. Sem unidade selecionada, mapa não mostra dados.
- Adicionar fallback de segurança: filtrar também por `empresa_id` quando disponível, para o caso de registros com `unidade_id` nulo. Aceita opcional `empresaId` no hook.
- Subscrição realtime só é criada quando `unidadeId` existe (já é assim) — manter.
- Filtro do canal `rota_historico` continua global, mas como o refetch já é escopado, não vaza dados; apenas dispara refresh extra. Aceitável.

### 2. `src/pages/operacional/MapaOperacional.tsx`
- Passar `empresaId` (de `useEmpresa()`) para o hook.
- Mostrar estado vazio claro: "Selecione uma unidade para visualizar o mapa" quando `unidadeAtual` é nulo.
- Garantir que a busca das coordenadas da unidade só roda com `unidadeAtual.id` (já é).

### 3. Verificação de RLS (sem migração se policies já estiverem corretas)
- Validar que `entregadores`, `pedidos` e `rota_historico` têm policies que escopam por `empresa_id`/`unidade_id` do usuário.
- Se alguma estiver permissiva demais, abrir migração separada (após sua aprovação) para apertar.

## Fora do escopo
Não vou refatorar `App.tsx`, providers, nem rotas. Apenas o hook e a página do mapa.

## Resultado esperado
- Sem unidade selecionada → mapa vazio com mensagem.
- Com unidade selecionada → apenas entregadores, pedidos e trilhas daquela unidade.
- Troca de unidade → refetch limpo, sem mistura.
- Troca de empresa (multiempresa) → idem, isolado.

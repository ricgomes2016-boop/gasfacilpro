

## Plano: Mesclar abas Rota Atacado + Rota Dinâmica e melhorias

### Mudanças

**1. Mesclar abas em `GestaoRotas.tsx`**
- Remover a aba "Rota Atacado" (carregamentos) separada e a aba "Rota Dinâmica" separada
- Criar uma única aba "Rota Atacado" que renderiza o `RotaAtacadoDinamica` (com mapa, paradas, timeline, etc.)
- Manter a aba "Rotas Cidade" intacta

**2. Cálculo de retorno na `CargaTimeline` e `RotaAtacadoDinamica`**
- Quando o tipo de parada mudar para "retorno", calcular automaticamente o gás restante no caminhão (carga inicial - todas as saídas + todas as entradas até aquele ponto)
- Preencher automaticamente os campos `qtd_p13`, `qtd_p20`, `qtd_p45` da parada de retorno com o saldo atual
- Exibir na timeline a quantidade que está retornando ao ponto de origem

**3. Rotas Salvas — expandir detalhes ao clicar**
- Na aba "Rotas Salvas" dentro do `RotaAtacadoDinamica`, ao clicar em uma rota salva, buscar as paradas (`transp_rota_paradas`) e exibir:
  - Mapa com as paradas e polyline
  - Resumo de custos (KM, tempo, custo total)
  - Timeline de carga recalculada
- Usar um estado `selectedRotaId` e um Dialog/expandable card

**4. Motorista e Ajudante — mostrar todos os funcionários**
- Remover os filtros `.filter(f.cargo === "motorista")` e `.filter(f.cargo === "ajudante")` no `RotaAtacadoDinamica.tsx`
- Listar todos os funcionários ativos em ambos os selects

### Arquivos modificados

| Arquivo | Ação |
|---|---|
| `src/pages/operacional/GestaoRotas.tsx` | Remover aba "Rota Dinâmica" separada, renomear aba "carregamentos" para conter o `RotaAtacadoDinamica` |
| `src/components/operacional/RotaAtacadoDinamica.tsx` | Remover filtro de cargo nos selects de motorista/ajudante; adicionar lógica de auto-preenchimento ao mudar para "retorno"; adicionar visualização expandida de rota salva com query de paradas |
| `src/components/transportadora/rota-atacado/ParadaForm.tsx` | Suportar callback ao mudar tipo para "retorno" que calcula saldo restante |

### Detalhes técnicos

- O cálculo de retorno percorre as paradas anteriores somando entradas e subtraindo saídas, e preenche os campos da parada de retorno com o saldo
- A visualização de rota salva faz `supabase.from("transp_rota_paradas").select("*").eq("rota_id", id).order("ordem")` e renderiza `RotaAtacadoMap` + `CargaTimeline` + `RotaSummaryCard` em modo read-only
- Os selects de funcionários passam a não filtrar por `cargo`, exibindo nome + cargo como label (ex: "João — motorista")


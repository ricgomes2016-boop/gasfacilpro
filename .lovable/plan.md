
# Plano: Filtros e melhorias em Gestão de Frota → Controle de Combustível

Arquivo principal: `src/pages/frota/Combustivel.tsx`

## Situação atual
- Já existe: filtro por **período** (data início/fim), por **status** (pendente/acertado), busca livre (placa/motorista/posto), geração de PDF e Acerto.
- A tabela `abastecimentos` tem `veiculo_id` (FK → `veiculos`), `entregador_id` (FK → `entregadores`) e `motorista` (texto livre, legado).
- O form atual só grava `motorista` como texto, não vincula `entregador_id`.
- Não existem filtros dedicados por veículo nem por motorista, e os KPIs não respondem aos filtros.

## O que será feito

### 1. Filtros novos na barra (acima da tabela)
- **Veículo** (Select): "Todos os veículos" + lista de `veiculos` ativos (placa — modelo).
- **Motorista** (Select): "Todos os motoristas" + lista combinada de:
  - `entregadores` ativos da unidade (preferencial, via `entregador_id`),
  - + nomes distintos já registrados em `abastecimentos.motorista` (legado, sem entregador vinculado).
- **Tipo de combustível** (Select pequeno): Todos / Gasolina / Etanol / Diesel / GNV.
- Mantém: período (de/até), status, busca livre, PDF.
- Botão **"Limpar filtros"** quando houver algum aplicado.
- Layout responsivo: filtros agrupam em 2 colunas no mobile, linha única no desktop. Persistir em `useState` (sem URL).

### 2. KPIs reativos aos filtros
Os 4 cards (Gasto mensal, Litros, Pendentes, Veículos ativos) passam a refletir o **conjunto filtrado** (mantendo rótulos claros: "no período/filtro selecionado"). Adicionar 2 KPIs extras quando há filtro de veículo OU motorista ativo:
- **Média R$/L** do recorte.
- **Km/L estimado** (apenas se veículo selecionado e houver pelo menos 2 abastecimentos com `km` > 0 — calcular pelo delta de km ÷ litros entre registros consecutivos).

### 3. Vincular entregador no formulário
- Trocar o input texto **Motorista** por um Select de entregadores da unidade + opção "Outro (digitar)" para preservar entrada livre (legado/terceiros).
- Ao escolher entregador, gravar `entregador_id` e também `motorista` = nome (compatibilidade com PDF/relatórios existentes).
- Sem migração de dados — registros antigos continuam aparecendo via campo `motorista`.

### 4. Tabela / cards mobile
- Adicionar coluna **Tipo** (já existe no objeto, falta exibir).
- Mostrar nome via `entregadores.nome` quando houver `entregador_id`, senão `motorista`.
- Linha de **totais** no rodapé da tabela (litros, valor, qtd) refletindo o filtrado.

### 5. PDF
- Cabeçalho passa a listar os filtros aplicados (Veículo X, Motorista Y, Período, Tipo).
- Já usa `filtered` → herda automaticamente os novos filtros.

## Sem mudanças
- Sem migração SQL (todas as colunas necessárias já existem).
- Sem alterações em rotas, layout ou outros módulos da Frota.
- Acerto, OCR de cupom e exclusão permanecem iguais.

## Detalhes técnicos
- Carregar `entregadores` ativos da unidade no mesmo `fetchData` (`select id, nome` com `eq("ativo", true)` e filtro por `unidade_id` se aplicável).
- Filtro de motorista compara: `a.entregador_id === filtroMotorista` OU (legado) `a.motorista === filtroMotoristaNome` quando a opção for de "motorista livre".
- Manter tipagem `any` consistente com o restante do arquivo (não introduzir refactor amplo).

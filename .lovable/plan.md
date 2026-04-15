

## Plano: Renomear Abastecimento → Transferência + Nova página Compras

### 1. Renomear labels (sem mudar tabela/rota)

| Arquivo | Mudança |
|---|---|
| `TransportadoraLayout.tsx` | Label "Abastecimento" → "Transferência" |
| `TranspAbastecimento.tsx` | Títulos: "Transferência entre Filiais", "Nova Transferência", toast atualizado |
| `TranspRelatorios.tsx` | Labels "abastecimento" → "transferência" |

### 2. Nova tabela `transp_compras`

```sql
CREATE TABLE public.transp_compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id),
  data date NOT NULL,
  fornecedor text NOT NULL,
  cidade_fornecedor text,
  distancia_ida_km numeric DEFAULT 0,
  veiculo_id uuid REFERENCES transp_veiculos(id),
  -- Quantidades
  qtd_p13 integer DEFAULT 0,
  qtd_p20 integer DEFAULT 0,
  qtd_p45 integer DEFAULT 0,
  qtd_agua integer DEFAULT 0,
  -- Custo de compra (pago ao fornecedor)
  valor_compra numeric DEFAULT 0,
  -- Logística
  custo_combustivel numeric DEFAULT 0,
  custo_pedagio numeric DEFAULT 0,
  custo_refeicao numeric DEFAULT 0,
  custo_outros numeric DEFAULT 0,
  custo_logistico_total numeric DEFAULT 0,
  custo_total numeric DEFAULT 0,
  -- Custo unitário calculado (rateio proporcional P13-equiv)
  custo_unit_p13 numeric DEFAULT 0,
  custo_unit_p20 numeric DEFAULT 0,
  custo_unit_p45 numeric DEFAULT 0,
  custo_unit_agua numeric DEFAULT 0,
  mes_referencia text,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.transp_compras ENABLE ROW LEVEL SECURITY;
-- RLS policies (same pattern as other transp_* tables)
```

### 3. Nova página `TranspCompras.tsx`

**Formulário de registro** com:
- Data, Fornecedor, Cidade, Distância ida (km)
- Veículo (ao selecionar, preenche consumo km/l automaticamente)
- Quantidades: P13, P20, P45, Água
- Valor total da compra (pago ao fornecedor)
- Custos logísticos: Combustível (calcula auto: `dist × 2 / consumo × preço_litro`), Pedágio, Refeição, Outros
- Preço do litro de diesel (input com default 7.50)

**Cálculo automático do custo unitário** (rateio por P13-equivalente):
- P13-equiv total = P13 + P20×3.4286 + P45×4 + Água×1
- Custo logístico por P13-equiv = custo_logistico_total / P13-equiv total
- Custo compra por P13-equiv = valor_compra / P13-equiv total
- `custo_unit_p13` = custo_compra_p13eq + custo_logistico_p13eq
- `custo_unit_p20` = (custo_compra_p13eq + custo_logistico_p13eq) × 3.4286
- `custo_unit_p45` = (custo_compra_p13eq + custo_logistico_p13eq) × 4
- `custo_unit_agua` = custo_compra_p13eq + custo_logistico_p13eq

**Resumo mensal** (cards no topo):
- Custo médio P13, P20, P45, Água no mês selecionado
- Total gasto em compras + logística
- Total de unidades compradas

**Lista de compras** com cards mostrando fornecedor, data, quantidades, custos.

### 4. Menu e rotas

- Adicionar `ShoppingCart` icon + "Compras" no menu após "Transferência"
- Nova rota `/transportadora/compras` → `TranspCompras`

### Lógica de custo mensal

A página de **Relatórios** será atualizada para incluir:
- Custo médio mensal por produto (média ponderada de todas as compras do mês)
- Total de despesas logísticas (compras + transferências)
- Custo real por unidade considerando compra + transferência

### Arquivos envolvidos
- `TransportadoraLayout.tsx` — renomear + novo item menu
- `transportadoraRoutes.ts` — nova rota
- `TranspAbastecimento.tsx` — renomear textos
- `TranspRelatorios.tsx` — renomear textos + seção custo mensal por produto
- `TranspCompras.tsx` — **novo**
- Migration SQL — criar `transp_compras` com RLS


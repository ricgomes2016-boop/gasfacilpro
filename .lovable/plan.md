

## Plano: módulo Compras (Transportadora) no estilo Base44

### Objetivo
Replicar a UX das telas Base44 enviadas: distinguir **Cheio / Vasilhame / Outros**, mostrar **preço unitário** na tabela, **resumo por loja (filial) + por produto**, comparativo de fornecedores com Min/Médio/Máx, KPI "Descontos totais", e melhorar a leitura do XML (descontos, vencimento, duplicata, filial destinatária via CNPJ).

### 1. Banco — novas colunas em `transp_compras`
Migration adicionando:
- `unidade_id uuid` (FK `unidades.id`) — filial destinatária da NF
- `cnpj_destinatario text` — CNPJ extraído do `<dest>` para mapear a filial
- `tipo_produto text` — `'cheio' | 'vasilhame' | 'outros'` (derivado do CFOP/descrição)
- `preco_unitario numeric` — preço unitário do item da NF (já bruto)
- `quantidade numeric` — quantidade do item (separa do agregado P13/P20/P45)
- Índice em `(empresa_id, mes_referencia, unidade_id)`

### 2. Edge Function `importar_xml_outlook` — parser melhorado
- Extrair `<dest><CNPJ>` → buscar `unidades` por CNPJ → setar `unidade_id`.
- Extrair `<dup><dVenc>` (duplicatas) → primeira data = `data_vencimento`.
- Extrair `<vDesc>` por item e `<vDesc>` total → preencher `desconto`.
- Classificar `tipo_produto` por **CFOP** (5xxx/6xxx 5102/5405/5656 = cheio; 5949/5556 vasilhame…) com fallback por descrição (`vazio` → vasilhame; `gás/glp/p13/p20/p45` → cheio; resto → outros).
- Salvar `preco_unitario` (`vUnCom`) e `quantidade` (`qCom`) no item.
- Manter agregação `qtd_p13/p20/p45` apenas quando `tipo_produto = 'cheio'`.

### 3. Página `TranspCompras.tsx` — novos blocos (estilo Base44)

**a) Filtros no topo**
- Período (mês) — já existe
- **Filial (loja)** — Select "Todas as lojas" + uma por unidade do empresa_id

**b) Card "Resumo por Loja — GLP Cheio"**
Tabela agrupada por `unidade_id` × produto cheio (P13/P20/P45):
| Loja | Produto | Qtd | Preço Médio Unit. | Total Líquido |
+ linha "Total Geral (GLP Cheio)".

**c) Card "Comparativo de Preço Unitário por Fornecedor — GLP Cheio"**
- Gráfico de barras (recharts) Min/Médio/Máx por fornecedor+produto
- Tabela: Fornecedor / Produto · Preço Min · Médio · Máx · Qtd Comprada · Total Pago · Vs. Média (delta vs média geral, verde/vermelho)
- Troféu 🏆 no fornecedor com menor preço médio do produto

**d) Linha de mini-cards**
- Por Fornecedor (bar horizontal)
- Por Loja (bar vertical)
- Evolução de Compras (line) — já existe parcialmente em `ComprasAnaliseGLP`

**e) Card "Histórico de Compras"**
- Badge "💰 Descontos totais: R$ X" no canto direito
- Filtros chip: **Todos / Cheio / Vasilhame / Outros** (filtra por `tipo_produto`)
- Colunas novas: **Loja**, **Tipo** (badge colorido), **CFOP**, **Qtd**, **Preço Unit.**, **Desconto**, **Total**, **NF**, **Vencimento**, **Pago**

### 4. Componentes a criar
```
src/components/transportadora/compras/
  ResumoPorLoja.tsx         (Card 3b)
  ComparativoFornecedoresUnit.tsx  (Card 3c, substitui/estende o atual)
  ComprasMiniGraficos.tsx   (Card 3d)
  ComprasFiltroTipo.tsx     (chips Cheio/Vasilhame/Outros)
```
`ComprasListaTable.tsx` ganha colunas Loja/Tipo/CFOP/Qtd/Preço Unit./Desconto + filtro de tipo + badge de descontos totais.

### 5. Lógica de agrupamento (frontend)
- `useMemo` consolidando `compras` filtradas por período+filial:
  - `porLojaProduto`: `{unidade_id, produto, qtd, preco_medio (ponderado), total}`
  - `porFornecedorProduto`: `{fornecedor, produto, min, med, max, qtd, total, vsMedia}`
- Joinar `unidades` para mostrar nome da loja.

### Fora de escopo
- Não toco em rotas, providers, App.tsx, autenticação.
- Não mudo módulo Abastecimento/Entregas.
- Edge function continua usando Outlook (sem reescrever fluxo).

### Próximo passo após aprovação
1. Migration (colunas novas + índice).
2. Atualizar parser do `importar_xml_outlook`.
3. Criar 4 componentes novos + atualizar `TranspCompras.tsx` e `ComprasListaTable.tsx`.


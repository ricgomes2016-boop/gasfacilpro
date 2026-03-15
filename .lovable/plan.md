

# Diagnóstico: Bia registrando pedidos de água como gás

## Problema identificado

O bug está na função `createOrder` em `bia-core.ts` (linhas 690-703). A busca de produto é feita com `ilike` genérico:

```
.ilike("nome", `%${orderData.produto}%`)
```

Quando a IA envia `produto: Água Mineral 20L` no bloco `[PEDIDO_CONFIRMADO]`, se o `ilike` não encontra resultado direto, o **fallback** (linha 696) extrai qualquer número com regex:

```
/(P\s*13|P\s*20|P\s*45|20\s*L|13|20|45)/i
```

O problema: "Água Mineral **20**L" captura `20` e a query de fallback busca `%P20%` ou `%20kg%` ou `%20L%`. Se "Gás P20" aparece antes de "Água Mineral 20L" no resultado, ele é selecionado. Além disso, o campo `categoria` do produto (gas, agua, vasilhame) **nunca é consultado**, então não há distinção.

Adicionalmente, o system prompt (linha 414) instrui: **"P45, Água: preço fixo, sem desconto"** — mas não instrui a IA a usar um nome de produto distinto e padronizado no bloco de confirmação.

## Plano de correção

### 1. Melhorar a busca de produto na `createOrder`
- Adicionar a coluna `categoria` na query de produtos (`select("id, nome, preco, categoria")`)
- Detectar se o pedido é de **água** (regex: `/água|agua|mineral|galão|galao|20\s*l/i`) e filtrar por `categoria = 'agua'`
- Detectar se é **gás** (regex: `/g[aá]s|P\s*13|P\s*20|P\s*45|botij/i`) e filtrar por `categoria = 'gas'`
- Isso garante que "Água 20L" nunca resolva para "Gás P20"

### 2. Melhorar o fallback de busca
- Priorizar match por `20L` (água) antes de `20` genérico (gás P20)
- Separar o regex em duas fases: primeiro busca padrões com unidade (`20L`, `P13`, `P20kg`), depois números soltos

### 3. Atualizar o system prompt
- No bloco de confirmação, instruir a IA a usar o nome **exato** do produto conforme listado em "PRODUTOS DISPONÍVEIS"
- Adicionar instrução: `"Para água, use EXATAMENTE 'Água Mineral 20L'. Para gás, use 'Gás P13', 'Gás P20' ou 'Gás P45'."`

### Arquivos a editar
- `supabase/functions/_shared/bia-core.ts`:
  - `createOrder` — lógica de busca de produto com filtro por categoria
  - `buildSystemPrompt` — instrução explícita sobre nomes de produto no bloco de confirmação


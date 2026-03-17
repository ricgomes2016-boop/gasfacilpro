

# Fix: "Nosso Preço" sem valor na Análise de Concorrência

## Problema
A query em `AnaliseConcorrencia.tsx` busca `preco_venda` na tabela `produtos`, mas a coluna real se chama `preco`. Como `preco_venda` não existe, o Supabase retorna `null` para todos os produtos, resultando em "nosso preço = 0" em toda a análise.

Além disso, `preco_portaria` e `preco_telefone` estão `null` para quase todos os produtos — apenas "Água Mineral 20L" tem esses campos preenchidos.

## Correção

### 1. Corrigir a query de produtos (AnaliseConcorrencia.tsx, linha 61)

```typescript
// De:
.select("nome, preco_venda, preco_portaria, preco_telefone")

// Para:
.select("nome, preco, preco_portaria, preco_telefone")
```

### 2. Corrigir o mapeamento `nossosPrecos` (linhas 74-81)

```typescript
// De: Number(p.preco_venda)
// Para: Number(p.preco)
map[p.nome] = {
  portaria: Number(p.preco_portaria) || Number(p.preco) || 0,
  telefone: Number(p.preco_telefone) || Number(p.preco) || 0,
  unico: Number(p.preco) || 0,
};
```

### 3. Exibir "Nosso Preço" na tabela de histórico

Atualmente a coluna "vs Nosso" mostra apenas a % de diferença. Com o fix, os valores corretos (ex: R$ 120.00) aparecerão automaticamente pois o `nossosPrecos` terá dados reais.

## Arquivo a alterar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/operacional/AnaliseConcorrencia.tsx` | Trocar `preco_venda` → `preco` na query e no mapeamento |


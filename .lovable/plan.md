

# Fix: "Nosso Preço" não aparece — Nomes de produtos não correspondem

## Problema encontrado

Os registros de concorrentes usam nomes como **"P13 Cheio"**, **"P45 Cheio"** (dos options hardcoded no fallback do select). Porém, a tabela `produtos` usa nomes como **"Gás P13"**, **"Gás P20"**, **"Gás P45"**.

Como o `nossosPrecos` é indexado por `p.nome` (ex: "Gás P13"), ao buscar `nossosPrecos["P13 Cheio"]` retorna `undefined` — por isso "vs Nosso" mostra sempre 0%.

Dados confirmados no banco:
- `concorrente_precos.produto` → "P13 Cheio", "P45 Cheio"
- `produtos.nome` → "Gás P13", "Gás P45", "Água Mineral 20L"

## Correção em `AnaliseConcorrencia.tsx`

### 1. Criar função de matching flexível

Ao montar o `nossosPrecos`, além da chave exata (`"Gás P13"`), adicionar chaves alternativas normalizadas:
- "P13 Cheio" → "Gás P13"
- "P45 Cheio" → "Gás P45"
- "P20 Cheio" → "Gás P20"

Lógica: extrair o padrão `P\d+` do nome do produto e do registro do concorrente, usar como fallback de matching.

### 2. Atualizar os options hardcoded do fallback

Trocar "P13 Cheio" → "Gás P13", "P45 Cheio" → "Gás P45", etc. para que novos registros já usem o nome correto.

### 3. Resultado esperado

A coluna "vs Nosso" no histórico e os cards de Índice de Competitividade passarão a exibir os valores reais (ex: R$ 120.00 para P13).

## Arquivo a alterar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/operacional/AnaliseConcorrencia.tsx` | Matching flexível no `nossosPrecos`, atualizar fallback options |


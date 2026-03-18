

# Diagnóstico: Preços Zerados e Nomes Inconsistentes

## Situação encontrada

### 1. Produtos com preço R$ 0,00
A unidade **Matriz** (07f9bfac) tem **todos os produtos com preço R$ 0,00**. Outras unidades como Japa Gás e Temgas têm preços preenchidos (ex: Gás P13 = R$ 120,00). Se você está visualizando a unidade Matriz, é por isso que "Nosso Preço" não aparece.

### 2. Nomes inconsistentes na tabela de concorrentes
Existem dois padrões de nomes misturados nos registros de concorrentes:

| Registro atual | Nome correto |
|---|---|
| "P13 Cheio" | "Gás P13" |
| "Gás P13" | "Gás P13" (ok) |
| "Gás P45" | "Gás P45" (ok) |

Os registros de "Aguia Gas" e "Fama Gas" usam "P13 Cheio", enquanto "Top Gas" já usa "Gás P13".

## Plano de correção

### 1. Padronizar nomes na tabela `concorrente_precos`
Atualizar via SQL (INSERT tool) os registros que usam nomes antigos:
- `"P13 Cheio"` → `"Gás P13"`
- `"P45 Cheio"` → `"Gás P45"` (se existir)
- `"P20 Cheio"` → `"Gás P20"` (se existir)

### 2. Fallback options no código já corrigidos
O código em `AnaliseConcorrencia.tsx` já usa os nomes corretos ("Gás P13", "Gás P45", etc.) nos options de fallback e tem o matching flexível via Proxy. Nenhuma alteração de código necessária.

### 3. Sobre os preços zerados
Os preços da unidade Matriz estão todos em R$ 0,00 no banco. Isso precisa ser corrigido pelo usuário na tela de Produtos, cadastrando os valores reais. Posso definir preços padrão se você informar os valores.


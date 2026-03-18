

# Cadastrar preços de portaria e telefone nas unidades

## Situação atual

As unidades **Japa Gás**, **Temgas** e **Central Gás** (referência) da empresa Central Gas têm os seguintes preços cadastrados:

| Unidade | Produto | Preço | Portaria | Telefone |
|---------|---------|-------|----------|----------|
| **Central Gas** | Gás P13 | 125 | 110 | 125 |
| **Central Gas** | Água 20L | 20 | 15 | 20 |
| **Central Gas** | Gás P20 | 210 | NULL | NULL |
| **Central Gas** | Gás P45 | 410 | NULL | NULL |
| **Japa Gás** | Gás P13 | 120 | NULL | NULL |
| **Japa Gás** | Gás P20 | 180 | NULL | NULL |
| **Japa Gás** | Gás P45 | 450 | NULL | NULL |
| **Japa Gás** | Água 20L | 20 | NULL | NULL |
| **Temgas** | Gás P13 | 120 | NULL | NULL |
| **Temgas** | Gás P20 | 180 | NULL | NULL |
| **Temgas** | Gás P45 | 380 | NULL | NULL |
| **Temgas** | Água 20L | 20 | NULL | NULL |

Todas as colunas `preco_portaria` e `preco_telefone` estão NULL nessas unidades. A Central Gas só tem P13 e Água preenchidos.

## Plano

Usar o insert tool para executar UPDATEs nos produtos das 3 unidades, definindo:
- **preco_portaria** = preço de balcão/portaria (geralmente menor que telefone)
- **preco_telefone** = preço para entrega por telefone (geralmente igual ou maior que portaria)

**Lógica de preços sugerida** (baseada no padrão da Central Gas onde portaria ~88% do telefone):

| Unidade | Produto | Portaria | Telefone |
|---------|---------|----------|----------|
| **Japa Gás** | P13 | 110 | 120 |
| **Japa Gás** | P20 | 170 | 180 |
| **Japa Gás** | P45 | 430 | 450 |
| **Japa Gás** | Água | 15 | 20 |
| **Temgas** | P13 | 110 | 120 |
| **Temgas** | P20 | 170 | 180 |
| **Temgas** | P45 | 360 | 380 |
| **Temgas** | Água | 15 | 20 |
| **Central Gas** | P20 | 195 | 210 |
| **Central Gas** | P45 | 390 | 410 |

Os valores seguem o padrão: portaria ~R$10 menor para gás, R$5 menor para água.

## Execução

8 UPDATEs por produto ID usando o insert tool. Nenhuma alteração de código necessária.

> **Nota:** Se os valores sugeridos não estiverem corretos, me informe os valores desejados antes de aprovar.


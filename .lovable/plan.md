## Diagnóstico

### 1) Pedidos com "Produto sem nome" — 293 itens em 4 unidades

Mesmo problema que ocorreu na Forte Gás: `pedido_itens.produto_id` aponta para produtos cadastrados em **outra unidade**, então o RLS oculta o produto e o relatório cai no fallback "Produto sem nome".

| Unidade do pedido | Itens afetados | Aponta para produtos de |
|---|---|---|
| Central Gas | 269 | Temgas (157), Sertaneja (47), Forte Gás (41), ABMF (22), Japa Gás (1), Morumbi (1) |
| Japa Gás | 9 | Forte Gás (6), Central (1), Sertaneja (1), Temgas (1) |
| Morumbi Gás | 4 | Central Gas (4) |
| **Órfãos (sem unidade)** | **11** | — pedidos com `unidade_id = NULL` |

Todos os produtos são "Gás P13", "Gás P20", "Gás P45" e "Água Mineral 20L" — todas as unidades já têm o produto equivalente cadastrado, então dá para remapear pelo nome.

### 2) Canais de venda — inconsistências

Além dos custom cadastrados corretamente, há mistura de valores:

- **459 pedidos com canal vazio/NULL** (Central 382, Forte 41, Morumbi 13, órfãos 12, Japa 9, Matriz 2).
- **Legado do enum antigo** (minúsculas, não cadastrado): `telefone` (3), `whatsapp` (7), `portaria` (1).
- **Duplicatas por caixa/typo**: `WhatsApp` (4) ↔ `whatsapp` (7); `Disk/Telefone` (10) ↔ `Disk/ Telefone` (4).

`pedidos.canal_venda` é texto livre — não FK — então o relatório agrupa cada variação como se fosse canal diferente.

## Plano de correção

### Fase A — Produtos (executo automaticamente após aprovação)

Para cada linha "produto de outra unidade", fazer `UPDATE pedido_itens.produto_id` para o produto de mesmo nome cadastrado na unidade do pedido. Cobre 282 itens de Central Gas, Japa Gás e Morumbi Gás.

Restam **11 itens em pedidos órfãos** (`unidade_id = NULL`) — sem saber a unidade dona, não dá para escolher o produto certo. Sugestão: deixar como estão e listá-los aqui para você decidir manualmente (ou apagar se forem lixo de teste). Confirme qual caminho.

### Fase B — Canais de venda (precisa da sua decisão)

Duas partes independentes:

**B1. Normalização de duplicatas** — mesclar variações que são claramente o mesmo canal:
- `whatsapp` + `WhatsApp` → um único canal (qual grafia manter?)
- `Disk/Telefone` + `Disk/ Telefone` → um único canal
- `telefone` (legado) → mapear para algum canal cadastrado ou renomear?
- `portaria` (legado) → mapear para "Portaria" (já cadastrado)?

**B2. Pedidos com canal NULL** (459 pedidos): não há como inferir automaticamente. Opções:
- (a) Deixar como está (aparece como "outros" no relatório).
- (b) Preencher tudo com um canal padrão por unidade (ex: "Balcão" ou "Disk/Telefone") — arriscado, é chute.
- (c) Deixar como está e criar uma tela/filtro para você classificar em lote depois.

## Fora de escopo

- Não vou converter `canal_venda` em FK para `canais_venda` (mudança de schema grande, quebra múltiplos formulários).
- Não vou tocar em RLS de `produtos` (o modelo está correto — o problema é dado sujo).

## Perguntas antes de executar

1. Fase A: pode remapear os 282 itens automaticamente pelo nome? Os 11 órfãos eu listo para você decidir.
2. B1: manter `WhatsApp` (capitalizado) e `Disk/Telefone` (sem espaço)? Confirma?
3. B1: os 3 pedidos com `telefone` (minúsculo, legado) — mapear para `Disk/Telefone`?
4. B2: os 459 pedidos sem canal — deixar como estão, ou preencher com um padrão?

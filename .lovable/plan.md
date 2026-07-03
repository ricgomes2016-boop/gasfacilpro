## Objetivo

Priorizar **endereço** como chave principal de busca/identificação de cliente em dois pontos:

1. Tela **Vendas / Editar Pedido** — busca de cliente
2. Fluxo **Bia + Entregador** — antes de criar cliente novo, procurar por endereço

---

## 1. Vendas / Editar Pedido — busca prioriza endereço

**Arquivo:** `src/pages/vendas/EditarPedido.tsx` (componente de busca de cliente já usa portal)

**Mudanças:**
- Alterar o placeholder do input para: *"Buscar por endereço, rua, número, bairro, nome ou telefone"*.
- Alterar a renderização de cada resultado para exibir o **endereço em destaque** (linha 1, negrito) e o nome/telefone/cidade em linha secundária (igual ao padrão já usado em `ClienteSearchVendedor.tsx`, que é a referência de UX aprovada).
- A RPC `autocomplete_clientes_v2` já busca por endereço/bairro/rua — não precisa alterar backend. Apenas garantir que a ordenação priorize matches em `endereco` quando o termo tiver 3+ caracteres alfabéticos (verificar se a função SQL já faz; se não, ajustar via migração).

**Verificação necessária antes de codar:** ler a definição de `autocomplete_clientes_v2` para confirmar se já pondera endereço. Se sim, mudança é 100% frontend.

---

## 2. Bia (entregador) — buscar endereço antes de criar cliente

**Arquivo principal:** `supabase/functions/_shared/bia-entregador.ts` (fluxo de lançamento de pedido pelo entregador via WhatsApp)

**Fluxo atual (resumido):** Bia extrai dados da mensagem → cria cliente novo → cria pedido.

**Fluxo novo:**

```text
Mensagem do entregador
   ↓
Extrair: nome, endereço (rua+número), bairro, telefone
   ↓
1º — Buscar cliente por ENDEREÇO na unidade
     (tabelas: clientes.endereco+numero+bairro
              + cliente_enderecos.rua+numero+bairro
              filtrado por cliente_unidades.unidade_id)
   ↓
   Encontrou match forte de endereço?
   ├── SIM → usar esse cliente_id (não criar novo)
   └── NÃO → 2º fallback: buscar por telefone (se veio)
             ├── SIM → usar cliente existente
             └── NÃO → 3º criar cliente novo + associar à unidade
   ↓
Criar pedido vinculado ao cliente_id resolvido
```

**Critério de "match forte de endereço":**
- Mesma unidade (via `cliente_unidades`)
- Rua normalizada igual (lowercase, sem acentos, sem "rua/av/r.")
- Número igual (quando informado nos dois lados)
- Bairro igual OU vazio em um dos lados

**Implementação:**
- Nova função helper `resolverClientePorEndereco(supabase, { unidadeId, rua, numero, bairro, telefone, nome })` em `supabase/functions/_shared/bia-entregador.ts` (ou arquivo auxiliar `_shared/cliente-resolver.ts` se ficar grande).
- Usa `supabase.from('clientes').select().eq('empresa_id', ...)` + join implícito com `cliente_unidades`, e também consulta `cliente_enderecos`.
- Retorna `{ clienteId, criouNovo: boolean, matchTipo: 'endereco' | 'telefone' | 'novo' }`.
- Substituir o trecho atual que sempre insere em `clientes` pela chamada dessa função.
- Adicionar log claro (`console.log('[bia-entregador] cliente resolvido por', matchTipo, clienteId)`) para auditoria.

**Efeito colateral positivo:** os 3 pedidos que o Marcos lançou hoje (Angélica, Ana Cláudia, Tabacaria Bus) só criaram cliente novo porque o fluxo antigo nunca procurou. Com a mudança, próximas mensagens reusarão o cadastro.

---

## Fora de escopo (não vou mexer)

- Não altero a UI do PDV / Nova Venda / Vendedor (já está no padrão endereço-primeiro).
- Não altero a RPC `autocomplete_clientes_v2` a menos que a leitura mostre que ela ignora endereço.
- Não crio backfill/deduplicação de clientes duplicados existentes — se quiser, é outro pedido.

---

## Entregáveis

1. Edit em `src/pages/vendas/EditarPedido.tsx` (placeholder + layout do dropdown).
2. Edit em `supabase/functions/_shared/bia-entregador.ts` (resolver por endereço antes de criar).
3. Possível migração pequena se `autocomplete_clientes_v2` não priorizar endereço (confirmar na fase de build).
4. Deploy das edge functions afetadas (`bia-webhook` / a que importa `bia-entregador.ts`).

## Objetivo
Na tela **Vendas > Pedidos**, melhorar a coluna **Canal de venda** (desktop e mobile) para:
1. Ter um **campo de busca** ao clicar no canal.
2. **Lista rolável** quando houver muitos canais.
3. **Filtrar por unidade**: cada unidade enxerga apenas seus canais "fixos" + **todos os canais do tipo `parceiro_vale_gas` ativos da empresa** (independente de qual unidade cadastrou), para permitir resgate cruzado de vale gás entre unidades da mesma empresa.

## Mudanças

### 1. `src/pages/vendas/Pedidos.tsx`
- **Query `canais-venda-empresa`**: trocar o filtro para trazer:
  - canais ativos onde `unidade_id = unidadeAtual.id` (canais fixos da unidade), **OU**
  - canais ativos onde `tipo = 'parceiro_vale_gas'` (parceiros visíveis para toda a empresa).
  - Incluir `unidadeAtual?.id` na `queryKey` para refetch ao trocar de unidade.
  - Ordenar: fixos primeiro, parceiros depois, ambos alfabéticos.

- **Desktop (Popover, ~linha 1057–1077)**: trocar a lista simples por um **Command** (`@/components/ui/command`) com `CommandInput` (busca), `CommandList` rolável (`max-h-[260px]`), `CommandEmpty`, e dois `CommandGroup`: "Canais da unidade" e "Parceiros Vale Gás". Largura do popover ~`w-72`.

- **Mobile (Select, ~linha 986–992)**: substituir o `Select` por um botão que abre o mesmo componente `Command` dentro de um `Popover` (mesmo padrão do desktop), para ter busca e rolagem também no mobile.

### 2. (Opcional, sem alterar regra) `src/pages/operacional/CanaisVenda.tsx`
- Não muda comportamento. Apenas confirmar que canais fixos já são gravados com `unidade_id = unidadeAtual.id` (já está assim) e parceiros podem ser cadastrados em qualquer unidade.

## Detalhes técnicos
- Filtro Supabase:
  ```ts
  supabase.from("canais_venda")
    .select("id, nome, tipo, unidade_id")
    .eq("ativo", true)
    .or(`unidade_id.eq.${unidadeAtual.id},tipo.eq.parceiro_vale_gas`)
  ```
  Se `unidadeAtual` não existir, cai apenas em `tipo.eq.parceiro_vale_gas`.
- O valor salvo em `pedidos.canal_venda` continua sendo o `nome` (sem mudança de schema).
- Não mexer em `App.tsx`, rotas, providers, nem em outras telas.

## Fora de escopo
- Schema do banco, RLS, edge functions.
- Outras telas que listam canais (PDV, Nova Venda) — só alterar Pedidos como pedido.

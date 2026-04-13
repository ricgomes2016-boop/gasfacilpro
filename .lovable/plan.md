

## Plano: Edição de preço, canal de venda e detecção de perfil no app do entregador

### Problemas atuais

1. **Preço fixo** — O item na lista mostra `R$ X.XX un.` mas não permite editar o valor unitário. No sistema (`NovaVenda.tsx` e `PDVProductList.tsx`), o preço é editável via Input.
2. **Canal de venda fixo** — Está hardcoded como `"entregador"` (linha 408). No sistema, existe um Select com canais fixos + dinâmicos da tabela `canais_venda`.
3. **Sem detecção de perfil** — Ao selecionar um cliente, não há indicação se ele é `revenda`, `comercial` ou `residencial`. A tabela `clientes` já possui a coluna `tipo` com esses valores.

### Alterações

**Arquivo: `src/pages/entregador/EntregadorNovaVenda.tsx`**

1. **Edição de preço unitário nos itens**
   - No bloco de renderização dos itens (linhas 615-634), adicionar um Input editável no preço unitário, igual ao `PDVProductList`
   - Criar função `alterarPreco(index, novoPreco)` que atualiza `precoUnitario` no state

2. **Canal de venda editável**
   - Adicionar state `canalVenda` (default `"entregador"`)
   - Fetch da tabela `canais_venda` (ativo=true) igual ao sistema
   - Substituir o card estático "Canal: Entregador" (linhas 689-697) por um Select com canais fixos (Telefone, WhatsApp, Portaria, Entregador) + dinâmicos
   - Usar `canalVenda` no insert do pedido (linha 408)

3. **Detecção de perfil do cliente**
   - Expandir `ClienteDB` para incluir `tipo: string | null`
   - No fetch de clientes, adicionar `tipo` no select
   - Ao selecionar um cliente, exibir um Badge colorido indicando o tipo: `revenda` (laranja), `comercial` (azul), `residencial` (cinza)
   - Mostrar o badge no card do cliente e na lista de busca

### Detalhes técnicos

```typescript
// Novo state
const [canalVenda, setCanalVenda] = useState("entregador");

// Fetch canais
const { data: canaisVenda = [] } = useQuery({
  queryKey: ["canais-venda"],
  queryFn: async () => {
    const { data } = await supabase.from("canais_venda").select("id, nome").eq("ativo", true).order("nome");
    return data || [];
  },
});

// Editar preço
const alterarPreco = (index: number, novoPreco: number) => {
  setItens(prev => prev.map((item, i) => i === index ? { ...item, precoUnitario: novoPreco } : item));
};

// Badge de tipo do cliente
const tipoBadge = { revenda: "bg-orange-100 text-orange-800", comercial: "bg-blue-100 text-blue-800", residencial: "bg-gray-100 text-gray-800" };
```

### Resultado esperado
- Entregador pode alterar o preço de qualquer produto na venda
- Entregador pode escolher o canal de venda (telefone, whatsapp, entregador, etc.)
- Ao buscar/selecionar cliente, aparece badge indicando se é revenda, comercial ou residencial


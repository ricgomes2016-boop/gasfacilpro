

## Plano: Atualização automática do cadastro de clientes no app do entregador

### Problema
No app do entregador (`EntregadorNovaVenda.tsx`), a lista de clientes é carregada uma vez ao abrir a tela (`fetchData`), com limite de 500 registros. Quando um cliente novo é cadastrado (pelo sistema ou pelo próprio app via IA), a lista local não atualiza automaticamente.

### Alterações

**Arquivo: `src/pages/entregador/EntregadorNovaVenda.tsx`**

1. **Realtime subscription na tabela `clientes`** -- Adicionar um listener Supabase Realtime que escuta INSERT/UPDATE na tabela `clientes` filtrado pelo `empresa_id` do entregador. Quando um novo cliente é inserido, ele e automaticamente adicionado a lista local `clientes` sem precisar recarregar a pagina.

2. **Atualizar lista local apos cadastro via IA** -- Apos o bloco que cria um novo cliente (linha ~262), tambem adicionar o cliente criado ao state local `clientes` imediatamente, para que ele apareca na busca sem precisar do realtime.

3. **Remover limite de 500** -- Trocar o `.limit(500)` por busca paginada ou pelo menos aumentar o limite, considerando que a busca no dialog ja filtra localmente.

### Detalhes tecnicos

```typescript
// Realtime subscription para novos clientes
useEffect(() => {
  if (!empresa?.id) return;
  const channel = supabase
    .channel("clientes-entregador")
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "clientes",
      filter: `empresa_id=eq.${empresa.id}`,
    }, (payload) => {
      const novo = payload.new as ClienteDB;
      setClientes(prev => {
        if (prev.find(c => c.id === novo.id)) return prev;
        return [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome));
      });
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [empresa?.id]);
```

```typescript
// Apos criar cliente via IA, atualizar lista local
if (criado) {
  setClientes(prev => [...prev, {
    id: criado.id, nome: data.cliente_nome,
    telefone: data.cliente_telefone || null,
    endereco: data.endereco || null,
    bairro: data.bairro || null,
    cep: data.cep || null,
    cidade: data.cidade || null,
  }]);
}
```

### Resultado esperado
- Clientes cadastrados no sistema aparecem automaticamente no app do entregador em tempo real
- Clientes cadastrados pelo proprio entregador (via IA ou manual) aparecem na lista imediatamente
- Sem necessidade de recarregar a pagina


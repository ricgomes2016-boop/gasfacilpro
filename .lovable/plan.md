

## Adicionar aba "Compras (visão antiga)" com edição inline

### O que será entregue

Na página `/transportadora/compras` (`TranspCompras.tsx`), adicionar uma **nova aba** ao lado das existentes (Compras / Análise GLP / Produtos), chamada **"Visão Simples"**, que reproduz a tela antiga (`src/pages/transportadora/Compras.tsx`) — lista enxuta de cards com Fornecedor, Produto, Qtd, Total — e agora **com edição inline**.

### Mudanças

**1. Nova aba em `TranspCompras.tsx`**
- Adicionar `<TabsTrigger value="simples">Visão Simples</TabsTrigger>` após "Produtos".
- Adicionar `<TabsContent value="simples">` renderizando o novo componente `ComprasSimplesTable`.
- Reusar o array `compras` já carregado pela query `transp-compras` (sem nova requisição).

**2. Novo componente `src/components/transportadora/compras/ComprasSimplesTable.tsx`**
- Layout em cards (igual ao `Compras.tsx` antigo) mostrando: Data, Fornecedor, Produto/Descrição, Quantidade, Custo Total.
- Botão **"Editar"** em cada card abre um `Dialog` com os campos editáveis:
  - Fornecedor (text)
  - Produto/Descrição (text)
  - Quantidade (number)
  - Preço unitário (number)
  - Desconto (number)
  - Custo total (number)
  - Data (date)
  - Número NF (text)
  - CFOP (text)
- Botão **"Salvar"** chama `supabase.from("transp_compras").update(patch).eq("id", id)` e invalida a query `["transp-compras"]`.
- Botão **"Excluir"** com confirmação, executa delete na mesma tabela.
- Busca simples no topo (filtra fornecedor/produto/NF).
- Paginação client-side: 30 por página + "Ver mais".

**3. Não mexer em**
- `src/pages/transportadora/Compras.tsx` legado (rota separada continua funcionando).
- Lógica do painel Outlook restaurado.
- `ComprasListaTable` (a aba "Compras" detalhada continua igual).

### Arquivos
- **Criar**: `src/components/transportadora/compras/ComprasSimplesTable.tsx`
- **Editar**: `src/pages/transportadora/TranspCompras.tsx` (adicionar trigger + content da nova aba)

### Critérios de aceite
- Em `/transportadora/compras` aparece nova aba **"Visão Simples"** ao lado de Produtos.
- Lista mostra cards no estilo da tela antiga.
- Botão "Editar" abre modal com todos os campos principais editáveis e salva no banco.
- Botão "Excluir" remove o registro após confirmação.
- Demais abas e o painel de importação Outlook permanecem intactos.


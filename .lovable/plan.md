## Otimizar tela Vendas / Pedidos — Filtros em popup

Mover o card de busca/filtros para um popup acionado por um novo botão **"Mais Filtros"** colocado ao lado do botão **+ Novo Pedido**.

### Mudanças em `src/pages/vendas/Pedidos.tsx`

1. **Remover** o `Card` de filtros (linhas ~786–840) da posição atual.
2. **Adicionar botão "Mais Filtros"** na barra de ações superior (linhas ~671–684), à esquerda do botão "+ Novo Pedido":
   - Variante `outline`, ícone `SlidersHorizontal` (lucide).
   - Mostra um badge com a contagem de filtros ativos quando `busca`, `filtroStatus !== "todos"`, `filtroEntregador !== "todos"` ou as datas forem diferentes de hoje.
3. **Criar Dialog/Popup** (usando `ResponsiveDialog` para boa UX em mobile, conforme padrão do projeto) que envolve exatamente o mesmo conteúdo do card removido:
   - Campo de busca
   - Início / Fim
   - Select Status
   - Select Entregador
   - Botão Limpar
   - Adicionar botão "Aplicar / Fechar" no rodapé do dialog.
4. **Estado**: nenhum estado novo de dados — só `const [filtrosAbertos, setFiltrosAbertos] = useState(false)`. Lógica de filtragem (`pedidosFiltrados`, `useEffect` de paginação) permanece intacta.
5. **Mobile**: o botão "Mais Filtros" entra no mesmo `flex-wrap` da barra de ações, então já se adapta. O `ResponsiveDialog` vira drawer no mobile (padrão do projeto).

### Não muda
- Lógica de pedidos, hooks, KPIs, tabela, alertas e sugestão IA permanecem inalterados.
- Nenhuma mudança em rotas, contextos ou backend.

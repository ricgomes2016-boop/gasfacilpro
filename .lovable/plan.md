## Toolbar de Vendas › Pedidos

Reorganizar a barra superior em `src/pages/vendas/Pedidos.tsx` (linhas ~690–719) para usar um único menu **Mais ações**, deixando os botões principais visíveis e removendo o microfone desta página.

### Nova ordem (esquerda → direita)
1. **+ Novo Pedido** (botão accent, primeiro)
2. **Mais ações** (novo `DropdownMenu`, estilo da imagem 2 — botão escuro com ícone de engrenagem + chevron)
3. **Mapa Operacional**
4. **Mais Filtros**

### Itens do menu "Mais ações"
Reaproveitando a lógica já existente em `SmartImportButtons`:
- Tirar foto (ícone `Camera`) → dispara `cameraInputRef`
- Importar imagem (ícone `ImageIcon`) → dispara `photoInputRef`
- Importar PDF (ícone `FileUp`, label "PDF") → dispara `pdfInputRef`
- Separador
- Exportar CSV (ícone `Download`) → chama `exportarPedidosCSV(pedidosFiltrados)` + toast

### Como implementar
- Adaptar `SmartImportButtons` para aceitar uma prop `renderAs?: "buttons" | "menu-items"` (default mantém comportamento atual para não quebrar outros usos). Quando `"menu-items"`, expor os 3 itens (foto, imagem, PDF) como `<DropdownMenuItem>` e **omitir o microfone**, mantendo os `<input type="file">` ocultos e os handlers internos.
- Em `Pedidos.tsx`, substituir o bloco da toolbar por:
  - Botão `+ Novo Pedido`
  - `DropdownMenu` "Mais ações" com `<DropdownMenuTrigger>` (Button variant default, ícone `Settings2` + chevron) contendo os itens de importação + Exportar CSV
  - Botões `Mapa Operacional` e `Mais Filtros` (inalterados)
- Remover daqui o botão de microfone e os botões soltos de Exportar CSV e do `SmartImportButtons` em modo "buttons".

### Fora de escopo
- Nenhuma alteração em outras telas, hooks, rotas, edge functions ou esquema.
- Sem mudança visual no restante da página (KPIs, tabela, filtros).

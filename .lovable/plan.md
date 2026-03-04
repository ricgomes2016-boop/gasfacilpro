

# Audit Completo Mobile + Sugestoes de Melhoria

## Problemas Identificados

### 1. `App.css` com estilos conflitantes (CRITICO)
O arquivo `src/App.css` contém regras do template Vite original que **limitam a largura e adicionam padding** ao `#root`:
```css
#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}
```
Embora este arquivo **nao esteja importado** em `main.tsx` (apenas `index.css` esta), ele pode causar confusao. Se algum import futuro o incluir, quebrara todo o layout. **Acao: remover o arquivo ou limpar seu conteudo.**

### 2. Cadastro de Clientes - Layout nao responsivo (CRITICO)
Em `CadastroClientes.tsx` (linha 883):
- `p-6` fixo sem reducao mobile (deveria ser `p-3 sm:p-6`)
- Botoes de acao no topo (Importar, Mesclar, Novo Cliente) sem `flex-wrap`, transbordando em telas pequenas
- Barra de busca com `w-64` fixo (linha 992) que nao se adapta ao mobile
- A area de filtros e botoes no CardHeader nao empilha verticalmente

### 3. Configuracoes - Conteudo cortado no mobile
Em `Configuracoes.tsx` (linha 297):
- `grid md:grid-cols-2` funciona, mas `p-6` fixo sem responsividade
- Switches de "Regras de Cadastro" ficam apertados em telas < 360px

### 4. Pedidos - Tabela com scroll horizontal parcial
Em `Pedidos.tsx`:
- Ja tem `overflow-x-auto` e `hidden md:table-cell`, o que e bom
- Porem o padding `p-0 md:p-6` pode cortar conteudo no edge das celulas
- Filtros superiores (Select de status, busca) podem transbordar

### 5. Nova Venda - Campo AI muito largo
Em `NovaVenda.tsx` (linha 877):
- `min-w-[200px]` no input AI pode causar overflow em telas muito estreitas

### 6. MobileBottomBar sobrepondo conteudo
- O `MainLayout` aplica `pb-14` ao `main`, mas algumas paginas internas adicionam seus proprios paddings sem considerar a barra inferior, podendo causar sobreposicao de botoes de acao (como "Salvar Regras" em Configuracoes)

### 7. Sidebar hidden no mobile - OK, usa MobileNav
- A Sidebar usa `hidden md:flex`, e o `MobileNav` (hamburger) aparece no Header. Isso esta correto.

## Plano de Implementacao

### Tarefa 1: Limpar App.css
- Remover todo conteudo do `src/App.css` ou deletar o arquivo (nao esta importado, mas e lixo)

### Tarefa 2: Responsividade da pagina CadastroClientes
- Mudar `p-6` para `p-3 sm:p-6`
- Adicionar `flex-wrap` nos botoes de acao superiores
- Mudar busca de `w-64` fixo para `w-full sm:w-64`
- Empilhar busca e filtro verticalmente no mobile
- Reorganizar header do card para mobile-first

### Tarefa 3: Responsividade da pagina Configuracoes
- Mudar `p-6` para `p-3 sm:p-6`
- Garantir que switches tenham espaco suficiente em telas estreitas

### Tarefa 4: Ajustes gerais de padding em paginas com MainLayout
- Revisar todas as paginas que usam `p-6` fixo e trocar por `p-3 sm:p-4 md:p-6`
- Paginas afetadas: CadastroClientes, Configuracoes, e potencialmente Estoque, Entregas, CaixaDia, Produtos, etc.

### Tarefa 5: Melhoria no form "Novo Cliente" (dialog)
- O dialog ja usa `max-w-2xl max-h-[95vh] overflow-y-auto` e grids responsivos `grid-cols-1 sm:grid-cols-2` - esta bom
- Pequeno ajuste: o label "Telefone *" deveria respeitar `regras.telefone_obrigatorio` para mostrar ou nao o asterisco

### Tarefa 6: Ajustes no MobileBottomBar
- Garantir que paginas com botoes de acao no rodape (ex: "Salvar") tenham `pb-20` em vez de `pb-14`

## Sugestoes de Melhoria

1. **CadastroClientes mobile-first**: Em telas pequenas, trocar a tabela por cards empilhaveis (cada cliente como um card com acoes), similar ao que ja e feito no app do entregador
2. **Busca global no mobile**: O CommandPalette (Cmd+K) nao e acessivel no mobile - adicionar um botao de busca visivel no header mobile
3. **Dark mode toggle**: O sistema ja suporta tema dark (CSS variables definidas), mas nao ha toggle visivel para o usuario
4. **PWA install prompt**: O sistema tem LandingPage mencionando que e PWA, mas nao ha configuracao de service worker nem manifest adequado para instalacao


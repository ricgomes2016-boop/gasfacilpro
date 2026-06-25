## Objetivo

Replicar fielmente o layout da imagem na tela `/vendas/pedidos`, mantendo 100% da funcionalidade existente. Foco em hierarquia, respiro e remoção de "card dentro de card".

## Nova ordem visual (de cima para baixo)

```text
┌────────────────────────────────────────────────────────────┐
│  Header "Pedidos"                                          │
├────────────────────────────────────────────────────────────┤
│  [KPI Pendentes] [KPI Em Rota] [KPI Entregues] [KPI Cancelados] │  ← 4 cards, faixa colorida no topo
├────────────────────────────────────────────────────────────┤
│  [🔍 Buscar pedido, cliente ou endereço...] [Status ▾] [Período ▾] [+ Novo Pedido] │  ← Toolbar única
├────────────────────────────────────────────────────────────┤
│  Pedidos de Hoje (49)                          [↓ Exportar][⋯ Mais]│
│  ───────────────────────────────────────────────────────── │
│  #     CLIENTE       PRODUTO   PAGAMENTO  ENTREGADOR  VALOR  STATUS         │
│  #1289 Maria Costa   P13 × 1   💵 Dinheiro  (CL)     R$ 90  · Pendente [Enviar] │
│  #1288 Bar do Zé     P45 × 1   💳 Pix       (RM)     R$ 310 · Em rota  [Mapa]   │
│  ...                                                                            │
└────────────────────────────────────────────────────────────┘
```

## Mudanças concretas

### 1. KPIs (linha 946-981)
- Reduzir de **5 para 4 cards** removendo "Total Vendas" (poluição; o total fica no rodapé da tabela como linha somatório, opcional).
- Novo visual idêntico à imagem: card branco, faixa colorida 3px no topo (warning/info/success/destructive), label `UPPERCASE text-[11px] tracking-wider text-muted-foreground` e número grande `text-3xl font-bold` na cor do status. Sem ícone redondo lateral.
- Grid: `grid-cols-2 md:grid-cols-4 gap-3`.

### 2. Toolbar única (substitui as duas linhas atuais 717-761 + filtros embutidos)
- Container `flex gap-2 items-center` (sem card wrapper).
- Esquerda: `<Input>` busca largo (`flex-1`) com ícone de lupa, placeholder "Buscar pedido, cliente ou endereço…" — substitui o botão "Mais Filtros" e o input dentro do dialog para busca rápida inline (o dialog "Filtros" continua acessível via menu "⋯ Mais" do header da tabela para filtros avançados).
- Direita (mesma linha): `<Select>` Status (Todos / Pendente / Em Rota / Entregue / Cancelado), `<Select>` Período (Hoje / Semana / Mês / Personalizado), botão `+ Novo Pedido` (variant primary).
- Em mobile: empilha verticalmente (busca full-width, selects 50/50, botão full-width).

### 3. Botões secundários
- Mover **Mapa Operacional**, **Mais Ações** (Tirar foto, Importar imagem, Importar PDF, CSV) e **Filtros avançados** para um único dropdown `⋯ Mais` no canto direito do header da tabela (junto ao botão Exportar). Mantém todas as ações, sem ocupar espaço na toolbar principal.

### 4. Header da tabela (1009-1017)
- Título à esquerda: `Pedidos de Hoje (49)` com contador em muted.
- Direita: `[↓ Exportar]` outline + `[⋯ Mais]` dropdown.
- Remover info de paginação daqui — vai para o rodapé da tabela.

### 5. Tabela desktop (estilo da imagem)
- **Remover** todos os hovers de `-translate-y-0.5` e sombras pesadas nas linhas.
- Linhas com hairline `border-b border-border/40`, altura confortável (`h-14`), hover sutil `hover:bg-muted/30`.
- Coluna **#**: monospace `text-muted-foreground`.
- Coluna **CLIENTE**: `font-medium text-foreground` (sem link azul — clique abre visualização).
- Coluna **PAGAMENTO**: emoji + label (💵 Dinheiro · 💳 Pix · 🧾 Boleto · 💳 Cartão).
- Coluna **ENTREGADOR**: avatar circular 28px com iniciais e cor por hash (azul/verde/laranja/roxo). `—` quando vazio.
- Coluna **VALOR**: `font-semibold tabular-nums`.
- Coluna **STATUS**: ponto colorido 8px + texto (sem badge com fundo): `· Pendente`, `· Em rota`, `· Entregue`, `✕ Cancelado`.
- Coluna ação contextual: botão outline pequeno que muda por status — `Enviar` (pendente, primary), `Mapa` (em_rota), `Recibo` (entregue), `Motivo` (cancelado, ghost).
- Cabeçalho da tabela: `bg-transparent`, `uppercase text-[11px] tracking-wider text-muted-foreground font-medium`, sem borda inferior pesada.
- Checkbox de seleção fica oculto por padrão e aparece no hover da linha (ou via toggle no header). Mantém ação em lote.

### 6. Eliminar card-dentro-de-card
- Wrapper da tabela usa `<Card>` único com `p-0` no `CardContent`. Remover `bg-card`, sombras e cantos extras dos elementos internos.
- Filtros avançados continuam no `ResponsiveDialog` (sem alterar a lógica).

### 7. Mobile
- Manter os cards de pedido atuais mas remover `rounded-2xl` (usar `var(--radius)`), `shadow-md` e `hover:-translate-y-0.5` para alinhar ao tema limpo.

## Funcionalidade preservada

Nada é removido — apenas reorganizado:
- Importação de PDF/imagem/foto → dropdown `⋯ Mais`.
- Exportar CSV → botão dedicado no header da tabela.
- Mapa Operacional, Filtros avançados, ações em lote, edição de canal de venda, agendamentos, transferências, dropdown de ações por linha → todos mantidos.
- KPI "Total de Vendas" → exibido como rodapé da tabela `Total: R$ X.XXX,XX` alinhado à direita (compensa a remoção do 5º card).

## Detalhes técnicos

- Editar somente `src/pages/vendas/Pedidos.tsx`.
- Usar tokens do tema (`var(--radius)`, `border-border/40`, `bg-muted/30`, `text-foreground`, cores `warning/info/success/destructive`). Sem cores hardcoded.
- Avatar do entregador: helper local `iniciaisDoNome(nome)` + paleta de 6 tons (`bg-blue-500`, `bg-emerald-500`, `bg-amber-500`, `bg-violet-500`, `bg-rose-500`, `bg-sky-500`) escolhida por hash do nome.
- Status como ponto: `<span className="inline-block h-2 w-2 rounded-full bg-{cor}" />` + texto no `text-foreground/80`.
- Botão de ação contextual reaproveita os handlers existentes (`enviarWhatsApp`, navegar pro mapa filtrado, `gerarComprovanteEntregaPdf`, abrir modal de motivo de cancelamento).
- Nada de mudança em hooks, queries Supabase ou rotas.

## Validação após implementação

1. Conferir visualmente que a ordem é KPIs → Toolbar → Tabela.
2. Confirmar 4 KPIs (não 5) com faixa colorida no topo.
3. Confirmar busca/status/período/Novo Pedido na mesma linha.
4. Tabela sem cards aninhados, status como ponto colorido, ação contextual à direita.
5. Todos os fluxos (criar, editar, cancelar, exportar, importar, mapa, filtros avançados) seguem acessíveis.

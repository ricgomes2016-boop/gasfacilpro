## Otimização da tela "Nova Venda" — Versão Antiga

Apenas a visão antiga (`useNewView === false`) será alterada. A versão nova permanece intacta.

### Mudanças no layout (linhas 1481–1499 de `src/pages/vendas/NovaVenda.tsx`)

**Layout atual (antiga):** coluna esquerda empilha Meta → Cliente → Entregador → Vendedor → Produtos → Pagamento; coluna direita tem Resumo da Venda (sticky) + Histórico do Cliente.

**Novo layout proposto:**

```text
┌───────────────────────────────────────────────┬──────────────────────┐
│ metaCard (Data Entrega + Canal)               │                      │
├───────────────────────────────────────────────┤                      │
│ CustomerSearch (card Cliente)                 │  Histórico do        │
│   ─ Linha de seletores compactos (3 colunas) ─│  Cliente             │
│   [Entregador ▾] [Produto ▾] [Pagamento ▾]    │                      │
├───────────────────────────────────────────────┴──────────────────────┤
│ Resumo da Venda (full width abaixo de tudo, desktop)                 │
└──────────────────────────────────────────────────────────────────────┘
```

- **Desktop (`lg+`)**: grid 2 colunas — esquerda com `metaCard` + `CustomerSearch` (com a linha de 3 seletores embutida ao final do card) + `ProductSearch` (lista de itens detalhada) + `PaymentSection` (detalhes); direita com `CustomerHistory` sticky. **Resumo da Venda** ocupa linha inteira **abaixo do Histórico**, full-width.
- **Mobile**: tudo em uma coluna na ordem: meta → cliente → seletores → produtos → pagamento → entregador → histórico → **Resumo da Venda (último)** via classes `order-*` em mobile e `lg:order-*` em desktop.

### Linha compacta de 3 seletores (dentro/abaixo do card Cliente)

Adicionar um bloco `grid grid-cols-1 sm:grid-cols-3 gap-2` logo após `<CustomerSearch />`, contendo três `Select` compactos shadcn (`h-9 text-sm`):

1. **Entregador** — popula a partir do mesmo hook usado por `DeliveryPersonSelect` (lista de entregadores ativos da unidade). `onChange` chama `handleSelecionarEntregador` e `handleVendedorAuto` (mantém auto-seleção do vendedor). Label "Entregador".
2. **Produto** — popula com produtos ativos da unidade (mesma fonte que `ProductSearch`). Selecionar adiciona 1 unidade do produto a `itens` via o setter já existente. Label "Adicionar produto".
3. **Forma de Pagamento** — opções fixas (Dinheiro, PIX, Cartão Crédito, Cartão Débito, Fiado, Boleto, Vale-Gás) — selecionar cria/atualiza um pagamento único com `valor = totalVenda` em `pagamentos`. Label "Pagamento".

Os componentes completos `ProductSearch` e `PaymentSection` continuam abaixo (para edição detalhada: quantidade, múltiplos itens, divisão de pagamento, troco). Os 3 seletores são apenas atalhos rápidos.

`DeliveryPersonSelect` e `VendedorSelect` antigos saem da coluna principal (entregador agora é definido pelo seletor compacto; vendedor continua selecionado automaticamente via `handleVendedorAuto`). Caso o atendente precise trocar manualmente o vendedor, mantemos `VendedorSelect` num slot menor ao lado do seletor de Entregador (mesma linha, oculto em telas pequenas).

### Resumo da Venda

- Sai da coluna direita sticky.
- Vai para um bloco final `<div className="order-last lg:order-none lg:col-span-3 mt-3 md:mt-4">` abaixo do grid principal — em desktop fica full-width abaixo de Cliente+Histórico; em mobile naturalmente cai por último.
- Mantém todos os botões/handlers (`handleFinalizar`, `handleCancelar`, `handleAgendar`).

### Arquivos afetados

- `src/pages/vendas/NovaVenda.tsx` — somente o bloco `else` (linhas 1481–1499). Versão nova (1445–1480) **não é tocada**.

### Sem mudança

- Lógica de negócio, validações, atalhos F2–F5, draft, navegação, `metaCard`, versão nova, `aiCommandPopover`, stepper.

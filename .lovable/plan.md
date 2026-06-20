## Problema

Na versão antiga, a linha com `DeliveryPersonSelect` + `ProductSearch` + `PaymentSection` ficou apertada porque cada um desses componentes é um card completo (com header, total, busca, lista, etc.) sendo espremido em 3 colunas estreitas — gerando texto vertical e scroll horizontal.

A intenção original era ter **3 caixas de seleção compactas** (dropdowns simples) lado a lado, não 3 cards completos.

## Solução

Substituir a linha de 3 cards por **3 dropdowns compactos** usando `Select` do shadcn, e mover os componentes completos (`ProductSearch`, `PaymentSection`) para baixo em largura total — ou removê-los da versão antiga, já que a seleção rápida resolve o caso de uso comum.

### Layout proposto (versão antiga)

```
┌──────────────────────────────────────────────┬──────────────┐
│ metaCard                                     │              │
│ CustomerSearch                               │  Customer    │
│ ┌──────────┬──────────┬──────────┐           │  History     │
│ │Entregador│ Produto  │Pagamento │  (selects)│  (sticky)    │
│ └──────────┴──────────┴──────────┘           │              │
│ VendedorSelect                               │              │
│ ProductSearch (full, p/ editar itens)        │              │
│ PaymentSection (full, p/ editar pagamentos)  │              │
├──────────────────────────────────────────────┴──────────────┤
│ OrderSummary (full width)                                   │
└─────────────────────────────────────────────────────────────┘
```

No mobile, tudo em coluna única, com `OrderSummary` por último.

### Detalhes técnicos

1. **Linha compacta de 3 selects** (`grid grid-cols-1 md:grid-cols-3 gap-2`):
   - **Entregador**: `Select` listando entregadores (reusar dados de `DeliveryPersonSelect` via hook existente). `onValueChange` chama `handleSelecionarEntregador` + `handleVendedorAuto`. Label "Entregador" com ícone `Truck`.
   - **Produto (adicionar)**: `Select` com produtos do estoque. Ao selecionar, adiciona 1 unidade via setter de `itens` (mesma lógica que `ProductSearch` usa internamente no clique do produto). Label "Adicionar produto" com ícone `Package`.
   - **Pagamento**: `Select` com opções fixas (Dinheiro, PIX, Cartão Crédito, Cartão Débito, Fiado, Boleto, Vale-Gás). Cria/atualiza um único pagamento com `valor = totalVenda`. Label "Pagamento" com ícone `CreditCard`.
   - Cada select tem `h-9 text-sm` para ficar compacto.

2. **Componentes completos abaixo** (largura total da coluna esquerda, `lg:col-span-2`):
   - `ProductSearch` — para editar quantidades, remover itens, busca por nome.
   - `PaymentSection` — para múltiplos pagamentos, troco, parcelas.
   - Ficam disponíveis sem ficar espremidos.

3. **Coluna direita** (`lg:col-span-1`, sticky): apenas `CustomerHistory`.

4. **Linha final** (`lg:col-span-3`): `OrderSummary`.

5. **Mobile** (`order-*`): metaCard → CustomerSearch → 3 selects → VendedorSelect → ProductSearch → PaymentSection → CustomerHistory → OrderSummary (último).

### Escopo

- **Arquivo:** `src/pages/vendas/NovaVenda.tsx` — apenas o bloco `else` (versão antiga, linhas 1481–1500).
- **Versão nova (`useNewView === true`)**: não alterar.
- **Sem mudanças de lógica**: hooks, validações, atalhos F2–F5, `metaCard`, `aiCommandPopover`, stepper permanecem iguais.
- **Sem novos hooks de dados**: reaproveitar fontes que `DeliveryPersonSelect` e `ProductSearch` já consomem (importar o mesmo hook ou ler de props já disponíveis).
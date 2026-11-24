# Tabelas modernas e claras (foco no celular)

## O que encontrei
- O sistema tem **102 telas com tabelas**. Só 19 têm uma versão própria para o celular; nas outras 83 a tabela fica espremida e é preciso arrastar para o lado para ler.
- Já existe uma tabela padrão no sistema que vira cards no celular, mas só 7 telas a usam.
- A tela **Produtos** tem o melhor exemplo atual no celular: cada produto vira um cartão com nome, etiquetas e uma faixa com Preço / Custo / Estoque.

## O padrão proposto
**No celular: cada linha vira um cartão**
```text
┌──────────────────────────────┐
▌ Nome principal        [Status]│  ← faixa colorida à esquerda = status
▌ informação secundária         │
▌ ─────────────────────────────│
▌ VALOR   │ DATA     │ QTD      │  ← até 3 números em destaque
▌ R$ 230  │ 23/10    │ 12       │
▌                     ações ⋯   │
└──────────────────────────────┘
```
- Faixa de cor à esquerda com as mesmas cores dos cards do Acesso Rápido (verde = pago/ok, amarelo = pendente, vermelho = vencido).
- Números grandes e alinhados; rótulos pequenos em cinza.
- Botões de ação agrupados num menu "⋯", sem ficar apertados.

**No computador: tabela mais limpa**
- Cabeçalho fixo ao rolar, com fundo suave e letras pequenas em maiúsculas.
- Linhas mais altas, com uma cor de fundo de leve uma sim, uma não, e destaque ao passar o mouse.
- Valores em dinheiro alinhados à direita; status como etiqueta colorida.

## Como faço
1. Melhorar o visual base de todas as tabelas de uma vez (vale para as 102 telas no computador).
2. Criar o cartão padrão para o celular e aplicar nas telas mais usadas no dia a dia, em etapas:
   - **Etapa 1:** Contas a Receber, Contas a Pagar, Pedidos, Clientes, Caixa do dia, Despesas
   - **Etapa 2:** Compras, Transferências, Comodatos, Entregadores, Veículos, Notas fiscais
   - **Etapa 3:** demais telas com tabela
3. Ficam de fora as tabelas da Conferência de Estoque (você já aprovou o formato atual) e os relatórios em planilha.

Nenhum dado ou cálculo muda, só a forma de mostrar.

## Detalhes técnicos
- `src/components/ui/table.tsx`: estilos base (thead `sticky top-0 bg-muted/60 text-[11px] uppercase tracking-wide`, linhas `h-12`, `even:bg-muted/20`, `hover:bg-muted/40`, `tabular-nums`). Conferir conflitos com as regras globais `.system-surface :where(table thead th)` em `src/index.css` e excluir `.conferencia-table`.
- Novo `src/components/ui/mobile-row-card.tsx`: `MobileRowCard` (props `title`, `subtitle`, `status {label, tone}`, `metrics[] (até 3)`, `actions`, `onClick`) + `MobileCardList`. Tons reaproveitam `KpiTone` de `kpi-tile.tsx`.
- Em cada tela: manter a `<Table>` em `hidden md:block` e renderizar `MobileCardList` em `md:hidden` com os mesmos dados e handlers (sem novas consultas). Onde a tela já usa `ui-kit/DataTable`, preencher `mobileCard` com `MobileRowCard`.
- Registrar a regra no AGENTS.md (listas no celular usam `MobileRowCard`).

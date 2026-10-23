## Faixa de título nos produtos do card "Venda"

No card final **"Venda de DD/MM/AAAA"**, cada bloco (P13, P20, P45, Água) passa a ter uma **faixa escura no topo**, ocupando toda a largura do bloco, com o nome do produto em letras brancas e em negrito — parecida com as faixas das tabelas de contagem, só que mais escura, para ficar claro que é título.

Nada muda nos números, contas ou botões.

### Detalhes técnicos
- `src/pages/estoque/ConferenciaEstoque.tsx` (~linha 1168): o `<p>` do título vira uma faixa `-mx-4 -mt-4 mb-3 px-4 py-2 bg-slate-800` com texto em `conferencia-band-head`-like cor branca forçada (adicionar classe e regra CSS em `src/index.css` no mesmo padrão `.system-surface ... { color: hsl(0 0% 100%) !important }`, já que o tema remapeia `text-white`).
- Verificar com Playwright no celular (384px) e desktop.

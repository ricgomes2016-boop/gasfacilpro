Plano para ajustar `Vendas > Nova Venda`

1. Liberar clique nas etapas do topo
- Ajustar o comportamento do stepper para que as abas `Cliente`, `Produtos`, `Pagamento`, `Entregador` e `Confirmar` sejam clicáveis na versão nova.
- Manter a proteção básica para não abrir etapas impossíveis quando ainda não houver dados mínimos, evitando erros de fluxo.
- Permitir voltar para etapas anteriores já preenchidas, sem o avanço automático empurrar o usuário imediatamente para outra etapa enquanto ele estiver revisando.
- Corrigir o rótulo visual para `Confirmar`.

2. Refinar a lógica de avanço automático
- Manter o avanço automático quando o usuário completa uma etapa pela primeira vez:
  - Cliente preenchido → Produtos
  - Produto adicionado → Pagamento
  - Pagamento completo → Entregador
  - Entregador selecionado → Confirmar
- Evitar que essa lógica impeça o clique manual em etapas anteriores já liberadas.

3. Aplicar visual dos cards no tema GásMais
- Em `NovaVenda.tsx`, usar o estado `isGasmais` já disponível para aplicar classes específicas quando o tema GásMais estiver ativo.
- Criar um padrão de card semelhante aos cards coloridos do Dashboard GásMais:
  - borda mais nítida
  - sombra mais presente
  - topo com faixa/gradiente de cor
  - leve brilho/realce com tons do tema
- Aplicar esse padrão nos blocos principais da tela nova: IA, dados/meta da venda, busca de cliente, histórico, produtos, pagamento, entregador e resumo.

4. Cores das etapas/card por contexto
- Usar tons próximos aos cards/abas do dashboard:
  - Cliente: azul
  - Produtos: laranja
  - Pagamento: verde/emerald
  - Entregador: âmbar
  - Confirmar: primário/laranja GásMais
- No tema padrão, preservar o visual atual com tokens neutros (`bg-card`, `border`, `primary`) para não descaracterizar o ERP.

Detalhes técnicos
- Alterar principalmente `src/pages/vendas/NovaVenda.tsx`.
- Se necessário, adicionar pequenas classes utilitárias em `src/index.css` ou `src/styles/theme-gasmais.css`, mantendo tudo escopado ao tema GásMais.
- Não alterar rotas, provedores, banco de dados, autenticação ou regras de finalização da venda.
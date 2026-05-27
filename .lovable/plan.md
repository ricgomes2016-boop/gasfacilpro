## Plano

Corrigir o erro `useSidebarContext must be used within a SidebarProvider` que aparece após login no portal Transportadora.

### O que vou ajustar
1. Atualizar `TransportadoraLayout` para envolver seu conteúdo com `SidebarProvider`, igual ao padrão usado pelo `MainLayout`.
2. Manter a estrutura atual das rotas e do `App.tsx` sem refatorar, respeitando a regra de estabilidade do projeto.
3. Garantir que o `SystemFooter` continue recebendo o contexto de sidebar e pare de quebrar o portal.

### Detalhe técnico
- O erro acontece porque `SystemFooter` chama `useSidebarContext()`, mas o layout da Transportadora renderiza esse rodapé sem estar dentro de um `SidebarProvider`.
- A correção será local em `src/components/transportadora/TransportadoraLayout.tsx`, sem alterar autenticação, permissões ou rotas globais.
Vou corrigir o portal parceiro de forma direta e segura.

Plano:
1. Ajustar `SystemFooter` para não quebrar quando for usado em layouts sem `SidebarProvider`.
   - Hoje ele chama `useSidebarContext()` obrigatoriamente.
   - No portal parceiro não existe sidebar lateral do ERP, então isso causa o erro: `useSidebarContext must be used within a SidebarProvider`.
   - A correção será tornar o footer compatível com portais sem sidebar, usando `collapsed = false` como fallback.

2. Manter o layout do parceiro funcionando sem depender do layout do ERP.
   - Não vou refatorar `App.tsx`, rotas globais ou providers, respeitando a estabilidade do projeto.
   - O painel do parceiro continuará usando seu layout mobile/fixo atual.

3. Validar o fluxo crítico:
   - Acessar `/parceiro` sem quebrar.
   - Confirmar que o erro do `SidebarProvider` desapareceu.
   - Confirmar que o parceiro consegue abrir o painel e seguir para vender vale.

4. Depois da correção, publicar a nova versão para o domínio `portal.gasfacilpro.com.br` receber o ajuste.
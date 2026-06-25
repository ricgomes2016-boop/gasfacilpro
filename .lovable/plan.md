## Plano

1. **Corrigir o overlay do menu clean**
   - Trocar o fechamento via `onClick` por um handler que só fecha quando o clique realmente acontece no fundo escurecido.
   - Impedir que cliques dentro da sidebar borbulhem até o overlay/documento e fechem o menu antes da navegação.

2. **Fechar o menu somente após navegação válida**
   - Em links principais e sublinks da sidebar, manter o clique funcional e, no tema clean, fechar o drawer depois que a rota for acionada.
   - Em itens que apenas expandem submenu, não fechar a sidebar.

3. **Preservar o tema dark/default**
   - Manter o comportamento atual da sidebar fixa/colapsável fora do `operacional-clean`, sem alterar rotas ou estrutura do `App.tsx`.

4. **Validar no preview**
   - Testar: abrir menu, expandir grupos, clicar em item com submenu, clicar em link direto e clicar fora para fechar.
   - Repetir a checagem no tema clean e no tema dark/default para confirmar que os dois continuam navegáveis.
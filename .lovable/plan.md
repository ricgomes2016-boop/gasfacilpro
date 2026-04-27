Vou aplicar a identidade azul/roxo do menu nos pontos que ainda usam laranja, sem mexer na estrutura do sistema.

Plano:
1. Atualizar tokens da marca
   - Ajustar o tema principal para que `primary`, `secondary`, `accent`, `ring` e variáveis do sidebar usem azul + roxo.
   - Manter o gradiente global (`gradient-primary`) usando exatamente a base visual do menu.

2. Remover laranja visual do app
   - Trocar usos de `orange` por `primary`/gradiente azul-roxo em componentes e páginas.
   - Incluir overrides globais para classes Tailwind laranja (`bg-orange-*`, `text-orange-*`, `border-orange-*`, gradientes laranja) apontarem para azul/roxo.
   - Atualizar metadados visuais como `theme-color` do navegador/PWA para azul/roxo.

3. Preservar cores semânticas
   - Manter vermelho para erro/perigo, verde para sucesso e amarelo/âmbar para alerta real quando o sentido for operacional.
   - Onde o âmbar estiver sendo usado só como “destaque visual” ou branding, trocar para o novo gradiente.

4. Ajustar casos específicos encontrados
   - Botões/labels laranja em atendimento, despesas, marketing, frota, estoque e tela de instalação.
   - QR Code do Vale Gás que ainda usa `#f97316`.
   - Elementos públicos/assistente que usam gradiente com laranja.

5. Validar sem quebrar o sistema
   - Rodar verificação TypeScript/build.
   - Conferir que a troca é visual e não altera rotas, providers, autenticação, banco, regras de negócio ou fluxo operacional.
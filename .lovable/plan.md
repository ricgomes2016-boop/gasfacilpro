Plano para deixar os cards de `/vendas/nova` sem gradiente:

1. Remover gradientes dos cards principais
   - Trocar o `background` com `radial-gradient`/`linear-gradient` de `.venda-card` por uma cor sólida moderna.
   - Manter a paleta por etapa baseada no Acesso Rápido do dashboard, usando `hsl(var(--venda-tone) / ...)` em baixa opacidade.
   - Preservar bordas escuras, sombras e contraste de texto.

2. Remover gradientes de atalhos e superfícies internas
   - Ajustar `.venda-product-shortcut`, `.venda-payment-shortcut` e `.venda-modern-surface` para usarem `background-color` sólido.
   - Manter estados hover/selecionado/foco acessível com borda e sombra no tom da etapa.

3. Remover gradientes de cabeçalhos e tabelas dentro dos cards
   - Substituir fundos em `border-b` e `table thead tr` por cores sólidas suaves.
   - Manter a barra superior colorida dos cards, mas sem gradiente, usando uma única cor da etapa.

4. Ajustar modo escuro e tema GásMais
   - Aplicar o mesmo padrão sem gradiente também nos blocos `.dark` e `.theme-gasmais`.
   - Garantir boa legibilidade em claro/escuro sem alterar lógica da venda.

Arquivo previsto:
- `src/index.css`

Não haverá alteração de rotas, componentes React, banco de dados ou regras de negócio.
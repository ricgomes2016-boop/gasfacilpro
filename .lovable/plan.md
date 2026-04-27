Vou corrigir os conflitos de contraste sem refatorar estrutura e sem mexer nas rotas/App.

## Ajustes previstos

1. **Blindagem global de contraste**
   - Revisar as regras globais em `src/index.css` que já tentam evitar `text-white` dentro de fundos claros.
   - Ajustar para cobrir também combinações com `text-*-foreground` quando o fundo real for `card`, `background`, `popover`, `muted`, `white` ou `primary-foreground`.
   - Preservar texto branco apenas quando o fundo for realmente escuro/colorido: `bg-primary`, `bg-secondary`, `bg-success`, `bg-warning`, `bg-info`, `bg-destructive` ou gradientes fortes.

2. **Correção específica da Sidebar por tema**
   - Garantir que a Sidebar sempre use `text-sidebar-foreground` no estado normal.
   - Garantir que itens ativos usem `bg-sidebar-accent` + `text-sidebar-accent-foreground`, evitando branco sobre branco em temas claros como Dashboard Pastel e Signature.
   - Ajustar o rodapé/usuário da Sidebar para usar tokens de sidebar adequados em temas claros e escuros.

3. **Correção de ícones e elementos internos**
   - Revisar ícones que herdam `text-white`/`primary-foreground` dentro de cartões claros.
   - Manter ícones brancos somente dentro de botões/cards realmente coloridos.

4. **Seções com cabeçalho sólido**
   - Conferir os cabeçalhos `section-header-*` para manter contraste correto em todos os temas.
   - Em especial, evitar que `secondary-foreground`, `warning-foreground` ou `accent-foreground` fiquem claros em fundos também claros.

5. **Validação**
   - Rodar `tsc --noEmit` após as mudanças.
   - Fazer a correção de forma escopada por CSS/tokens, sem alterar paleta do Dashboard Pastel e sem influenciar outros temas indevidamente.

## Arquivos a ajustar

- `src/index.css`
- Possivelmente `src/styles/brand-themes.css`, apenas se algum token `*-foreground` estiver incompatível com o fundo do próprio tema.
- Possivelmente `src/components/layout/Sidebar.tsx`, somente se algum estado visual estiver forçando classes conflitantes.
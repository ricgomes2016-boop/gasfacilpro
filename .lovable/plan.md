# Corrigir fontes brancas ilegíveis no menu do entregador

## Problema
Em `src/components/entregador/EntregadorLayout.tsx`, o `SheetContent` lateral usa `gradient-dark` como fundo e os itens do menu/textos usam `text-white`, `text-white/80`, `text-white/70` e `border-white/10`.

No tema atual (gasfacil), os tokens `--sidebar-gradient-from/to` que alimentam `--gradient-dark` resolvem para um gradiente claro (lavanda/branco). Resultado: cabeçalho "App Entregador" e botão "Jornada" ativo aparecem, mas todos os demais itens (Início, Entregas, Nova Venda, Produtividade, Qtd Vendida, Financeiro, Contas a Prazo, Devoluções/Trocas, Treinamento, Sair) ficam quase invisíveis — texto branco sobre fundo branco.

## Solução
Trocar as cores hardcoded por tokens semânticos do design system, que garantem contraste tanto em fundo claro quanto escuro:

1. **Fundo do drawer**: substituir `gradient-dark` por `bg-sidebar` (token oficial do shadcn sidebar) para que o fundo acompanhe corretamente o tema do entregador.
2. **Cabeçalho** (App Entregador / Revenda de Gás / Versão):
   - `text-white` → `text-sidebar-foreground`
   - `text-white/70` → `text-sidebar-foreground/70`
   - `border-white/10` → `border-sidebar-border`
3. **Itens de navegação**:
   - Inativo: `text-white/80 hover:bg-white/10` → `text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground`
   - Ativo: manter `gradient-primary text-primary-foreground shadow-glow` (já legível, como visto no item "Jornada").
4. **Rodapé / botão Sair**:
   - `border-white/10` → `border-sidebar-border`
   - `text-white/80 hover:bg-red-500/20 hover:text-red-300` → `text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive`
5. Ajustar o `BuildVersionBadge` (tone `on-primary`) se necessário — verificar se sob `bg-sidebar` ele continua legível; senão, trocar para tone padrão.

## Escopo
- Apenas `src/components/entregador/EntregadorLayout.tsx`.
- Nenhuma alteração em rotas, providers, App.tsx, lógica de negócio ou tokens globais.
- Bottom nav e header superior ficam como estão (não estão com o problema).

## Validação
- Abrir `/entregador` no preview mobile (384px), abrir o menu lateral e confirmar que todos os itens estão legíveis.
- Conferir o item ativo (destaque roxo) continua com bom contraste.
- Verificar rapidamente em outro tema de marca (gasmais) se o fundo do sidebar continua coerente.

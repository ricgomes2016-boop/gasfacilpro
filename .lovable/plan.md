## Plano

1. **Corrigir o backend apontado pelo app publicado**
   - O app publicado está consultando um backend antigo (`gcrd...`), enquanto as correções recentes foram aplicadas no backend atual do projeto.
   - Ajustar a configuração de build para não usar fallback hardcoded antigo de URL/chave/projeto.

2. **Corrigir o erro de coluna em `unidades`**
   - Garantir via migração que as colunas usadas pelo painel existam no backend publicado: `bairros_atendidos`, `horario_abertura`, `horario_fechamento`, `gas_do_povo_habilitado`, `gas_do_povo_valor`.
   - Reaplicar permissões de Data API para `profiles` e `unidades`, sem abrir leitura pública anônima.

3. **Evitar tela branca quando o perfil ainda não existir**
   - Trocar a busca de perfil em `AuthContext` de retorno obrigatório para retorno opcional.
   - Se não houver linha em `profiles`, manter o app carregado com dados básicos do usuário autenticado em vez de quebrar o fluxo.

4. **Publicar novamente após aprovação**
   - Depois das correções, republicar o app para substituir a versão publicada com erro.

## Detalhes técnicos

- Arquivos prováveis: `vite.config.ts` e `src/contexts/AuthContext.tsx`.
- Migração SQL apenas para schema/permissões necessárias, sem alterar regras de negócio.
- Não refatorar rotas, `App.tsx` ou provider nesting, seguindo a regra de estabilidade do projeto.
# Conectar Instagram e Facebook da Forte Gás

## Situação atual

- A Forte Gás tem hoje apenas uma conta de Instagram cadastrada **manualmente** ("Forte gas") — ela não publica nada, é só um rótulo. Não existe nenhuma conexão oficial (OAuth) da empresa.
- Todo o mecanismo oficial já existe no sistema (botão "Conectar Instagram + Facebook", troca de token com a Meta, publicação de posts, renovação automática de token, painel admin).
- **Porém a tela "Redes Sociais" não está acessível**: a página existe no código mas não tem rota nem item de menu. Hoje não há por onde clicar para conectar.
- O app Meta está marcado como **"Modo Desenvolvimento"**: enquanto não for aprovado pela Meta, só perfis do Facebook adicionados como *testadores* conseguem concluir a conexão.

## O que vou fazer no sistema

1. **Publicar a tela Redes Sociais**: criar a rota `/marketing/redes-sociais` (perfis admin/gestor) e adicionar o item "Redes Sociais" no menu de Marketing, para que o botão de conexão fique acessível.
2. **Ajuste fino da tela** para o padrão premium atual (cabeçalho, cards, responsivo no celular) e deixar em destaque o botão "Conectar Instagram + Facebook", separando visualmente contas oficiais (OAuth) das cadastradas manualmente.
3. **Mensagens de erro mais claras** no retorno da Meta: quando o perfil não for testador ou faltar permissão, mostrar exatamente o que fazer (com o Facebook ID do usuário para enviar ao suporte).
4. **Substituição da conta manual**: após a conexão oficial, a entrada manual "Forte gas" passa a aparecer como duplicada — vou marcá-la para remoção/arquivamento assim que a conta OAuth entrar.

## O que depende de você (fora do sistema)

Como você não tem acesso ao painel Meta for Developers, peça a quem administra o app do GásFácilPro:

1. Adicionar o Facebook do responsável da Forte Gás como **Testador** (App → Roles → Testers) — e a pessoa precisa **aceitar o convite** em facebook.com/settings → Desenvolvedor.
2. Confirmar que esta URL está na lista de redirecionamentos OAuth válidos do app:
   `https://<projeto>.supabase.co/functions/v1/meta-oauth-callback`
3. Confirmar que os domínios `gasfacilpro.com.br` e `gasfacilpro.lovable.app` estão nos domínios do app.

Depois disso, o fluxo é: entrar no ERP da Forte Gás → Marketing → Redes Sociais → "Conectar Instagram + Facebook" → autorizar no popup → escolher a Página e o Instagram → pronto, agendamento e publicação passam a funcionar.

Alternativa, se quiser liberar para **qualquer cliente** sem depender de testador: submeter o app ao App Review da Meta (checklist já existe em `docs/meta-app-review.md`). Posso preparar os materiais se você quiser seguir por aí.

## Detalhes técnicos

- Nova entrada em `src/routes/marketingRoutes.ts` apontando para `src/pages/marketing/RedesSociais.tsx`; item de menu na navegação de Marketing.
- Refino visual de `RedesSociais.tsx` e `ConectarRedesModal.tsx` usando os componentes compartilhados atuais.
- Mensagens do callback em `supabase/functions/meta-oauth-callback/index.ts` (somente texto/UX de erro; o fluxo OAuth em si não muda).
- Nenhuma alteração em `App.tsx`, providers ou estrutura de rotas existente.

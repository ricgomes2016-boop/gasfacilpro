Plano para corrigir o portal do parceiro:

1. Ajustar `src/pages/auth/AuthParceiro.tsx` para redirecionar imediatamente para `/parceiro` assim que o login retorna sucesso, sem depender apenas do `useEffect` esperar os papéis carregarem.
2. Manter a validação de perfil `parceiro`: se o usuário logado não tiver esse papel, continuar fazendo logout e exibindo o aviso correto.
3. Testar no domínio publicado `https://portal.gasfacilpro.com.br/auth` com `amigao2@gmail.com` / `123456`, verificando se sai de `/auth` e cai em `/parceiro`.

Detalhe técnico: o código local já aponta para `/parceiro`, mas no teste real a sessão autentica e os dados carregam com 200 OK sem troca de rota. Vou tornar o redirecionamento parte explícita do submit do login do parceiro para eliminar essa dependência assíncrona.
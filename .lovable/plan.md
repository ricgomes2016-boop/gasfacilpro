## Causa

O cadastro do cliente usa **telefone + senha**, mas internamente cria um e-mail sintético (`43999692765@phone.gasfacilpro.app`) no Supabase Auth. O backend está com **confirmação de e-mail obrigatória**, então o usuário é criado mas fica com `email_confirmed_at = null` — por isso o login retorna "Confirme seu cadastro antes de fazer login" e parece que precisa cadastrar de novo.

Confirmado no banco: o usuário `43999692765@phone.gasfacilpro.app` existe, mas sem confirmação.

## Plano

1. **Ativar auto-confirmação de e-mail** no Auth (`auto_confirm_email: true`).
   - Justificativa: o e-mail é sintético, gerado a partir do telefone — não existe caixa de entrada para confirmar. Sem isso, **nenhum cliente** consegue logar pelo app após o cadastro.
   - Mantém HIBP ligado e cadastros abertos como já estão.

2. **Backfill dos clientes já cadastrados sem confirmação**: marcar `email_confirmed_at = now()` para todos os usuários cujo e-mail termina em `@phone.gasfacilpro.app` e ainda estão sem confirmação. Isso libera o login do Ricardo Gomes (e qualquer outro afetado) sem precisar recadastrar.

3. **Após o cadastro bem-sucedido em `AuthCliente.tsx`**, garantir o redirecionamento automático para a área do cliente. Hoje, quando o `signUp` retorna sem erro, o usuário fica parado na tela de cadastro — vou adicionar um efeito que, ao detectar sessão ativa logo após o signup, navega para a rota inicial do app do cliente preservando o `?u=<slug>`.

## Fora do escopo

- Não mexer em `App.tsx`, providers ou rotas.
- Não alterar branding/`get_unidade_by_slug` (já funcionando — a tela mostra "Forte Gás" corretamente).
- Não mudar autenticação dos outros portais (ERP, entregador, contador etc.).

## Detalhes técnicos

- `supabase--configure_auth` com `auto_confirm_email: true`, `password_hibp_enabled: true`, `disable_signup: false`, `external_anonymous_users_enabled: false`.
- Migration: `UPDATE auth.users SET email_confirmed_at = now() WHERE email LIKE '%@phone.gasfacilpro.app' AND email_confirmed_at IS NULL;`
- `src/pages/auth/AuthCliente.tsx`: usar `onAuthStateChange` + `getSession` para detectar `SIGNED_IN` e redirecionar para `/cliente` (ou rota equivalente já usada no fluxo) preservando query params.

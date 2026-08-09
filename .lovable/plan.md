# Corrigir conexão com Instagram e Facebook

## O que está acontecendo

A janela abre, o Facebook recusa o pedido e o navegador volta para o GásFácil sem nunca chegar ao nosso sistema.

Confirmado nos registros: a função que recebe o retorno do Facebook (`meta-oauth-callback`) **não tem nenhum registro de execução**. A função que gera o link (`meta-oauth-start`) executa normalmente. Ou seja: o fluxo morre dentro do Facebook, antes de voltar para nós.

Causas possíveis (as duas precisam ser checadas, nesta ordem):

1. O endereço de retorno usado pelo sistema não está cadastrado na lista de "URIs de redirecionamento OAuth válidos" do app Meta. Nesse caso o Facebook fecha o fluxo imediatamente.
2. O app Meta está em modo desenvolvimento e a conta do Facebook usada não está cadastrada como Testadora.

Além disso, no celular o fluxo atual usa janela pop-up (`window.open`) e comunicação entre janelas. No Android/iOS isso é frequentemente bloqueado ou perde o vínculo com a aba original — mesmo dando certo no Facebook, o retorno pode se perder.

## O que será feito

### 1. Tela de diagnóstico da conexão Meta
Em Marketing → Redes Sociais, um bloco recolhível mostrando:
- O endereço exato de retorno que o sistema usa (com botão copiar), para ser colado nas configurações do app Meta.
- Se as chaves do app Meta estão configuradas no backend.
- Passo a passo curto do que cadastrar no painel Meta.

Isso remove a adivinhação: basta comparar o valor exibido com o que está cadastrado na Meta.

### 2. Fluxo de conexão compatível com celular
- No celular, em vez de pop-up, o sistema navega a própria aba para o Facebook e volta para a página de Redes Sociais ao final.
- No desktop, mantém o pop-up (funciona bem hoje).
- O retorno passa a trazer o resultado na própria URL (sucesso ou erro), então não dependemos mais de mensagem entre janelas.

### 3. Retorno com mensagem de erro clara
A função de retorno passará a redirecionar de volta para a tela de Redes Sociais com o motivo real da recusa (permissão negada, app em desenvolvimento, redirect inválido), exibido em um alerta com a instrução correspondente — em vez de uma página escura isolada que apenas fecha.

### 4. Registro de tentativas
Gravar log no início da geração do link e no retorno, para que, se falhar de novo, seja possível ver exatamente onde parou.

## Detalhes técnicos

- `supabase/functions/meta-oauth-start/index.ts`: incluir `mode` (popup|redirect) no state; logar `redirect_uri` gerado; devolver também `redirect_uri` na resposta para exibição no diagnóstico.
- `supabase/functions/meta-oauth-callback/index.ts`: quando o state trouxer `return_url` e `mode=redirect`, responder `302` para `return_url` com `?meta_oauth=ok|erro&motivo=...`; manter HTML + `postMessage` no modo pop-up; adicionar `console.log`/`console.error` em cada ramo.
- `src/components/marketing/ConectarRedesModal.tsx` e `ConectarRedeSocialButton.tsx`: detectar mobile via `useIsMobile()` e usar `window.location.href` no lugar de `window.open`.
- `src/pages/marketing/RedesSociais.tsx`: ler `meta_oauth`/`motivo` da query string, mostrar toast/alerta e limpar os parâmetros da URL.
- Novo `src/components/marketing/DiagnosticoMetaOAuth.tsx`: bloco de diagnóstico com o redirect URI copiável.

## Depende de você

Depois do ajuste, será necessário no painel Meta for Developers:
- Cadastrar o endereço de retorno exibido no diagnóstico em "URIs de redirecionamento OAuth válidos".
- Se o app estiver em desenvolvimento, adicionar o Facebook do administrador da página como Testador e aceitar o convite.

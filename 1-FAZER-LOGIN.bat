@echo off
color 0B
echo ========================================================
echo           PASSO 1: LOGIN NO SUPABASE CLI
echo ========================================================
echo.
echo Percebi que o erro 403 continua. Isso acontece porque
echo o seu computador ainda nao tem autorizacao para jogar 
echo os arquivos la no seu banco de dados na nuvem.
echo.
echo Para resolver isso, vamos fazer o Login agora:
echo.
echo 1) Vou abrir a pagina de 'Tokens' do Supabase no seu navegador.
echo 2) Clique em "Generate new token" (lado direito em cima).
echo 3) De um nome (ex: Deploy) e clique para gerar.
echo 4) COPIE o codigo secreto gerado.
echo 5) Volte nesta telinha preta, cole o codigo e de ENTER.
echo.
pause
start https://supabase.com/dashboard/account/tokens
echo.
call npx supabase login
echo.
echo ========================================================
echo Se apareceu 'Login success', deu tudo certo!
echo Agora voce pode fechar esta tela e dar dois cliques no 
echo DEPLOY-WEBHOOK.BAT normalmente que vai funcionar!
echo ========================================================
pause

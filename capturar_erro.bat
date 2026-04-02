@echo off
title Analisador de Erro de Migracao Supabase
echo =======================================================
echo     ANALISADOR DE ERRO DA MIGRACAO DO BANCO
echo =======================================================
echo.
echo Para que eu (Antigravity) possa ver qual arquivo SQL
echo travou a nossa migracao, este script vai tentar enviar
echo os dados de novo e salvar a mensagem de erro em um log.
echo.
set /p SUPABASE_DB_PASSWORD="Por favor, digite a senha do Database do NOVO projeto: "
echo.
echo Tentando fazer o push pro banco de dados... aguarde...
call npx supabase db push > log_migracao.txt 2>&1
echo.
echo Processo finalizado! O arquivo 'log_migracao.txt' foi gerado.
echo Volte no nosso chat e me avise para eu ler o arquivo.
echo =======================================================
pause

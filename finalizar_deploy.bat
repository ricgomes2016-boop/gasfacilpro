@echo off
title Implantacao Supabase - GasFacilPro
echo ==============================================================
echo        FINALIZANDO MIGRACAO DO LOVABLE PARA O SUPABASE
echo ==============================================================
echo.
echo Ola! O Agente configurou este passo para voce porque
echo nao conseguiu abrir o terminal por questoes de seguranca do Windows.
echo.
echo Processo 1/2: Autenticando com o seu projeto Supabase...
echo ATENCAO: Neste momento o sistema vai pedir sua Senha do BD (Database Password)
echo          Digite a senha e aperte ENTER. (Parecera invisivel enquanto digita)
echo.
call npx supabase link --project-ref gcrdftnnbgsogoqcmcxo
echo.

echo Processo 2/2: Enviando funcoes Meta WhatsApp e BIA (Edge Functions)...
call npx supabase functions deploy
echo.

echo ==============================================================
echo                      PROCESSO CONCLUIDO!
echo ==============================================================
echo Se nao houver mensagens vermelhas de erro acima, o sistema esta pronto!
pause

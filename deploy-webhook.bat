@echo off
echo ========================================================
echo   Fazendo deploy da funcao meta-webhook no Supabase...
echo ========================================================
cd /d "C:\Users\Ricardo\gasfacilpro"
call npx supabase functions deploy meta-webhook --project-ref scqenurznkatvrqxqjmt --no-verify-jwt
echo ========================================================
echo   Deploy finalizado! (Aguarde alguns segundos)
echo ========================================================
pause

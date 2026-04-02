@echo off
echo ==============================================
echo Salvando suas modificacoes locais no Git...
echo ==============================================
git add .
git commit -m "salvando funcoes supabase"

echo ==============================================
echo Sincronizando com o Lovable (nuvem)...
echo ==============================================
git pull origin main --no-edit

echo ==============================================
echo Pronto! Atualizacao concluida.
echo ==============================================
pause

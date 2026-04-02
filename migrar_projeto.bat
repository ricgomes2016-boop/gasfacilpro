@echo off
title Migracao Supabase - GasFacilPro
echo ==============================================================
echo        MIGRACAO DE BANCO DE DADOS (LOVABLE -^> SUPABASE)
echo ==============================================================
echo.
echo Este script vai:
echo 1. Fazer o Login na sua conta do Supabase.
echo 2. Conectar (Link) ao seu NOVO projeto 'gasfacilpro'.
echo 3. Criar a mesma estrutura (177 tabelas/regras) no novo banco.
echo 4. Fazer o deploy de todas as +50 Edge Functions (BIA, etc).
echo.
echo ATENCAO: Tenha em maos a SENHA DO BANCO DE DADOS (Database Password)
echo          do seu NOVO projeto no Supabase, pois ele vai pedir.
echo.
set /p NOVO_REF_ID="Qual e o Project ID do seu NOVO projeto gasfacilpro? (ex: xyzxyzxyzabcd): "
echo.

echo [ Passo 1 ] Autenticando com o Supabase...
call npx supabase login
echo.

echo [ Passo 2 ] Conectando ao Banco de Dados Novo...
call npx supabase link --project-ref %NOVO_REF_ID%
echo.

echo [ Passo 3 ] Transferindo a Estrutura (Migracoes)...
call npx supabase db push
echo.

echo [ Passo 4 ] Transferindo as Edge Functions da BIA/Automacoes...
call npx supabase functions deploy
echo.

echo ==============================================================
echo                      MIGRACAO CONCLUIDA!
echo ==============================================================
echo PROXIMOS PASSOS OBRIGATORIOS:
echo 1. Va no painel do Lovable -^> Project Settings -^> Integrations.
echo 2. Desconecte o Supabase atual (Managed) e clique em "Connect to Supabase" para plugar esse novo projeto gasfacilpro.
echo 3. Atualize o seu arquivo .env local com o novo ID e as chaves.
echo.
pause

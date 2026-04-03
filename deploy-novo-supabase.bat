@echo off
title Deploy BIA - Novo Projeto Supabase (gcrdftnnbgsogoqcmcxo)
echo ==============================================================
echo   DEPLOY DA BIA NO NOVO PROJETO SUPABASE
echo ==============================================================
echo.
echo Este script vai:
echo 1. Conectar ao projeto gcrdftnnbgsogoqcmcxo
echo 2. Enviar as migracoes (tabelas, RLS, funcoes)
echo 3. Fazer deploy de TODAS as Edge Functions
echo.
echo ATENCAO: Tenha em maos a SENHA DO BANCO DE DADOS do novo projeto.
echo.
pause

echo.
echo [ Passo 1/3 ] Conectando ao projeto Supabase...
call npx supabase link --project-ref gcrdftnnbgsogoqcmcxo
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Falha ao conectar. Verifique o Project ID e tente novamente.
    pause
    exit /b 1
)
echo.

echo [ Passo 2/3 ] Enviando migracoes do banco de dados...
call npx supabase db push
if %ERRORLEVEL% NEQ 0 (
    echo AVISO: Algumas migracoes podem ter falhado. Verifique os erros acima.
)
echo.

echo [ Passo 3/3 ] Deploy das Edge Functions...
echo.

echo   - meta-webhook
call npx supabase functions deploy meta-webhook --no-verify-jwt

echo   - whatsapp-send
call npx supabase functions deploy whatsapp-send --no-verify-jwt

echo   - evolution-webhook
call npx supabase functions deploy evolution-webhook --no-verify-jwt

echo   - evolution-proxy
call npx supabase functions deploy evolution-proxy --no-verify-jwt

echo   - zapi-webhook
call npx supabase functions deploy zapi-webhook --no-verify-jwt

echo   - gateway-webhook
call npx supabase functions deploy gateway-webhook --no-verify-jwt

echo   - uazapi-webhook
call npx supabase functions deploy uazapi-webhook --no-verify-jwt

echo   - bina-webhook
call npx supabase functions deploy bina-webhook --no-verify-jwt

echo   - vapi-webhook
call npx supabase functions deploy vapi-webhook --no-verify-jwt

echo   - daily-briefing
call npx supabase functions deploy daily-briefing --no-verify-jwt

echo   - recompra-alerts
call npx supabase functions deploy recompra-alerts --no-verify-jwt

echo   - recompra-whatsapp-dispatch
call npx supabase functions deploy recompra-whatsapp-dispatch --no-verify-jwt

echo   - marketing-ai
call npx supabase functions deploy marketing-ai --no-verify-jwt

echo   - relatorio-gerencial-ia
call npx supabase functions deploy relatorio-gerencial-ia --no-verify-jwt

echo   - relatorio-diario
call npx supabase functions deploy relatorio-diario --no-verify-jwt

echo   - previsao-demanda
call npx supabase functions deploy previsao-demanda --no-verify-jwt

echo   - whatsapp-gateway-api
call npx supabase functions deploy whatsapp-gateway-api --no-verify-jwt

echo   - pagamento-iniciar
call npx supabase functions deploy pagamento-iniciar --no-verify-jwt

echo   - pagamento-confirmar
call npx supabase functions deploy pagamento-confirmar --no-verify-jwt

echo   - consulta-cnpj
call npx supabase functions deploy consulta-cnpj --no-verify-jwt

echo   - parse-fuel-photo
call npx supabase functions deploy parse-fuel-photo --no-verify-jwt

echo   - parse-products-import
call npx supabase functions deploy parse-products-import --no-verify-jwt

echo   - parse-receivables-import
call npx supabase functions deploy parse-receivables-import --no-verify-jwt

echo   - parse-orders-history
call npx supabase functions deploy parse-orders-history --no-verify-jwt

echo   - goto-webhook
call npx supabase functions deploy goto-webhook --no-verify-jwt

echo.
echo ==============================================================
echo                    DEPLOY CONCLUIDO!
echo ==============================================================
echo.
echo PROXIMOS PASSOS OBRIGATORIOS:
echo.
echo 1. No painel do Supabase (Settings - Edge Functions - Secrets),
echo    configure os seguintes secrets:
echo.
echo    SUPABASE_URL = https://gcrdftnnbgsogoqcmcxo.supabase.co
echo    SUPABASE_SERVICE_ROLE_KEY = (copie de Settings - API)
echo    SUPABASE_ANON_KEY = (copie de Settings - API)
echo    META_WHATSAPP_TOKEN = (token do Meta Business Manager)
echo    LOVABLE_API_KEY = (sua chave de IA - OpenAI ou Google)
echo    EVOLUTION_BASE_URL = (URL da Evolution API, se usar)
echo    EVOLUTION_GLOBAL_APIKEY = (chave da Evolution, se usar)
echo.
echo 2. No Meta Business Manager, atualize o Webhook URL para:
echo    https://gcrdftnnbgsogoqcmcxo.supabase.co/functions/v1/meta-webhook
echo    Verify Token: gasfacil_meta_verify
echo.
echo 3. Inscreva o campo "messages" no webhook da Meta.
echo.
pause

@echo off
REM Agente fiscal local - roda no PC do escritorio e fala com a SEFAZ usando o certificado A1.
REM Requisitos: Node.js 20 ou superior instalado.
setlocal
cd /d "%~dp0"

set BRIDGE_MODE=local
set PORT=8787
set SEFAZ_TP_AMB=1
set AGENTE_CONFIG=%~dp0agente.json

if not exist "%AGENTE_CONFIG%" (
  echo [ERRO] Arquivo agente.json nao encontrado.
  echo Copie agente.exemplo.json para agente.json e preencha os dados da unidade.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm ci --omit=dev || call npm install --omit=dev
)

if not exist "dist\index.js" (
  echo Compilando o agente...
  call npm install
  call npm run build
)

echo.
echo Agente fiscal local ouvindo em http://127.0.0.1:%PORT%
echo Deixe esta janela aberta enquanto usar a tela DF-e Recebidos.
echo.
node dist\index.js
pause

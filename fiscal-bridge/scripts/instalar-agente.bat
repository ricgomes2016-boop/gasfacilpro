@echo off
REM Lancador do instalador do Agente Fiscal Local (Gas Facil Pro).
REM Nao passe senha por parametro: o instalador pergunta de forma segura.
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar.ps1" %*
echo.
pause

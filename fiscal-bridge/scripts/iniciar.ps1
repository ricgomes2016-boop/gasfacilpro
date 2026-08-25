[CmdletBinding()]
param([int]$Porta = 8787)
. (Join-Path $PSScriptRoot 'comum.ps1')
$env:AGENTE_PORTA = "$Porta"

if (-not (Test-Path $Script:ArqConfig)) {
  Write-Erro 'Agente ainda nao instalado. Rode scripts\instalar-agente.bat.'
  exit 1
}
Start-Agente -Porta $Porta | Out-Null
if (Test-Health -Porta $Porta) {
  Write-Ok "Agente ativo em http://127.0.0.1:$Porta"
} else {
  Write-Erro "Agente nao respondeu. Logs em $($Script:PastaLogs)"
  exit 1
}

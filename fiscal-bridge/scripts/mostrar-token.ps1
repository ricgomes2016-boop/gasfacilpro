<#
  Revela o token de pareamento SOMENTE para o usuário logado neste PC.
  O token fica protegido por DPAPI; aqui ele é desprotegido em memória, exibido
  na tela (ou copiado) e não é gravado em nenhum arquivo ou log.
#>
[CmdletBinding()]
param([switch]$Copiar)
. (Join-Path $PSScriptRoot 'comum.ps1')

if (-not (Test-Path $Script:ArqToken)) { Write-Erro 'Token nao encontrado. Rode o instalador.'; exit 1 }
$token = Unprotect-Segredo -Origem $Script:ArqToken

if ($Copiar) {
  Set-Clipboard -Value $token
  Write-Ok 'Token copiado para a area de transferencia (cole no ERP e limpe depois).'
} else {
  Write-Host ''
  Write-Host 'Token de pareamento do agente (nao compartilhe):' -ForegroundColor Yellow
  Write-Host $token
  Write-Host ''
}
$token = $null
[GC]::Collect()

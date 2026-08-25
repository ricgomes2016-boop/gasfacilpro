<#
  Remove a inicialização automática e os segredos do agente.
  NUNCA apaga o arquivo .pfx original do usuário. A cópia local do certificado
  só é removida com -RemoverCopiaCertificado.
#>
[CmdletBinding()]
param([switch]$RemoverCopiaCertificado, [switch]$ManterLogs)
. (Join-Path $PSScriptRoot 'comum.ps1')

Write-Passo 'Parando o agente'
Stop-Agente

Write-Passo 'Removendo a tarefa de logon'
if (Get-ScheduledTask -TaskName $Script:NomeTarefa -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $Script:NomeTarefa -Confirm:$false
  Write-Ok 'Tarefa removida.'
} else { Write-Aviso 'Tarefa nao estava registrada.' }

Write-Passo 'Removendo segredos protegidos'
foreach ($arq in @($Script:ArqSenha, $Script:ArqToken, $Script:ArqConfig, $Script:ArqPid)) {
  if (Test-Path $arq) { Remove-Item $arq -Force; Write-Ok (Split-Path -Leaf $arq) }
}

$copia = Join-Path $Script:PastaAgente 'certificado.pfx'
if ($RemoverCopiaCertificado -and (Test-Path $copia)) {
  Remove-Item $copia -Force
  Write-Ok 'Copia local do certificado removida (o arquivo .pfx original nao foi tocado).'
} elseif (Test-Path $copia) {
  Write-Aviso "Copia local do certificado mantida em $copia (use -RemoverCopiaCertificado para apagar)."
}

if (-not $ManterLogs -and (Test-Path $Script:PastaLogs)) {
  Remove-Item $Script:PastaLogs -Recurse -Force
  Write-Ok 'Logs removidos.'
}

Write-Host ''
Write-Host 'Desinstalacao concluida.' -ForegroundColor Green

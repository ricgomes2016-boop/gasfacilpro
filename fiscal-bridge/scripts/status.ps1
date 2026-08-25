[CmdletBinding()]
param([int]$Porta = 8787)
. (Join-Path $PSScriptRoot 'comum.ps1')

Write-Passo 'Status do Agente Fiscal Local'

Write-Host ("  Configuracao : " + $(if (Test-Path $Script:ArqConfig) { 'presente' } else { 'AUSENTE' }))
Write-Host ("  Senha DPAPI  : " + $(if (Test-Path $Script:ArqSenha) { 'protegida' } else { 'AUSENTE' }))
Write-Host ("  Token DPAPI  : " + $(if (Test-Path $Script:ArqToken) { 'protegido' } else { 'AUSENTE' }))
$tarefa = Get-ScheduledTask -TaskName $Script:NomeTarefa -ErrorAction SilentlyContinue
Write-Host ("  Tarefa logon : " + $(if ($tarefa) { $tarefa.State } else { 'nao registrada' }))

$p = Get-ProcessoAgente
Write-Host ("  Processo     : " + $(if ($p) { "ativo (PID $($p.Id))" } else { 'parado' }))

try {
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Porta/health" -Headers @{ Origin = 'http://localhost:8080' } -UseBasicParsing -TimeoutSec 3
  $h = $r.Content | ConvertFrom-Json
  Write-Ok "Health: modo=$($h.modo) ambiente=$($h.ambiente) cnpj=$($h.cnpj) uf=$($h.uf)"
} catch {
  Write-Aviso "Health nao respondeu na porta $Porta."
}

if (Test-Path $Script:ArqToken) {
  try {
    $token = Unprotect-Segredo -Origem $Script:ArqToken
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Porta/diagnostico" -Method Post `
          -Headers @{ Origin = 'http://localhost:8080'; 'X-Agente-Token' = $token; 'Content-Type' = 'application/json' } `
          -Body '{}' -UseBasicParsing -TimeoutSec 5
    $token = $null
    $d = $r.Content | ConvertFrom-Json
    Write-Ok "Diagnostico: certificado=$($d.certificado) titular=$($d.titular) validade=$($d.validade)"
  } catch {
    Write-Aviso 'Diagnostico autenticado indisponivel (agente parado ou token desatualizado).'
  }
}

Write-Host ("  Logs         : " + $Script:PastaLogs)

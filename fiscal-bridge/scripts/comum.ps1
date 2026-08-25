# Funções compartilhadas pelos scripts do Agente Fiscal Local (Windows).
# Nada aqui imprime senha, token, PFX, XML ou CNPJ completo.

$ErrorActionPreference = 'Stop'

$Script:NomeTarefa = 'GasFacil - Agente Fiscal Local'
$Script:PastaAgente = Join-Path $env:LOCALAPPDATA 'GasFacil\AgenteFiscal'
$Script:PastaLogs   = Join-Path $Script:PastaAgente 'logs'
$Script:ArqConfig   = Join-Path $Script:PastaAgente 'agente.json'
$Script:ArqSenha    = Join-Path $Script:PastaAgente 'senha.dpapi'
$Script:ArqToken    = Join-Path $Script:PastaAgente 'token.dpapi'
$Script:ArqPid      = Join-Path $Script:PastaAgente 'agente.pid'
$Script:RaizProjeto = Split-Path -Parent $PSScriptRoot

function Get-PortaAgente {
  if ($env:AGENTE_PORTA) { return [int]$env:AGENTE_PORTA }
  return 8787
}

function Write-Passo([string]$texto) { Write-Host "==> $texto" -ForegroundColor Cyan }
function Write-Ok([string]$texto)    { Write-Host "  OK  $texto" -ForegroundColor Green }
function Write-Aviso([string]$texto) { Write-Host "  !!  $texto" -ForegroundColor Yellow }
function Write-Erro([string]$texto)  { Write-Host "  XX  $texto" -ForegroundColor Red }

# ---------------------------------------------------------------- ACL restrita
function Set-AclSomenteUsuario([string]$caminho) {
  if (-not (Test-Path $caminho)) { return }
  $usuario = "$env:USERDOMAIN\$env:USERNAME"
  # Remove herança e concede apenas ao usuário atual e ao SYSTEM.
  & icacls.exe "$caminho" /inheritance:r | Out-Null
  & icacls.exe "$caminho" /grant:r "${usuario}:(OI)(CI)F" | Out-Null
  & icacls.exe "$caminho" /grant:r "SYSTEM:(OI)(CI)F" | Out-Null
}

function New-PastaPrivada([string]$caminho) {
  if (-not (Test-Path $caminho)) { New-Item -ItemType Directory -Path $caminho -Force | Out-Null }
  Set-AclSomenteUsuario $caminho
}

# ------------------------------------------------------------------- DPAPI
function Protect-Segredo {
  param([Parameter(Mandatory)][System.Security.SecureString]$Segredo,
        [Parameter(Mandatory)][string]$Destino)
  Add-Type -AssemblyName System.Security | Out-Null
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($Segredo)
  try {
    $texto = [Runtime.InteropServices.Marshal]::PtrToStringUni($ptr)
    $bytes = [Text.Encoding]::UTF8.GetBytes($texto)
    $prot  = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, 'CurrentUser')
    [Array]::Clear($bytes, 0, $bytes.Length)
    [IO.File]::WriteAllText($Destino, [Convert]::ToBase64String($prot))
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeGlobalAllocUnicode($ptr)
  }
  Set-AclSomenteUsuario $Destino
}

function Unprotect-Segredo {
  param([Parameter(Mandatory)][string]$Origem)
  Add-Type -AssemblyName System.Security | Out-Null
  $b64  = (Get-Content -Raw -Path $Origem).Trim()
  $prot = [Convert]::FromBase64String($b64)
  $bytes = [Security.Cryptography.ProtectedData]::Unprotect($prot, $null, 'CurrentUser')
  return [Text.Encoding]::UTF8.GetString($bytes)
}

function New-TokenForte {
  $bytes = New-Object 'System.Byte[]' 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

# ------------------------------------------------------------------ Processo
function Get-ProcessoAgente {
  if (-not (Test-Path $Script:ArqPid)) { return $null }
  $id = (Get-Content -Raw $Script:ArqPid).Trim()
  if (-not $id) { return $null }
  return Get-Process -Id ([int]$id) -ErrorAction SilentlyContinue
}

function Test-Health {
  param([int]$Porta = (Get-PortaAgente), [int]$TentativasMax = 20)
  for ($i = 1; $i -le $TentativasMax; $i++) {
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Porta/health" -Headers @{ Origin = 'http://localhost:8080' } `
             -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -eq 200) { return $true }
    } catch { Start-Sleep -Milliseconds 700 }
  }
  return $false
}

function Start-Agente {
  param([int]$Porta = (Get-PortaAgente))
  $existente = Get-ProcessoAgente
  if ($existente) { Write-Ok "Agente já está em execução (PID $($existente.Id))."; return $existente }

  New-PastaPrivada $Script:PastaLogs
  $env:BRIDGE_MODE   = 'local'
  $env:PORT          = "$Porta"
  $env:AGENTE_CONFIG = $Script:ArqConfig
  $env:AGENTE_HOME   = $Script:PastaAgente
  $env:AGENTE_LOG_DIR = $Script:PastaLogs

  $dist = Join-Path $Script:RaizProjeto 'dist\index.js'
  $p = Start-Process -FilePath 'node.exe' -ArgumentList "`"$dist`"" -WorkingDirectory $Script:RaizProjeto `
        -WindowStyle Hidden -PassThru
  Set-Content -Path $Script:ArqPid -Value $p.Id -Encoding ascii
  Set-AclSomenteUsuario $Script:ArqPid
  return $p
}

function Stop-Agente {
  $p = Get-ProcessoAgente
  if (-not $p) { Write-Aviso 'Agente não está em execução.'; return }
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  Remove-Item $Script:ArqPid -ErrorAction SilentlyContinue
  Write-Ok "Agente parado (PID $($p.Id))."
}

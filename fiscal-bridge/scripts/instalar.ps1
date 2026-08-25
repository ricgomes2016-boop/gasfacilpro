<#
.SYNOPSIS
  Instalador idempotente do Agente Fiscal Local (Gás Fácil Pro) para Windows.

.DESCRIPTION
  - verifica Node 20+;
  - instala dependências e compila;
  - obtém o certificado A1 de duas formas:
      (a) automática: seleciona no repositório Cert:\CurrentUser\My pelo CNPJ,
          aceitando apenas certificado vigente e com chave privada, e exporta uma
          cópia operacional .pfx com senha aleatória gerada em memória;
      (b) manual: caminho de um arquivo .pfx e senha digitada (-AsSecureString);
  - valida o certificado/CNPJ antes de concluir;
  - gera token forte e grava senha/token protegidos por DPAPI (CurrentUser);
  - aplica ACL restrita (usuário atual + SYSTEM) na pasta privada;
  - registra Tarefa Agendada oculta no logon do usuário;
  - inicia o agente e aguarda o healthcheck.

  Reexecutar é seguro: reaproveita o que já está correto. Use -Reparar para
  regravar segredos e tarefa. O .pfx de origem nunca é apagado nem movido, e o
  certificado do repositório do Windows permanece instalado.

.PARAMETER Pfx
  Caminho do certificado A1 (.pfx). Força o modo manual.

.PARAMETER DoRepositorio
  Força a seleção automática no repositório do Windows (sem perguntar).
#>
[CmdletBinding()]
param(
  [string]$Pfx,
  [string]$Cnpj,
  [string]$Uf,
  [int]$Porta = 8787,
  [switch]$DoRepositorio,
  [switch]$Reparar,
  [switch]$SemIniciar
)


. (Join-Path $PSScriptRoot 'comum.ps1')
$env:AGENTE_PORTA = "$Porta"

Write-Host ''
Write-Host ' Agente Fiscal Local - Gas Facil Pro ' -ForegroundColor White -BackgroundColor DarkBlue
Write-Host ''

# 1) Node 20+
Write-Passo 'Verificando Node.js 20 ou superior'
try { $versaoNode = (& node.exe -v).Trim() } catch { $versaoNode = $null }
if (-not $versaoNode) { Write-Erro 'Node.js nao encontrado. Instale a versao LTS em https://nodejs.org e rode de novo.'; exit 1 }
$maior = [int]($versaoNode.TrimStart('v').Split('.')[0])
if ($maior -lt 20) { Write-Erro "Node $versaoNode e antigo. Instale o Node 20 ou superior."; exit 1 }
Write-Ok "Node $versaoNode"

# 2) Dependências e build
Write-Passo 'Instalando dependencias e compilando'
Push-Location $Script:RaizProjeto
try {
  if (-not (Test-Path (Join-Path $Script:RaizProjeto 'node_modules')) -or $Reparar) {
    & npm.cmd ci --omit=dev 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { & npm.cmd install 2>&1 | Out-Null }
  }
  & npm.cmd install --no-save typescript 2>&1 | Out-Null
  & npm.cmd run build 2>&1 | Out-Null
  if (-not (Test-Path (Join-Path $Script:RaizProjeto 'dist\index.js'))) { throw 'A compilacao nao gerou dist\index.js.' }
} finally { Pop-Location }
Write-Ok 'Build concluido'

# 3) Pasta privada
Write-Passo 'Preparando pasta privada do usuario'
New-PastaPrivada $Script:PastaAgente
New-PastaPrivada $Script:PastaLogs
Write-Ok $Script:PastaAgente

# 4) Configuração existente (idempotência)
$cfgAtual = $null
if (Test-Path $Script:ArqConfig) {
  try { $cfgAtual = Get-Content -Raw $Script:ArqConfig | ConvertFrom-Json } catch { $cfgAtual = $null }
}

# 5) PFX: copia manual e explicita para a pasta privada
Write-Passo 'Certificado digital A1 (.pfx)'
$destinoPfx = Join-Path $Script:PastaAgente 'certificado.pfx'
$precisaPfx = $Reparar -or -not (Test-Path $destinoPfx)
if ($precisaPfx) {
  if (-not $Pfx) { $Pfx = Read-Host 'Caminho completo do arquivo .pfx (ex.: C:\certificados\empresa.pfx)' }
  $Pfx = $Pfx.Trim('"').Trim()
  if (-not (Test-Path $Pfx)) { Write-Erro "Arquivo nao encontrado: $Pfx"; exit 1 }
  Copy-Item -Path $Pfx -Destination $destinoPfx -Force
  Write-Ok 'Copia local do certificado criada na pasta privada (o arquivo original permanece onde estava).'
} else {
  Write-Ok 'Certificado ja presente na pasta privada.'
}
Set-AclSomenteUsuario $destinoPfx

# 6) CNPJ / UF
if (-not $Cnpj) { $Cnpj = if ($cfgAtual -and -not $Reparar) { $cfgAtual.cnpj } else { Read-Host 'CNPJ da unidade (somente numeros)' } }
$Cnpj = ($Cnpj -replace '\D', '')
if ($Cnpj.Length -ne 14) { Write-Erro 'CNPJ deve ter 14 digitos.'; exit 1 }
if (-not $Uf) { $Uf = if ($cfgAtual -and -not $Reparar) { $cfgAtual.uf } else { Read-Host 'UF da unidade (ex.: PR)' } }
$Uf = $Uf.Trim().ToUpper()
if ($Uf.Length -ne 2) { Write-Erro 'UF deve ter 2 letras.'; exit 1 }

# 7) Senha protegida por DPAPI
Write-Passo 'Senha do certificado (protegida por DPAPI, nunca gravada em texto)'
$precisaSenha = $Reparar -or -not (Test-Path $Script:ArqSenha)
if ($precisaSenha) {
  $senhaSegura = Read-Host 'Senha do certificado A1' -AsSecureString
  Protect-Segredo -Segredo $senhaSegura -Destino $Script:ArqSenha
  Write-Ok 'Senha protegida gravada (DPAPI CurrentUser, ACL restrita).'
} else {
  Write-Ok 'Senha protegida ja existente.'
}

# 8) Validação do PFX + CNPJ antes de concluir
Write-Passo 'Validando certificado e CNPJ'
try {
  Add-Type -AssemblyName System.Security | Out-Null
  $senhaClara = Unprotect-Segredo -Origem $Script:ArqSenha
  $cert = New-Object Security.Cryptography.X509Certificates.X509Certificate2 `
            -ArgumentList $destinoPfx, $senhaClara, 'EphemeralKeySet'
  $senhaClara = $null
  if ($cert.NotAfter -lt (Get-Date)) { Write-Erro "Certificado vencido em $($cert.NotAfter.ToString('dd/MM/yyyy'))."; exit 1 }
  $cnpjCert = ([regex]'(\d{14})').Match($cert.Subject).Value
  if ($cnpjCert -and $cnpjCert -ne $Cnpj) { Write-Erro 'O CNPJ do certificado nao confere com o CNPJ informado.'; exit 1 }
  Write-Ok "Certificado valido ate $($cert.NotAfter.ToString('dd/MM/yyyy')) - CNPJ final ...$($Cnpj.Substring(12))"
} catch {
  Write-Erro "Nao foi possivel abrir o certificado. Verifique a senha e rode com -Reparar. ($($_.Exception.GetType().Name))"
  exit 1
}

# 9) Token forte protegido por DPAPI
Write-Passo 'Token de pareamento'
if ($Reparar -or -not (Test-Path $Script:ArqToken)) {
  $token = New-TokenForte
  $tokenSeguro = ConvertTo-SecureString $token -AsPlainText -Force
  Protect-Segredo -Segredo $tokenSeguro -Destino $Script:ArqToken
  $token = $null; $tokenSeguro = $null
  Write-Ok 'Token forte gerado e protegido (use scripts\mostrar-token.ps1 para copiar).'
} else {
  Write-Ok 'Token existente preservado.'
}

# 10) agente.json (sem nenhum segredo em texto)
Write-Passo 'Gravando configuracao'
$origens = @(
  'https://gasfacilpro.lovable.app',
  'https://gasfacilpro.com.br',
  'https://www.gasfacilpro.com.br',
  'https://app.gasfacilpro.com.br',
  'https://painel.gasfacilpro.com.br',
  'http://localhost:8080'
)
if ($cfgAtual -and $cfgAtual.origens) { $origens = @($cfgAtual.origens) }
[ordered]@{
  pfxPath             = $destinoPfx
  senhaProtegidaPath  = $Script:ArqSenha
  tokenProtegidoPath  = $Script:ArqToken
  cnpj                = $Cnpj
  uf                  = $Uf
  origens             = $origens
} | ConvertTo-Json -Depth 4 | Set-Content -Path $Script:ArqConfig -Encoding UTF8
Set-AclSomenteUsuario $Script:ArqConfig
Write-Ok 'agente.json gravado sem senha e sem token em texto aberto.'

# 11) Tarefa Agendada (logon do usuário, oculta)
Write-Passo 'Inicializacao automatica no logon'
$lancador = Join-Path $PSScriptRoot 'iniciar.ps1'
$acao = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$lancador`" -Porta $Porta"
$gatilho = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$opcoes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -Hidden
Register-ScheduledTask -TaskName $Script:NomeTarefa -Action $acao -Trigger $gatilho -Settings $opcoes -Force | Out-Null
Write-Ok "Tarefa '$($Script:NomeTarefa)' registrada."

# 12) Inicia e confere
if (-not $SemIniciar) {
  Write-Passo 'Iniciando o agente'
  Stop-Agente 2>$null | Out-Null
  Start-Agente -Porta $Porta | Out-Null
  if (Test-Health -Porta $Porta) {
    Write-Ok "Agente respondendo em http://127.0.0.1:$Porta"
  } else {
    Write-Erro "O agente nao respondeu ao healthcheck. Veja os logs em $($Script:PastaLogs)"
    exit 1
  }
}

Write-Host ''
Write-Host 'Instalacao concluida.' -ForegroundColor Green
Write-Host "URL do agente : http://127.0.0.1:$Porta"
Write-Host 'Token         : rode  powershell -File scripts\mostrar-token.ps1'
Write-Host "Logs          : $($Script:PastaLogs)"
Write-Host ''

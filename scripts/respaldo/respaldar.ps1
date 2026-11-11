#Requires -Version 7
<#
.SYNOPSIS
    Respalda la base de producción con pg_dump en una carpeta privada del computador (#56).

.DESCRIPTION
    Uso:
      ./respaldar.ps1 -Configurar     Guarda la External Database URL, cifrada para tu usuario de Windows.
      ./respaldar.ps1                 Hace un respaldo y lo verifica.
      ./respaldar.ps1 -Programar      Crea una tarea diaria de Windows que hace el respaldo.

    Los respaldos contienen datos personales y hashes de contraseñas: no los subas al repositorio
    ni los compartas por chat.
#>
[CmdletBinding()]
param(
    [switch]$Configurar,
    [switch]$Programar,
    [string]$Destino = (Join-Path $HOME 'OrbyteRespaldos'),
    [ValidateRange(1, 365)][int]$Retener = 14,
    [string]$Hora = '20:00'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comun.ps1')

$archivoUrl = Join-Path $HOME '.orbyte\respaldo-url.dpapi'
$nombreTarea = 'Orbyte - respaldo de la base'

if ($Configurar) {
    $segura = Read-Host 'Pega la External Database URL de orbyte-db (no se muestra)' -AsSecureString
    $url = [Net.NetworkCredential]::new('', $segura).Password
    $null = ConvertFrom-UrlPostgres $url
    New-Item -ItemType Directory -Force (Split-Path $archivoUrl) | Out-Null
    $segura | ConvertFrom-SecureString | Set-Content -Path $archivoUrl -Encoding ascii
    Write-Host "URL guardada y cifrada en $archivoUrl"
    return
}

if ($Programar) {
    $accion = New-ScheduledTaskAction -Execute (Get-Process -Id $PID).Path `
        -Argument "-NoProfile -File `"$PSCommandPath`" -Destino `"$Destino`" -Retener $Retener"
    $disparador = New-ScheduledTaskTrigger -Daily -At $Hora
    # Si el computador estaba apagado a esa hora, corre apenas se pueda.
    $ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Register-ScheduledTask -TaskName $nombreTarea -Action $accion -Trigger $disparador -Settings $ajustes -Force | Out-Null
    Write-Host "Tarea '$nombreTarea' creada: todos los días a las $Hora."
    return
}

function Get-UrlRespaldo {
    if ($env:ORBYTE_RESPALDO_URL) { return $env:ORBYTE_RESPALDO_URL }
    if (-not (Test-Path $archivoUrl)) { throw 'Falta la URL. Ejecuta primero: ./respaldar.ps1 -Configurar' }
    $segura = Get-Content $archivoUrl | ConvertTo-SecureString
    return [Net.NetworkCredential]::new('', $segura).Password
}

New-Item -ItemType Directory -Force $Destino | Out-Null
$registro = Join-Path $Destino 'respaldos.log'
function Write-Registro([string]$Mensaje) {
    $linea = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Mensaje"
    Add-Content -Path $registro -Value $linea
    Write-Host $linea
}

$final = Join-Path $Destino "orbyte-$(Get-Date -Format 'yyyyMMdd-HHmmss').dump"
$temporal = "$final.parcial"
try {
    Set-EntornoPg (ConvertFrom-UrlPostgres (Get-UrlRespaldo))

    & (Get-HerramientaPg 'pg_dump') --format=custom --no-owner --no-privileges "--file=$temporal"
    if ($LASTEXITCODE -ne 0) { throw "pg_dump terminó con código $LASTEXITCODE." }

    # Un archivo que pg_restore no pueda leer, o sin los datos de rescates, no cuenta como respaldo.
    $contenido = & (Get-HerramientaPg 'pg_restore') --list $temporal
    if ($LASTEXITCODE -ne 0) { throw 'pg_restore no pudo leer el respaldo.' }
    if (-not ($contenido -match 'TABLE DATA public rescates')) { throw 'El respaldo no contiene la tabla rescates.' }

    Move-Item $temporal $final
    Write-Registro "OK $final ($([math]::Round((Get-Item $final).Length / 1KB)) KB)"

    # Solo después de un respaldo bueno se borran los antiguos.
    Get-ChildItem $Destino -Filter 'orbyte-*.dump' | Sort-Object Name -Descending |
        Select-Object -Skip $Retener | Remove-Item
}
catch {
    Remove-Item $temporal -ErrorAction SilentlyContinue
    Write-Registro "ERROR $($_.Exception.Message)"
    exit 1
}
finally {
    Clear-EntornoPg
}

#Requires -Version 7
<#
.SYNOPSIS
    Restaura un respaldo en una base local vacía para comprobar que sirve (#56).

.DESCRIPTION
    Toma las credenciales de DATABASE_URL en el .env de la raíz y cambia solo el nombre de la base.
    Se niega a restaurar en un servidor que no sea local o en una base que ya tenga tablas.

    Antes hay que crear la base, con un usuario administrador:
      CREATE DATABASE orbyte_restaurada OWNER orbyte_dev;
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Archivo,
    [string]$BaseDatos = 'orbyte_restaurada'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'comun.ps1')

if (-not (Test-Path $Archivo)) { throw "No existe el archivo $Archivo." }

$rutaEnv = Join-Path $PSScriptRoot '..\..\.env'
if (-not (Test-Path $rutaEnv)) { throw 'No existe el .env de la raíz del repositorio.' }
$linea = Get-Content $rutaEnv | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
if (-not $linea) { throw 'El .env no define DATABASE_URL.' }
$conexion = ConvertFrom-UrlPostgres (($linea -split '=', 2)[1].Trim().Trim('"', "'"))
$conexion.BaseDatos = $BaseDatos

if (-not (Test-HostLocal $conexion.Host)) { throw "Solo se restaura en local; el .env apunta a $($conexion.Host)." }

$psql = Get-HerramientaPg 'psql'
function Invoke-Sql([string]$Sql) {
    $salida = & $psql --no-psqlrc --tuples-only --no-align --set=ON_ERROR_STOP=1 --command=$Sql
    if ($LASTEXITCODE -ne 0) { throw "Falló la consulta: $Sql" }
    return $salida
}

try {
    Set-EntornoPg $conexion

    $tablas = [int](Invoke-Sql "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
    if ($tablas -ne 0) { throw "La base $BaseDatos no está vacía ($tablas tablas). Bórrala y créala de nuevo." }

    & (Get-HerramientaPg 'pg_restore') --no-owner --no-privileges --exit-on-error --single-transaction "--dbname=$BaseDatos" $Archivo
    if ($LASTEXITCODE -ne 0) { throw "pg_restore terminó con código $LASTEXITCODE." }

    # --no-privileges no trae los REVOKE de la migración 0004: el historial debe seguir siendo de solo inserción.
    $null = Invoke-Sql 'REVOKE UPDATE, DELETE ON historial_estados FROM PUBLIC'
    $null = Invoke-Sql 'REVOKE UPDATE, DELETE ON historial_estados FROM CURRENT_USER'

    Write-Host "Restaurado en $BaseDatos."
    Write-Host "Migración: $(Invoke-Sql 'SELECT version_num FROM alembic_version')"
    foreach ($tabla in 'usuarios', 'comercios', 'organizaciones_receptoras', 'voluntarios', 'rescates', 'historial_estados') {
        Write-Host ("{0,-28}{1}" -f $tabla, (Invoke-Sql "SELECT count(*) FROM $tabla"))
    }
    $triggers = [int](Invoke-Sql "SELECT count(*) FROM pg_trigger WHERE tgrelid = 'historial_estados'::regclass AND NOT tgisinternal")
    if ($triggers -eq 0) { throw 'El historial quedó sin su trigger de solo inserción.' }
    Write-Host "Triggers del historial: $triggers"
}
finally {
    Clear-EntornoPg
}

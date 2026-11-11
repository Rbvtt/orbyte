# Funciones compartidas por respaldar.ps1 y restaurar.ps1 (#56).

function Get-HerramientaPg([string]$Nombre) {
    $comando = Get-Command $Nombre -ErrorAction SilentlyContinue
    if ($comando) { return $comando.Source }
    $candidatos = Get-ChildItem "$env:ProgramFiles\PostgreSQL\*\bin\$Nombre.exe" -ErrorAction SilentlyContinue |
        Sort-Object { [int]$_.Directory.Parent.Name } -Descending
    if (-not $candidatos) { throw "No se encontró $Nombre. Instala las herramientas cliente de PostgreSQL 18." }
    return @($candidatos)[0].FullName
}

function ConvertFrom-UrlPostgres([string]$Url) {
    $uri = [Uri]$Url
    if ($uri.Scheme -notin 'postgres', 'postgresql') { throw 'La URL debe empezar por postgresql://' }
    $usuario, $clave = $uri.UserInfo -split ':', 2
    [pscustomobject]@{
        Host     = $uri.Host
        Puerto   = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
        Usuario  = [Uri]::UnescapeDataString($usuario)
        Clave    = if ($null -ne $clave) { [Uri]::UnescapeDataString($clave) } else { '' }
        BaseDatos = $uri.AbsolutePath.TrimStart('/')
    }
}

function Test-HostLocal([string]$NombreHost) {
    return $NombreHost -in 'localhost', '127.0.0.1', '::1', '[::1]'
}

# La conexión va por variables de entorno para que la clave no aparezca en la lista de procesos.
function Set-EntornoPg($Conexion) {
    $env:PGHOST = $Conexion.Host
    $env:PGPORT = "$($Conexion.Puerto)"
    $env:PGUSER = $Conexion.Usuario
    $env:PGPASSWORD = $Conexion.Clave
    $env:PGDATABASE = $Conexion.BaseDatos
    $env:PGSSLMODE = if (Test-HostLocal $Conexion.Host) { 'prefer' } else { 'require' }
}

function Clear-EntornoPg {
    'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE' |
        ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }
}

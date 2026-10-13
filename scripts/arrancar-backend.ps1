# Levanta los cinco procesos del backend, cada uno en su propia ventana de PowerShell.
# Se ejecuta desde la raiz del repositorio:  .\scripts\arrancar-backend.ps1

$ErrorActionPreference = "Stop"

$raiz = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $raiz "backend"

if (-not (Test-Path (Join-Path $backend "mvnw.cmd"))) {
    Write-Error "No se encontro backend\mvnw.cmd. Ejecute el script desde el repositorio kandela."
    exit 1
}

# El orden importa: el gateway va al final, cuando los cuatro servicios ya estan arrancando.
$servicios = @(
    @{ Nombre = "usuarios-service"; Puerto = 8081 },
    @{ Nombre = "carta-service";    Puerto = 8082 },
    @{ Nombre = "clientes-service"; Puerto = 8083 },
    @{ Nombre = "salon-service";    Puerto = 8084 },
    @{ Nombre = "api-gateway";      Puerto = 8080 }
)

foreach ($servicio in $servicios) {
    $nombre = $servicio.Nombre
    $titulo = "$nombre :$($servicio.Puerto)"
    $comando = "`$Host.UI.RawUI.WindowTitle = '$titulo'; Set-Location '$backend'; .\mvnw.cmd spring-boot:run -pl $nombre"

    Write-Host "Iniciando $titulo ..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $comando
    Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "Backend en marcha (cada servicio tarda unos segundos en estar listo):"
Write-Host "  Gateway ............ http://localhost:8080"
Write-Host "  Kandela Admin ...... http://localhost:4200"
Write-Host "  Kandela POS y KDS .. http://localhost:5173"
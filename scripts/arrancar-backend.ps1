# Levanta MongoDB y despues los cinco procesos del backend, cada uno en su propia ventana de PowerShell.
# Se ejecuta desde la raiz del repositorio:  .\scripts\arrancar-backend.ps1
#
# Necesita Docker Desktop abierto. Los servicios arrancan con el perfil demo,
# que recarga los datos de demostracion en cada arranque.

$ErrorActionPreference = "Stop"

$raiz = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $raiz "backend"
$compose = Join-Path $raiz "docker-compose.yml"

if (-not (Test-Path (Join-Path $backend "mvnw.cmd"))) {
    Write-Error "No se encontro backend\mvnw.cmd. Ejecute el script desde el repositorio kandela."
    exit 1
}

# MongoDB va primero: los servicios necesitan la base para arrancar.
# --wait no devuelve el control hasta que el healthcheck del contenedor da el
# replica set por listo (nodo primario que acepta escrituras).
# docker escribe su progreso por la salida de errores; con "Stop", PowerShell
# podria tomarlo como un fallo, asi que aqui se decide solo por el codigo de salida.
Write-Host "Levantando MongoDB (replica set rs0 en el puerto 27018) ..."
$ErrorActionPreference = "Continue"
docker compose -f $compose up -d --wait
$codigoDocker = $LASTEXITCODE
$ErrorActionPreference = "Stop"

if ($codigoDocker -ne 0) {
    Write-Error "No se pudo levantar MongoDB. Compruebe que Docker Desktop este abierto y vuelva a intentarlo."
    exit 1
}
Write-Host "MongoDB listo."
Write-Host ""

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
    # El argumento del perfil va entre comillas: sin ellas, PowerShell lo parte por el punto.
    $comando = "`$Host.UI.RawUI.WindowTitle = '$titulo'; Set-Location '$backend'; .\mvnw.cmd spring-boot:run -pl $nombre '-Dspring-boot.run.profiles=demo'"

    Write-Host "Iniciando $titulo ..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $comando
    Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "Backend en marcha (cada servicio tarda unos segundos en estar listo):"
Write-Host "  MongoDB ............ mongodb://localhost:27018/?replicaSet=rs0"
Write-Host "  Gateway ............ http://localhost:8080"
Write-Host "  Kandela Admin ...... http://localhost:4200"
Write-Host "  Kandela POS y KDS .. http://localhost:5173"
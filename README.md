# Kandela

Kandela es un sistema de gestión para restaurantes, con tres módulos sobre un mismo
backend:

- **Kandela Admin**, en Angular: los 7 CRUD de administración.
- **Kandela POS**, en React: el salón del mesero y la caja.
- **Kandela KDS**, en React: la pantalla de cocina.

El restaurante de ejemplo que usa el sistema se llama **Raíz y Sazón**.

## Arquitectura

```
   Escritorio                          Tablet · Caja · Pantalla de cocina
 ┌──────────────────────┐            ┌──────────────────────────────────┐
 │ Kandela Admin        │            │ Kandela POS + KDS                │
 │ frontend/admin       │            │ frontend/operacion               │
 │ Angular · :4200      │            │ React + Vite + TypeScript · :5173│
 └──────────┬───────────┘            └─────────────────┬────────────────┘
            │      las dos importan frontend/compartido│
            │      (estilos · tipos.ts · errores.ts)   │
            └────────────  /api/**  (proxy de desarrollo)┘
                                │
                       api-gateway :8080
        ┌────────────┬──────────┴───┬──────────────┐
  usuarios-service carta-service clientes-service salon-service
       :8081          :8082          :8083          :8084
     usuariosdb      cartadb       clientesdb      salondb      (MongoDB, una base por servicio)
```

La GUI solo habla con el gateway, por `/api/**`. Cada servicio guarda sus datos en su
propia base de MongoDB (ver [MongoDB](#mongodb)).

## Requisitos

| Herramienta | Versión |
|---|---|
| JDK | 21 |
| Node.js | 22 LTS |
| Angular CLI | la actual (`npm install -g @angular/cli`) |
| Docker Desktop | el actual, abierto antes de compilar y de arrancar el backend |

`mvnw clean install` también necesita Docker: las pruebas de integración levantan su
propio MongoDB en un contenedor con Testcontainers.

## Cómo arrancar

```powershell
# 1. Backend: compilar una vez y levantar MongoDB y los 5 procesos
cd backend
.\mvnw.cmd clean install
cd ..
.\scripts\arrancar-backend.ps1        # levanta MongoDB y abre una ventana por servicio
                                      # conserva los datos; con -Demo vuelve a los de ejemplo

# 2. Kandela Admin (Angular) → http://localhost:4200
cd frontend\admin
npm install
npm start

# 3. Kandela POS y KDS (React) → http://localhost:5173
cd frontend\operacion
npm install
npm run dev
```

Usuarios de prueba (contraseña de todos: `kandela123`):

| Rol | Correo | Entra a |
|---|---|---|
| Administradora | `laura.mendez@raizysazon.co` | Kandela Admin |
| Mesero | `carlos.rojas@raizysazon.co` | Kandela POS · Salón |
| Cajera | `diana.rios@raizysazon.co` | Kandela POS · Caja |
| Cocinero | `jorge.castano@raizysazon.co` | Kandela KDS |

## MongoDB

El backend usa una sola instancia de MongoDB 8 en Docker, definida en
`docker-compose.yml`, con una base por servicio: `usuariosdb`, `cartadb`, `clientesdb`
y `salondb`.

- Corre como **replica set de un nodo** (`rs0`), porque las transacciones de varios
  documentos lo exigen.
- Escucha en el **puerto 27018**, no en el 27017, para no confundirse con un MongoDB
  instalado en el equipo.

`scripts\arrancar-backend.ps1` lo levanta solo y espera a que el replica set esté listo
antes de arrancar los servicios. Para manejarlo a mano, desde la raíz del repositorio:

```powershell
docker compose up -d --wait   # lo levanta y espera a que el replica set esté listo
docker compose ps             # debe mostrar kandela-mongodb como (healthy)
docker compose down           # lo detiene; los datos se conservan en el volumen
docker compose down -v        # lo detiene y borra todos los datos
```

### Datos guardados y datos de demostración

El script tiene dos modos y lo dice al empezar:

| Comando | Qué pasa con los datos |
|---|---|
| `.\scripts\arrancar-backend.ps1` | **Se conservan.** Los servicios arrancan sin perfil: los datos de demostración se cargan solo si la colección está vacía (la primera vez) y lo que se cree después sigue ahí al reiniciar. |
| `.\scripts\arrancar-backend.ps1 -Demo` | **Vuelven al estado inicial.** Los servicios arrancan con el perfil `demo`: cada uno vacía sus colecciones, incluida `contadores`, y recarga los datos de demostración, así que los ids vuelven a empezar en 1. Lo creado antes se pierde. |

Sin el script, cada servicio se arranca desde `backend/`:

```powershell
.\mvnw.cmd spring-boot:run -pl carta-service                                     # conserva los datos
.\mvnw.cmd spring-boot:run -pl carta-service '-Dspring-boot.run.profiles=demo'   # vuelve a los de ejemplo
```

`docker compose down -v` también deja todo como la primera vez, pero borra el volumen
completo de MongoDB, con las bases de todos los servicios.

### Conectarse con MongoDB Compass

Con el contenedor en marcha, crea una conexión nueva con esta cadena:

```
mongodb://localhost:27018/?replicaSet=rs0
```

Se ven las bases de los servicios y, dentro de cada una, sus colecciones, incluida
`contadores`, que guarda el último id numérico entregado por colección.

## Swagger

Cada servicio publica su propia documentación de la API con Swagger UI
(`springdoc-openapi`, versión fijada en `backend/pom.xml`). Con el servicio en marcha,
se abre en el navegador:

| Servicio | Swagger UI | Descripción OpenAPI (JSON) |
|---|---|---|
| usuarios-service | http://localhost:8081/swagger-ui.html | http://localhost:8081/v3/api-docs |
| carta-service | http://localhost:8082/swagger-ui.html | http://localhost:8082/v3/api-docs |
| clientes-service | http://localhost:8083/swagger-ui.html | http://localhost:8083/v3/api-docs |
| salon-service | http://localhost:8084/swagger-ui.html | http://localhost:8084/v3/api-docs |

Se entra por el puerto de cada servicio, no por el gateway (8080). Cada endpoint
muestra su ruta, su método, sus parámetros, el cuerpo que recibe y los códigos que
puede devolver (por ejemplo 400, 404 o 409) con un ejemplo del error. Con **Try it
out** se envía la petición de verdad: lo que se cree o se borre ahí queda guardado en
MongoDB.

## Origen del backend

`backend/` viene del proyecto de la materia **Web APIs y Microservicios**
(`restaurante-microservicios`) y se importó con `git subtree`, conservando su historial
completo. Sus autores originales son **Yaiza Sánchez, Camilo Murcia, Daniel Guzmán y
Rosa Peña**.

## Equipo

Rosa Peña, Sebastián Gallego y Daniel Guzmán. Proyecto del segundo corte de Diseño de
Soluciones.

## Limitaciones conocidas

- El inicio de sesión no usa token; los endpoints del backend quedan abiertos.
- No hay actualización en tiempo real por WebSocket; Cocina y Caja consultan cada 5 s.

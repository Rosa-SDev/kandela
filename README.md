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

Los servicios arrancan con el perfil `demo`: cada uno vacía sus colecciones, incluida
`contadores`, y recarga los datos de demostración, así que los ids vuelven a empezar
en 1. Sin ese perfil, los datos de demostración se cargan solo si la colección está
vacía, y después se conservan entre arranques.

### Conectarse con MongoDB Compass

Con el contenedor en marcha, crea una conexión nueva con esta cadena:

```
mongodb://localhost:27018/?replicaSet=rs0
```

Se ven las bases de los servicios y, dentro de cada una, sus colecciones, incluida
`contadores`, que guarda el último id numérico entregado por colección.

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

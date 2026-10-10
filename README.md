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
     usuariosdb      cartadb       clientesdb      salondb      (H2 en memoria, una por servicio)
```

La GUI solo habla con el gateway, por `/api/**`. Las bases son H2 en memoria: se
reinician en cada arranque con los datos de demostración.

## Requisitos

| Herramienta | Versión |
|---|---|
| JDK | 21 |
| Node.js | 22 LTS |
| Angular CLI | la actual (`npm install -g @angular/cli`) |

## Cómo arrancar

```powershell
# 1. Backend: compilar una vez y levantar los 5 procesos
cd backend
.\mvnw.cmd clean install
cd ..
.\scripts\arrancar-backend.ps1        # abre una ventana por servicio

# 2. Kandela Admin (Angular) → http://localhost:4200
cd frontend\admin
npm install
npm start

# 3. Kandela POS y KDS (React) → http://localhost:5173
cd frontend\operacion
npm install
npm run dev
```

El script de arranque y Kandela Admin llegan en la F1; mientras tanto, cada servicio se
levanta con `.\mvnw.cmd spring-boot:run` desde su carpeta.

Usuarios de prueba (contraseña de todos: `kandela123`):

| Rol | Correo | Entra a |
|---|---|---|
| Administradora | `laura.mendez@raizysazon.co` | Kandela Admin |
| Mesero | `carlos.rojas@raizysazon.co` | Kandela POS · Salón |
| Cajera | `diana.rios@raizysazon.co` | Kandela POS · Caja |
| Cocinero | `jorge.castano@raizysazon.co` | Kandela KDS |

Hasta que se termine la tarea de datos de demostración, los usuarios disponibles son los
que traía el backend de Web APIs (`administrador@restaurante.com` / `admin123`, etc.).

## Origen del backend

`backend/` viene del proyecto de la materia **Web APIs y Microservicios**
(`restaurante-microservicios`) y se importó con `git subtree`, conservando su historial
completo. Sus autores originales son **Yaiza Sánchez, Camilo Murcia, Daniel Guzmán y
Rosa Peña**.

## Equipo

Rosa Peña, Sebastián Gallego y Daniel Guzmán. Proyecto del segundo corte de Diseño de
Soluciones.

## Limitaciones conocidas

- El inicio de sesión no usa token; los endpoints del backend quedan abiertos (D7).
- Las bases son H2 en memoria: se reinician al arrancar con los datos de demostración.
- No hay actualización en tiempo real por WebSocket; Cocina y Caja consultan cada 5 s.

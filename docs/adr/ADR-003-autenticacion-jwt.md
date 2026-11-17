# ADR-003: Autenticación con JWT y autorización por rol en el gateway

**Estado:** Propuesto
**Fecha:** 9-nov-2026
**Deciden:** Rosa, Sebastián, Daniel

## Contexto

- El inicio de sesión devuelve el usuario sin ningún token. Los frontends guardan ese usuario en `sessionStorage` y protegen sus rutas por rol, pero **todos los endpoints del backend están abiertos**: cualquier cliente HTTP puede crear, modificar o borrar datos.
- Las contraseñas se guardan con SHA-256 sin sal.
- El proyecto debe proteger sus endpoints e implementar login y acceso por roles con Spring Security y JWT.
- El proyecto de la materia Web APIs y Microservicios (`restaurante-microservicios`), del que viene este backend, ya resolvió el problema:
  - `usuarios-service` emite un JWT HS256;
  - las contraseñas se guardan con BCrypt;
  - el gateway valida el token como servidor de recursos OAuth 2.0 y aplica una matriz de permisos.

  Se reutiliza esa implementación y se adapta a los roles de Kandela.
- Kandela tiene reglas por rol más finas que las de ese proyecto. Por ejemplo, solo el administrador anula facturas y el mesero no registra clientes.

## Decisión

1. **El gateway es el único punto de control.** Valida la firma y el vencimiento del token y aplica la matriz de permisos antes de reenviar la petición. Los servicios de negocio no validan tokens.
2. **`usuarios-service` emite el token** al iniciar sesión:
   - firmado con HS256;
   - dura 3600 s;
   - claims: `sub` = correo, `uid`, `rol`, `iss` = `usuarios-service`.

   La clave se comparte entre usuarios y gateway mediante la propiedad `seguridad.jwt.secreto`. En desarrollo tiene un valor local; fuera de desarrollo sale de una variable de entorno.
3. **Respuesta del login:** `{ token, tipo: "Bearer", expiraEn, usuario }`.
4. **Contraseñas con BCrypt.** `usuarios-service` usa solo `spring-security-crypto` y `spring-security-oauth2-jose`, sin cadena de filtros propia.
5. **Errores con el formato común:**
   - 401 → `{"error": "Debe iniciar sesión con un token válido."}`;
   - 403 → `{"error": "No tiene permisos para realizar esta operación."}`.
6. **Frontends:**
   - cada aplicación guarda el token junto con el usuario en `sessionStorage`;
   - lo envía en `Authorization: Bearer <token>` desde su único módulo de API;
   - ante un 401 fuera del login, cierra la sesión y vuelve a la pantalla de inicio.

   La traducción de errores muestra el mensaje del servidor para 401 y 403.
7. **Las llamadas entre servicios siguen directas y sin token.** No pasan por el gateway.

### Matriz de permisos

El administrador tiene acceso a todo. Las celdas indican qué roles, además del administrador, pueden hacer cada operación.

| Recurso | Consultar (GET) | Crear (POST) | Modificar (PUT/PATCH) | Eliminar (DELETE) |
|---|---|---|---|---|
| `POST /api/auth/login` | — | **Público** | — | — |
| `/api/usuarios/**` | Mesero, Cajero | — | — | — |
| `/api/platillos/**` | Todos | — | `PUT`: Cocinero (disponibilidad) · `PATCH descuento`: solo admin | — |
| `/api/clientes/**` | Mesero | — | — | — |
| `/api/reservas/**` | Mesero | Mesero | Mesero (estado) | — |
| `/api/mesas/**` | Todos | — | — | — |
| `/api/pedidos/**` | Todos | Mesero (pedido y platillos) | Mesero (nota y estado), Cocinero (estado) | Mesero (quitar platillo) |
| `/api/facturas/**` | Cajero | Cajero | — | — (anular: solo admin) |

Cualquier otra ruta exige un token válido. Las reglas se escriben de la más específica a la más general, porque en Spring Security gana la primera que coincide.

## Opciones consideradas

### Opción A: validar en el gateway (elegida)

| Dimensión | Evaluación |
|---|---|
| Complejidad | Baja: una configuración, reutilizada del proyecto de Web APIs |
| Cambios en los servicios | Solo en usuarios (emisión y BCrypt) |
| Llamadas entre servicios | Sin cambios |
| Seguridad | Depende de que solo el gateway esté expuesto |

### Opción B: cada servicio valida el token

| Dimensión | Evaluación |
|---|---|
| Complejidad | Alta: cuatro configuraciones y propagación del token en las llamadas entre servicios |
| Seguridad | Defensa en profundidad |
| Riesgo para el plazo | Alto |

### Opción C: sesiones con estado en el gateway

Descartada: rompe el diseño sin estado de una API REST y no es lo que pide el curso.

## Análisis de compromisos

- La opción A concentra la decisión de acceso en un solo lugar y deja los servicios sin cambios. El costo es que un servicio llamado directamente en su puerto no exige token. En desarrollo local esos puertos son accesibles; en un despliegue solo se publicaría el gateway. **Se declara como limitación conocida.**
- El gateway autoriza por rol y ruta, no por el valor del cuerpo. No puede impedir, por ejemplo, que un cocinero envíe `CANCELADO` al cambiar el estado de un pedido. Esa regla fina quedaría en salon-service si se decide más adelante.
- HS256 con clave compartida es más simple que firmar con RSA, pero obliga a que usuarios y gateway conozcan la misma clave.

## Consecuencias

- **Se facilita:**
  - la seguridad se demuestra en Postman con los casos 200, 401 y 403;
  - la limitación «endpoints abiertos» deja de existir para quien entra por el gateway.
- **Se complica:**
  - los dos frontends y la colección de Postman deben enviar el token;
  - el inicio de sesión cambia de forma de respuesta.
- **Orden obligatorio:** la validación del gateway se activa en `develop` **solo cuando los dos frontends ya envían el token**. Antes de eso, la aplicación dejaría de funcionar.
- **Por revisar:** reglas por estado del pedido, RSA o un proveedor de identidad si el proyecto crece.

## Acciones

1. [ ] usuarios-service: BCrypt, emisión del token y nueva respuesta del login, con pruebas.
2. [ ] Gateway: Spring Security como servidor de recursos, matriz de permisos y respuestas 401/403, con pruebas.
3. [ ] Tipos compartidos y traducción de errores: respuesta del login y casos 401/403.
4. [ ] Kandela POS/KDS (React) y Kandela Admin (Angular): token en el módulo de API y cierre de sesión ante un 401.
5. [ ] Colección de Postman: login que guarda el token y casos 200/401/403.
6. [ ] README: cómo autenticarse y matriz de permisos.

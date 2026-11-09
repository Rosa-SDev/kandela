# ADR-002: Persistencia en MongoDB para los cuatro servicios

**Estado:** Propuesto
**Fecha:** 9-nov-2026
**Deciden:** Rosa, Sebastián, Daniel

## Contexto

- Los cuatro servicios de negocio (usuarios, carta, clientes, salon) persisten con Spring Data JPA sobre H2 en memoria, una base por servicio.
- El proyecto debe pasar a una base de datos no relacional, MongoDB, y persistir toda su información en ella.
- La arquitectura ya tiene rasgos que favorecen a MongoDB:
  - cada servicio es dueño de sus datos;
  - entre servicios solo viajan ids;
  - la línea del pedido guarda una copia congelada del nombre y el precio del platillo.
- El contrato de la API (rutas, cuerpos e ids numéricos) lo consumen dos frontends, la colección de Postman y las llamadas entre servicios. No debe cambiar.
- Tres operaciones de salon escriben en varios documentos: abrir pedido (pedido + mesa), cancelar (pedido + mesa) y emitir factura (factura + pedido + mesa).
- Restricciones:
  - el avance debe estar listo el 19 de noviembre;
  - los tres integrantes tienen Docker;
  - uno de los equipos es un Mac en el que la instalación nativa de MongoDB dio problemas.

## Decisión

1. **Los cuatro servicios migran a MongoDB** con `spring-boot-starter-data-mongodb`. Se retiran JPA y H2.
2. **Una instancia de MongoDB 8 en Docker, con una base por servicio:** `usuariosdb`, `cartadb`, `clientesdb` y `salondb`.
   - Corre como **replica set de un nodo** (`rs0`), escuchando en el **puerto 27018** dentro y fuera del contenedor.
   - Cada servicio se conecta con `spring.mongodb.uri=mongodb://localhost:27018/<base>?replicaSet=rs0`.
3. **Los ids siguen siendo `Long`.**
   - Cada servicio los obtiene de su propia colección `contadores` con una operación atómica: `findAndModify` con `$inc` y `upsert`.
   - El id se asigna **explícitamente en el servicio**, en el único método que crea cada entidad. Los datos de demostración también crean a través de ese método.
   - El mismo mecanismo numera las facturas.
4. **Modelado de documentos:**

| Servicio | Colección | Relación | Forma | Razón |
|---|---|---|---|---|
| usuarios | `usuarios` | Herencia Usuario → Administrador, Mesero, Cocinero, Cajero | Una colección polimórfica con `@TypeAlias` | Se conserva la jerarquía; el tipo queda en `_class` |
| carta | `platillos` | — | Documento simple | Sin relaciones |
| clientes | `clientes`, `reservas` | Cliente 1:N Reserva | Referencia (`clienteId`) | Las reservas crecen sin límite y se consultan solas |
| salon | `pedidos` | Pedido 1:N LineaPedido | **Embebido** | La línea nace y muere con el pedido y siempre se lee junto con él |
| salon | `mesas` | Mesa 1:N Pedido | Referencia (`mesaId`) | La mesa tiene ciclo de vida y CRUD propios |
| salon | `facturas` | Pedido 1:N Factura | Referencia (`pedidoId`) | Un pedido puede tener una factura anulada y otra vigente |
| salon ↔ carta | — | Pedido N:M Platillo | Línea embebida con `platilloId` y copia de nombre y precio | Un cambio de carta no altera pedidos ya tomados |
| entre servicios | — | Pedido → mesero, Reserva → mesa… | Id suelto | Las bases están separadas: no puede haber referencia real |

5. **Transacciones:** salon registra un `MongoTransactionManager`. Las operaciones de varios documentos se marcan con `@Transactional` y **guardan explícitamente cada documento que modifican**.
6. **Dinero:** `spring.data.mongodb.representation.big-decimal=decimal128` en cada servicio. Los `BigDecimal` se guardan como `NumberDecimal`.
7. **Índices únicos:** se declaran con `@Indexed(unique = true)` y se activa su creación al arrancar con `spring.data.mongodb.auto-index-creation=true`.
   - Aplican a correo, documento, número de mesa, número de factura y nombre de platillo.
   - Si la regla no distingue mayúsculas (por ejemplo, el nombre del platillo), el índice lleva collation `{ locale: 'es', strength: 2 }`: ignora mayúsculas y respeta tildes.
   - El servicio conserva su comprobación previa, que da el mensaje claro. El índice garantiza la regla ante peticiones simultáneas, y un `DuplicateKeyException` se responde como 409.
8. **Datos de demostración:**
   - el perfil `demo` **vacía las colecciones** del servicio, incluida `contadores`, y recarga los datos al arrancar. No borra la base, porque eso eliminaría también los índices creados al iniciar;
   - sin el perfil, los datos se cargan solo si la colección está vacía, y después persisten entre arranques.
9. **Pruebas:**
   - unitarias de servicios con JUnit y Mockito, sin base de datos;
   - de integración con Testcontainers (`MongoDBContainer` + `@ServiceConnection`).

## Opciones consideradas

### Ids: `Long` con contador (elegida) frente a ObjectId

| Dimensión | `Long` + contador | ObjectId (`String`) |
|---|---|---|
| Impacto en el contrato | Ninguno | Cambian todos los ids de la API |
| Impacto en frontends y Postman | Ninguno | Tipos, rutas, conversiones y colección completa |
| Llamadas entre servicios | Sin cambios | Las tres cambian de tipo |
| Costo de implementación | Una clase por servicio | Bajo en el backend, alto en el resto del producto |
| Idiomático en MongoDB | Patrón documentado, menos habitual | Lo habitual |

**Razón:** el id es un identificador sustituto del contrato público. La base de datos es un detalle interno detrás de él. Cambiar a ObjectId convertiría una migración de persistencia en una migración de todo el producto, sin ganar nada funcional.

### Dónde corre MongoDB

| Dimensión | Docker, replica set (elegida) | Instalación local | Atlas |
|---|---|---|---|
| Igual en Windows y Mac | Sí | No (problemas en Mac) | Sí |
| Transacciones multidocumento | Sí | Solo si se configura como replica set a mano | Sí |
| Depende de internet en la demo | No | No | Sí |
| Pruebas con Testcontainers | Mismo motor | Distinto entorno | Distinto entorno |

**Razón del puerto 27018:** los integrantes ya tienen MongoDB instalado en el 27017. Si el contenedor usara el mismo puerto, un servicio podría conectarse en silencio al MongoDB local, que no es replica set, y las transacciones fallarían sin un error claro.

El miembro del replica set se anuncia como `localhost:27018`. Así, el driver que corre fuera del contenedor encuentra el mismo nodo que el contenedor declara.

### Línea del pedido: embebida (elegida) frente a colección propia

Una colección `lineas` obligaría a consultar dos colecciones para mostrar cada comanda. Eso exige `$lookup` o varias consultas. Además, no aporta nada: ninguna pantalla consulta líneas sin su pedido. El documento del pedido queda acotado, porque una mesa no pide cientos de platillos.

## Análisis de compromisos

- **Embeber gana en lectura y atomicidad.** El pedido completo se lee y se escribe en una sola operación. **Referenciar gana cuando la entidad tiene vida propia o crece sin límite.** Por eso mesa, factura y reserva van referenciadas.
- MongoDB no guarda automáticamente los objetos modificados al cerrar una transacción, como sí hacía Hibernate. Todo cambio debe terminar en `save()`. Es el riesgo principal de la migración.
- Una sola instancia con cuatro bases es un compromiso de entorno de desarrollo. El aislamiento es lógico (cada servicio solo conoce su base), no físico.

## Consecuencias

- **Se facilita:**
  - los frontends, el gateway, los DTO, los controladores y la colección de Postman no cambian;
  - los datos sobreviven a un reinicio;
  - el mismo entorno corre en los tres equipos.
- **Se complica:**
  - hay que levantar Docker antes del backend;
  - las pruebas de integración necesitan Docker, así que `mvnw clean install` exige Docker encendido;
  - cada servicio mantiene su generador de ids.
- **Por revisar:**
  - si el profesor pide ObjectId, se evalúa como cambio de contrato aparte;
  - en un despliegue real, cada servicio tendría su propia instancia.

## Acciones

1. [ ] `docker-compose.yml` con MongoDB como replica set y script de arranque que lo levante primero.
2. [ ] carta-service migrado como referencia: conexión, contador, `Decimal128`, índices, perfil `demo` y pruebas.
3. [ ] usuarios-service y clientes-service migrados.
4. [ ] salon-service migrado, con transacciones y contador de facturas.
5. [ ] Evidencia en MongoDB Compass de cada colección, incluida la línea embebida del pedido.
6. [ ] README: cómo levantar MongoDB y conectarse con Compass.

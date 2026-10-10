# ADR-001: Cómo conviven los frontends de Angular y React en Kandela

**Estado:** Aceptado
**Fecha:** 9-oct-2026
**Deciden:** Rosa, Sebastián, Daniel

## Contexto

- El profesor de Diseño de Soluciones exige evidenciar dos tecnologías de frontend (para el tercer corte). El equipo decidió adelantarlas al segundo corte: **Angular para Administración** y **React para Salón, Caja y Cocina**. Esa asignación no está en discusión.
- El backend ya existe: `api-gateway` (:8080) + usuarios, carta, clientes y salon (Spring Boot 4.1.1, Java 21, una base H2 por servicio). La GUI solo habla con el gateway.
- El diseño ya está resuelto en el prototipo V2.1: toda la apariencia vive en CSS (tokens en `:root`, densidades y superficies por atributo), y los componentes son funciones sin lógica de rol.
- Los cuatro roles usan dispositivos distintos: administración en escritorio, mesero en tablet o móvil, caja en un puesto fijo, cocina en una pantalla de pared. Nadie usa dos roles en el mismo dispositivo al mismo tiempo.
- Equipo de 3, nadie conoce Angular. Avance el 13-oct y entrega final el 20-oct, con la misma rúbrica.

Lo que queda por decidir es **cómo se integran las dos tecnologías en un mismo producto**.

## Opciones consideradas

### Opción A: dos aplicaciones independientes con un paquete compartido

```
frontend/
  compartido/      estilos (capas 1-3 en CSS) + tipos de la API y traducción de errores (TypeScript sin framework)
  admin/           Angular  → /login, /usuarios, /clientes, /mesas, /pedidos, /reservas, /carta, /facturas
  operacion/       React    → /login, /salon, /caja, /cocina
Cada una con su propio servidor de desarrollo y su proxy hacia el gateway :8080.
```

| Dimensión | Evaluación |
|---|---|
| Complejidad técnica | Baja: dos proyectos estándar (Angular CLI y Vite) |
| Separación de responsabilidades | Alta: un límite por contexto de uso (gestión y operación), que coincide con el de los dispositivos |
| Reutilización | Estilos, tipos y mensajes de error: 100 % compartidos. Estructura de los componentes: se escribe una vez por framework |
| Integración con microservicios | Igual en las dos: gateway, mismo contrato, misma traducción de errores |
| Pruebas | Cada aplicación con sus herramientas estándar; el código compartido se prueba una sola vez |
| Git y trabajo en equipo | Carpetas sin solapamiento; los PR de una aplicación no rompen la otra |
| Requisito académico | Las dos tecnologías se ven por separado y se pueden explicar sin ambigüedad |

**Ventajas:** cada aplicación se construye, prueba y despliega sola; si una se cae, la otra sigue funcionando. Usa las herramientas oficiales sin configuración especial. Agregar un rol es agregar una ruta o una aplicación.
**Desventajas:** dos inicios de sesión (con el mismo diseño y el mismo endpoint). La estructura de los componentes se escribe dos veces.

### Opción B: una aplicación compuesta (micro-frontends con una aplicación contenedora)

Una aplicación contenedora en Angular carga en tiempo de ejecución las pantallas de React (Module Federation o single-spa), con un solo inicio de sesión y una sola sesión.

| Dimensión | Evaluación |
|---|---|
| Complejidad técnica | Alta: dos frameworks en la misma página, configuración de federación, versiones compartidas, compilación especial |
| Separación de responsabilidades | Aparente: los equipos se separan, pero la página mezcla dos ciclos de vida |
| Reutilización | La misma que en A; el contenedor no ahorra componentes |
| Integración con microservicios | Igual que A |
| Pruebas | Más difíciles: los fallos de integración aparecen solo en tiempo de ejecución, dentro del contenedor |
| Git y trabajo en equipo | El contenedor se vuelve un punto donde todos dependen de todos |
| Requisito académico | Cumple, pero cuesta más explicar qué tecnología hace cada cosa |

**Ventajas:** una sola URL y un solo inicio de sesión.
**Desventajas:** acopla en ejecución dos frameworks que no necesitan convivir. Sus beneficios reales (varios equipos grandes entregando partes de la misma pantalla) no aplican aquí. Requiere configuración que ningún integrante ha usado.

## Análisis

- **El límite del sistema ya existe en el dominio.** Administración y operación son contextos distintos, con usuarios, dispositivos, densidad y ritmo de cambio diferentes (V2.1 ya los diseñó así). La opción A pone el límite técnico justo ahí; la opción B lo borra.
- **La consistencia la garantiza el CSS, no el contenedor.** El prototipo ya demostró que una misma hoja de estilos sostiene las cuatro interfaces sin volverlas genéricas. Si las dos aplicaciones importan el mismo `compartido/estilos`, se ven igual sin necesidad de un contenedor.
- **El único costo real de la opción A es el doble inicio de sesión,** y no afecta a ningún usuario: cada dispositivo abre una sola aplicación.
- **Calidad a largo plazo:** con A cada aplicación se mantiene, se prueba y puede reemplazarse sola. Con B, una actualización de Angular o de React puede romper la otra.
- La curva de aprendizaje no fue el criterio, pero refuerza el resultado: B suma a Angular desde cero una tecnología de integración más.

## Decisión

**Opción A: dos aplicaciones independientes en un mismo repositorio, con un paquete `compartido` que es la única fuente de verdad de los estilos, los tipos de la API y los mensajes de error.**

Reglas que la acompañan:

1. Ninguna aplicación define colores, tamaños ni tipografías propios: solo usa las clases y variables de `compartido/estilos`.
2. Ninguna pantalla llama al gateway directamente: cada aplicación tiene un único servicio o módulo de API que usa los tipos y la traducción de errores de `compartido/api`.
3. Las dos aplicaciones usan TypeScript (Angular lo exige; React se configura igual) para compartir los tipos.
4. Las dos aplicaciones hablan solo con el gateway, a través del proxy de su servidor de desarrollo (sin CORS en desarrollo).

## Consecuencias

- **Se facilita:** trabajar en paralelo sin pisarse, probar cada aplicación por separado, explicar la arquitectura en la sustentación, agregar o cambiar un frontend en el tercer corte.
- **Se complica:** mantener sincronizada la estructura de los componentes en dos frameworks. Para controlarlo, los nombres de componentes y clases son idénticos en las dos aplicaciones (`Boton`, `f-btn`…).
- **Hay que revisar:** que Angular CLI y Vite importen sin problemas los archivos de `compartido` (es lo primero que se prueba en F1). Si se necesita un solo inicio de sesión, se puede agregar después un token compartido sin cambiar esta decisión.

## Acciones

1. [ ] Crear `frontend/compartido` con las capas 1-3 del prototipo en CSS, `tipos.ts` y `errores.ts`.
2. [ ] Crear `frontend/admin` (Angular) y `frontend/operacion` (React + TypeScript), cada uno con su proxy hacia `:8080`.
3. [ ] Comprobar en las dos aplicaciones que importan `compartido` antes de empezar pantallas.
4. [ ] Guardar este ADR en `docs/adr/` del repositorio.

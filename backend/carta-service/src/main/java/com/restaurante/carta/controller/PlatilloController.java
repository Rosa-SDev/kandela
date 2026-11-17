package com.restaurante.carta.controller;

import com.restaurante.carta.dto.CrearPlatilloDTO;
import com.restaurante.carta.dto.DescuentoDTO;
import com.restaurante.carta.dto.PlatilloDTO;
import com.restaurante.carta.model.Platillo;
import com.restaurante.carta.service.PlatilloService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * La puerta HTTP de la carta.
 *
 * Solo traduce: lee el JSON, llama al servicio, convierte el resultado a DTO y
 * fija el codigo de respuesta. Ninguna regla de negocio vive aqui.
 *
 * Las anotaciones de io.swagger describen la API en Swagger UI
 * (http://localhost:8082/swagger-ui.html). No cambian lo que hace cada metodo:
 * @Tag agrupa los endpoints, @Operation resume cada uno y @ApiResponse lista
 * los codigos que puede devolver. Los cuerpos de entrada y salida no se
 * describen aqui: springdoc los lee de los DTO, incluidas sus validaciones.
 */
@RestController
@RequestMapping("/api/platillos")
@Tag(name = "Platillos", description = "La carta del restaurante: crear, consultar, modificar y retirar platillos")
public class PlatilloController {

    // Ejemplos del cuerpo que devuelve ManejadorDeErrores en cada caso.
    private static final String EJEMPLO_400 = """
            {"error": "La petición tiene campos inválidos",
             "campos": {"precio": "El precio debe ser mayor que cero"}}""";
    private static final String EJEMPLO_404 = """
            {"error": "El platillo 99 no existe."}""";
    private static final String EJEMPLO_409 = """
            {"error": "Ya existe un platillo con el nombre Bandeja paisa."}""";

    private final PlatilloService servicio;

    public PlatilloController(PlatilloService servicio) {
        this.servicio = servicio;
    }

    /** 201 con el platillo creado. */
    @PostMapping
    @Operation(summary = "Crear un platillo",
               description = "El id lo asigna el servicio. El nombre no se puede repetir, sin importar mayúsculas.")
    @ApiResponse(responseCode = "201", description = "Platillo creado",
                 content = @Content(mediaType = "application/json", schema = @Schema(implementation = PlatilloDTO.class)))
    @ApiResponse(responseCode = "400", description = "Faltan campos, el precio no es positivo o el JSON está mal formado",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_400)))
    @ApiResponse(responseCode = "409", description = "Ya existe un platillo con ese nombre",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_409)))
    public ResponseEntity<PlatilloDTO> crear(@Valid @RequestBody CrearPlatilloDTO datos) {
        Platillo creado = servicio.crear(datos.aEntidad());
        return ResponseEntity.status(HttpStatus.CREATED).body(PlatilloDTO.de(creado));
    }

    /** 200 con la lista. Los dos filtros son opcionales. */
    @GetMapping
    @Operation(summary = "Listar los platillos",
               description = "Sin filtros devuelve toda la carta. Los dos filtros se pueden combinar.")
    @ApiResponse(responseCode = "200", description = "La lista, vacía si ningún platillo cumple los filtros")
    public List<PlatilloDTO> listar(
            @Parameter(description = "Solo los de esta categoría", example = "Fuertes")
            @RequestParam(required = false) String categoria,
            @Parameter(description = "Solo los disponibles (true) o los agotados (false)")
            @RequestParam(required = false) Boolean disponible) {
        return servicio.listar(categoria, disponible).stream()
                .map(PlatilloDTO::de)
                .toList();
    }

    /** 200, o 404 si no existe. */
    @GetMapping("/{id}")
    @Operation(summary = "Consultar un platillo")
    @ApiResponse(responseCode = "200", description = "El platillo")
    @ApiResponse(responseCode = "404", description = "No existe un platillo con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    public PlatilloDTO buscar(@Parameter(description = "Id del platillo", example = "1")
                              @PathVariable Long id) {
        return PlatilloDTO.de(servicio.buscarPorId(id));
    }

    /** 200 con el platillo ya actualizado. */
    @PutMapping("/{id}")
    @Operation(summary = "Modificar un platillo",
               description = "Reemplaza todos los datos del platillo. El id no cambia.")
    @ApiResponse(responseCode = "200", description = "El platillo con los datos nuevos")
    @ApiResponse(responseCode = "400", description = "Faltan campos, el precio no es positivo o el JSON está mal formado",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_400)))
    @ApiResponse(responseCode = "404", description = "No existe un platillo con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    @ApiResponse(responseCode = "409", description = "El nombre nuevo ya lo usa otro platillo",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_409)))
    public PlatilloDTO actualizar(@Parameter(description = "Id del platillo", example = "1")
                                  @PathVariable Long id,
                                  @Valid @RequestBody CrearPlatilloDTO datos) {
        return PlatilloDTO.de(servicio.actualizar(id, datos.aEntidad()));
    }

    /** 204: salio bien, no hay nada que devolver. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Eliminar un platillo",
               description = "Lo borra de la carta y de MongoDB.")
    @ApiResponse(responseCode = "204", description = "Platillo eliminado")
    @ApiResponse(responseCode = "404", description = "No existe un platillo con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    public void eliminar(@Parameter(description = "Id del platillo", example = "1")
                         @PathVariable Long id) {
        servicio.eliminar(id);
    }

    /** 200 con el platillo ya rebajado, para no obligar a otro GET. */
    @PatchMapping("/{id}/descuento")
    @Operation(summary = "Aplicar un descuento",
               description = "Rebaja el precio en el porcentaje indicado, mayor que 0 y hasta 100.")
    @ApiResponse(responseCode = "200", description = "El platillo con el precio rebajado")
    @ApiResponse(responseCode = "400", description = "Falta el porcentaje o está fuera de rango",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "La petición tiene campos inválidos",
                          "campos": {"porcentaje": "El porcentaje no puede ser mayor que cien"}}""")))
    @ApiResponse(responseCode = "404", description = "No existe un platillo con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    public PlatilloDTO aplicarDescuento(@Parameter(description = "Id del platillo", example = "1")
                                        @PathVariable Long id,
                                        @Valid @RequestBody DescuentoDTO datos) {
        return PlatilloDTO.de(servicio.aplicarDescuento(id, datos.porcentaje()));
    }
}

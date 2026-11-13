package com.restaurante.salon.controller;

import com.restaurante.salon.dto.CrearMesaDTO;
import com.restaurante.salon.dto.MesaDTO;
import com.restaurante.salon.model.EstadoMesa;
import com.restaurante.salon.model.Mesa;
import com.restaurante.salon.service.MesaService;

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
 * Controlador REST para la gestión de mesas.
 *
 * Las anotaciones de OpenAPI describen los endpoints en Swagger UI
 * (http://localhost:8084/swagger-ui.html).
 */
@RestController
@RequestMapping("/api/mesas")
@Tag(name = "Mesas", description = "Gestión de mesas físicas del restaurante: alta, consulta, edición y retiro")
public class MesaController {

    private static final String EJEMPLO_400 = """
            {"error": "La petición tiene campos inválidos",
             "campos": {"numero": "El número de la mesa debe ser mayor que cero"}}""";
    private static final String EJEMPLO_404 = """
            {"error": "La mesa 99 no existe."}""";
    private static final String EJEMPLO_409_DUPLICADA = """
            {"error": "Ya existe una mesa con el número 3."}""";
    private static final String EJEMPLO_409_OCUPADA = """
            {"error": "No se puede eliminar la mesa 1 porque está ocupada."}""";

    private final MesaService servicio;

    public MesaController(MesaService servicio) {
        this.servicio = servicio;
    }

    /** 201 con la mesa creada. */
    @PostMapping
    @Operation(summary = "Crear una mesa",
               description = "El id lo asigna el servicio. El número de mesa no se puede repetir.")
    @ApiResponse(responseCode = "201", description = "Mesa creada",
                 content = @Content(mediaType = "application/json", schema = @Schema(implementation = MesaDTO.class)))
    @ApiResponse(responseCode = "400", description = "Faltan campos, algún valor no es positivo o el JSON está mal formado",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_400)))
    @ApiResponse(responseCode = "409", description = "Ya existe una mesa con ese número",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_409_DUPLICADA)))
    public ResponseEntity<MesaDTO> crear(@Valid @RequestBody CrearMesaDTO datos) {
        Mesa creada = servicio.crear(datos.aEntidad());
        return ResponseEntity.status(HttpStatus.CREATED).body(MesaDTO.de(creada));
    }

    /** 200 con el listado de mesas, con filtro opcional por estado. */
    @GetMapping
    @Operation(summary = "Listar las mesas",
               description = "Sin filtro devuelve todas las mesas; se puede filtrar por estado.")
    @ApiResponse(responseCode = "200", description = "Lista de mesas, vacía si ninguna cumple el filtro")
    public List<MesaDTO> listar(
            @Parameter(description = "Solo las mesas en este estado", example = "LIBRE")
            @RequestParam(required = false) EstadoMesa estado) {
        return servicio.listar(estado).stream()
                .map(MesaDTO::de)
                .toList();
    }

    /** 200 con la mesa encontrada, o 404 si no existe. */
    @GetMapping("/{id}")
    @Operation(summary = "Consultar una mesa")
    @ApiResponse(responseCode = "200", description = "La mesa solicitada")
    @ApiResponse(responseCode = "404", description = "No existe una mesa con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    public MesaDTO buscar(@Parameter(description = "Id de la mesa", example = "1")
                          @PathVariable Long id) {
        return MesaDTO.de(servicio.buscarPorId(id));
    }

    /** 200 con la mesa actualizada. */
    @PutMapping("/{id}")
    @Operation(summary = "Actualizar una mesa",
               description = "Reemplaza el número, la capacidad y opcionalmente el estado de la mesa.")
    @ApiResponse(responseCode = "200", description = "La mesa con los datos actualizados")
    @ApiResponse(responseCode = "400", description = "Faltan campos, algún valor no es positivo o el JSON está mal formado",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_400)))
    @ApiResponse(responseCode = "404", description = "No existe una mesa con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    @ApiResponse(responseCode = "409", description = "El número nuevo ya lo usa otra mesa",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_409_DUPLICADA)))
    public MesaDTO actualizar(@Parameter(description = "Id de la mesa", example = "1")
                              @PathVariable Long id,
                              @Valid @RequestBody CrearMesaDTO datos) {
        return MesaDTO.de(servicio.actualizar(id, datos.aEntidad()));
    }

    /** 204 si la eliminación fue exitosa. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Eliminar una mesa",
               description = "Borra la mesa si no está ocupada por un pedido en curso.")
    @ApiResponse(responseCode = "204", description = "Mesa eliminada")
    @ApiResponse(responseCode = "404", description = "No existe una mesa con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    @ApiResponse(responseCode = "409", description = "La mesa está ocupada y no se puede eliminar",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_409_OCUPADA)))
    public void eliminar(@Parameter(description = "Id de la mesa", example = "1")
                         @PathVariable Long id) {
        servicio.eliminar(id);
    }
}

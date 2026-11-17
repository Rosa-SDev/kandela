package com.restaurante.clientes.controller;

import java.util.List;

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

import com.restaurante.clientes.dto.ClienteDTO;
import com.restaurante.clientes.dto.CrearClienteDTO;
import com.restaurante.clientes.service.ClienteService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

/**
 * La puerta HTTP de los clientes.
 *
 * Las anotaciones de io.swagger describen la API en Swagger UI
 * (http://localhost:8083/swagger-ui.html). No cambian lo que hace cada método:
 * @Tag agrupa los endpoints, @Operation resume cada uno y @ApiResponse lista
 * los códigos que puede devolver. Los cuerpos los lee springdoc de los DTO.
 */
@RestController
@RequestMapping("/api/clientes")
@Tag(name = "Clientes", description = "Los clientes del restaurante: crear, consultar, modificar y eliminar")
public class ClienteController {

    // Ejemplos del cuerpo que devuelve ManejadorDeErrores en cada caso.
    private static final String EJEMPLO_400 = """
            {"error": "La petición tiene campos inválidos",
             "campos": {"documento": "El documento es obligatorio"}}""";
    private static final String EJEMPLO_404 = """
            {"error": "No existe un cliente con id 99."}""";

    private final ClienteService clienteService;

    public ClienteController(ClienteService clienteService) {
        this.clienteService = clienteService;
    }

    @PostMapping
    @Operation(summary = "Crear un cliente",
               description = "El id lo asigna el servicio. El documento no se puede repetir.")
    @ApiResponse(responseCode = "201", description = "Cliente creado",
                 content = @Content(mediaType = "application/json", schema = @Schema(implementation = ClienteDTO.class)))
    @ApiResponse(responseCode = "400", description = "Falta el nombre o el documento, o el JSON está mal formado",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_400)))
    @ApiResponse(responseCode = "409", description = "Ya existe un cliente con ese documento",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "Ya existe un cliente con el documento 1001234567."}""")))
    public ResponseEntity<ClienteDTO> crear(@Valid @RequestBody CrearClienteDTO dto) {
        ClienteDTO creado = clienteService.crear(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(creado);
    }

    @GetMapping
    @Operation(summary = "Listar los clientes",
               description = "Sin filtro devuelve todos. Con nombre, los que lo contienen, sin importar mayúsculas.")
    @ApiResponse(responseCode = "200", description = "La lista, vacía si ningún cliente coincide")
    public List<ClienteDTO> listar(@Parameter(description = "Parte del nombre a buscar", example = "ana")
                                   @RequestParam(required = false) String nombre) {
        return clienteService.listar(nombre);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consultar un cliente")
    @ApiResponse(responseCode = "200", description = "El cliente")
    @ApiResponse(responseCode = "404", description = "No existe un cliente con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    public ClienteDTO buscar(@Parameter(description = "Id del cliente", example = "1")
                             @PathVariable Long id) {
        return clienteService.buscarPorId(id);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Modificar un cliente",
               description = "Reemplaza nombre, documento y teléfono. El cambio se ve en todas sus reservas.")
    @ApiResponse(responseCode = "200", description = "El cliente con los datos nuevos")
    @ApiResponse(responseCode = "400", description = "Falta el nombre o el documento, o el JSON está mal formado",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_400)))
    @ApiResponse(responseCode = "404", description = "No existe un cliente con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    @ApiResponse(responseCode = "409", description = "El documento nuevo ya lo tiene otro cliente",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "Ya existe otro cliente con el documento 1007654321."}""")))
    public ClienteDTO actualizar(@Parameter(description = "Id del cliente", example = "1")
                                 @PathVariable Long id,
                                 @Valid @RequestBody CrearClienteDTO dto) {
        return clienteService.actualizar(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Eliminar un cliente",
               description = "Solo se puede si no tiene reservas. Lo borra de MongoDB.")
    @ApiResponse(responseCode = "204", description = "Cliente eliminado")
    @ApiResponse(responseCode = "404", description = "No existe un cliente con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    @ApiResponse(responseCode = "409", description = "El cliente tiene reservas asociadas",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "No se puede eliminar el cliente Ana Torres porque tiene reservas asociadas."}""")))
    public void eliminar(@Parameter(description = "Id del cliente", example = "1")
                         @PathVariable Long id) {
        clienteService.eliminar(id);
    }
}

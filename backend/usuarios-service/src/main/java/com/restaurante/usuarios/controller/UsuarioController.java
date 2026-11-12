package com.restaurante.usuarios.controller;

import com.restaurante.usuarios.dto.ActualizarUsuarioDTO;
import com.restaurante.usuarios.dto.CrearUsuarioDTO;
import com.restaurante.usuarios.dto.UsuarioDTO;
import com.restaurante.usuarios.model.Rol;
import com.restaurante.usuarios.service.UsuarioService;

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
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * La puerta HTTP de los usuarios.
 *
 * Las anotaciones de io.swagger describen la API en Swagger UI
 * (http://localhost:8081/swagger-ui.html). No cambian lo que hace cada metodo:
 * @Tag agrupa los endpoints, @Operation resume cada uno y @ApiResponse lista
 * los codigos que puede devolver. Los cuerpos de entrada y salida los lee
 * springdoc de los DTO, incluidas sus validaciones.
 */
@RestController
@RequestMapping("/api/usuarios")
@Tag(name = "Usuarios", description = "Las personas que usan Kandela: crear, consultar, modificar y eliminar usuarios")
public class UsuarioController {

    // Ejemplos del cuerpo que devuelve ManejadorDeErrores en cada caso.
    private static final String EJEMPLO_400 = """
            {"error": "El correo no tiene un formato válido"}""";
    private static final String EJEMPLO_404 = """
            {"error": "El usuario 99 no existe."}""";
    private static final String EJEMPLO_409 = """
            {"error": "Ya existe un usuario con ese correo."}""";

    private final UsuarioService servicio;

    public UsuarioController(UsuarioService servicio) {
        this.servicio = servicio;
    }

    @PostMapping
    @Operation(summary = "Crear un usuario",
               description = "El id lo asigna el servicio. El rol decide el tipo de usuario y no se puede cambiar después. "
                       + "El correo no se puede repetir, sin importar mayúsculas.")
    @ApiResponse(responseCode = "201", description = "Usuario creado",
                 content = @Content(mediaType = "application/json", schema = @Schema(implementation = UsuarioDTO.class)))
    @ApiResponse(responseCode = "400", description = "Faltan campos, el correo no es válido, la contraseña tiene menos de 6 caracteres o el JSON está mal formado",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_400)))
    @ApiResponse(responseCode = "409", description = "Ya existe un usuario con ese correo",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_409)))
    public ResponseEntity<UsuarioDTO> crear(@Valid @RequestBody CrearUsuarioDTO dto) {
        UsuarioDTO creado = servicio.crear(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(creado);
    }

    @GetMapping
    @Operation(summary = "Listar los usuarios",
               description = "Sin filtro devuelve todos los usuarios.")
    @ApiResponse(responseCode = "200", description = "La lista, vacía si ningún usuario tiene ese rol")
    public List<UsuarioDTO> listar(@Parameter(description = "Solo los de este rol", example = "MESERO")
                                   @RequestParam(required = false) Rol rol) {
        return servicio.listar(rol);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consultar un usuario")
    @ApiResponse(responseCode = "200", description = "El usuario")
    @ApiResponse(responseCode = "404", description = "No existe un usuario con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    public UsuarioDTO buscar(@Parameter(description = "Id del usuario", example = "2")
                             @PathVariable Long id) {
        return servicio.buscarPorId(id);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Modificar un usuario",
               description = "Cambia el nombre y el correo. La contraseña es opcional: si no viene o viene vacía, "
                       + "se conserva la actual. El rol no se puede cambiar.")
    @ApiResponse(responseCode = "200", description = "El usuario con los datos nuevos")
    @ApiResponse(responseCode = "400", description = "Faltan campos, el correo no es válido, la contraseña nueva tiene menos de 6 caracteres o el JSON está mal formado",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_400)))
    @ApiResponse(responseCode = "404", description = "No existe un usuario con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    @ApiResponse(responseCode = "409", description = "El correo nuevo ya lo usa otro usuario",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "Ya existe otro usuario con ese correo."}""")))
    public UsuarioDTO actualizar(@Parameter(description = "Id del usuario", example = "2")
                                 @PathVariable Long id,
                                 @Valid @RequestBody ActualizarUsuarioDTO dto) {
        return servicio.actualizar(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Eliminar un usuario",
               description = "Lo borra de MongoDB.")
    @ApiResponse(responseCode = "204", description = "Usuario eliminado")
    @ApiResponse(responseCode = "404", description = "No existe un usuario con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    public void eliminar(@Parameter(description = "Id del usuario", example = "2")
                         @PathVariable Long id) {
        servicio.eliminar(id);
    }
}

package com.restaurante.clientes.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.restaurante.clientes.dto.CambiarEstadoDTO;
import com.restaurante.clientes.dto.CrearReservaDTO;
import com.restaurante.clientes.dto.ReservaDTO;
import com.restaurante.clientes.model.EstadoReserva;
import com.restaurante.clientes.service.ReservaService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

/**
 * La puerta HTTP de las reservas.
 *
 * Al crear una reserva con mesa, el servicio consulta la mesa en salon-service
 * para comprobar su capacidad: por eso este controlador también documenta el
 * 503, que sale cuando el salón no responde.
 */
@RestController
@RequestMapping("/api/reservas")
@Tag(name = "Reservas", description = "Reservas de mesa a nombre de un cliente: crear, consultar, cambiar de estado y eliminar")
public class ReservaController {

    private static final String EJEMPLO_404 = """
            {"error": "No existe una reserva con id 99."}""";

    private final ReservaService reservaService;

    public ReservaController(ReservaService reservaService) {
        this.reservaService = reservaService;
    }

    @PostMapping
    @Operation(summary = "Crear una reserva",
               description = "Queda PENDIENTE. Si trae mesa, se consulta al salón que la mesa exista y alcance "
                       + "para las personas. La mesa y el mesero son opcionales.")
    @ApiResponse(responseCode = "201", description = "Reserva creada",
                 content = @Content(mediaType = "application/json", schema = @Schema(implementation = ReservaDTO.class)))
    @ApiResponse(responseCode = "400", description = "Faltan campos, la fecha ya pasó o el JSON está mal formado",
                 content = @Content(mediaType = "application/json", examples = {
                         @ExampleObject(name = "Campos", value = """
                                 {"error": "La petición tiene campos inválidos",
                                  "campos": {"clienteId": "El cliente es obligatorio"}}"""),
                         @ExampleObject(name = "Fecha pasada", value = """
                                 {"error": "No se puede reservar para una fecha que ya pasó."}""")}))
    @ApiResponse(responseCode = "404", description = "No existe el cliente o la mesa",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "La mesa 99 no existe."}""")))
    @ApiResponse(responseCode = "409", description = "La mesa no alcanza para esas personas",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "La mesa 2 no alcanza para 6 personas. Su capacidad es de 4."}""")))
    @ApiResponse(responseCode = "503", description = "El salón no respondió al consultar la mesa",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "El salón no está disponible en este momento."}""")))
    public ResponseEntity<ReservaDTO> crear(@Valid @RequestBody CrearReservaDTO dto) {
        ReservaDTO creada = reservaService.crear(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(creada);
    }

    @GetMapping
    @Operation(summary = "Listar las reservas",
               description = "Sin filtro devuelve todas. Cada reserva trae el nombre de su cliente.")
    @ApiResponse(responseCode = "200", description = "La lista, vacía si ninguna reserva está en ese estado")
    public List<ReservaDTO> listar(@Parameter(description = "Solo las de este estado", example = "PENDIENTE")
                                   @RequestParam(required = false) EstadoReserva estado) {
        return reservaService.listar(estado);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consultar una reserva")
    @ApiResponse(responseCode = "200", description = "La reserva")
    @ApiResponse(responseCode = "404", description = "No existe una reserva con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    public ReservaDTO buscar(@Parameter(description = "Id de la reserva", example = "1")
                             @PathVariable Long id) {
        return reservaService.buscarPorId(id);
    }

    @PatchMapping("/{id}/estado")
    @Operation(summary = "Cambiar el estado de una reserva",
               description = "PENDIENTE → CONFIRMADA o CANCELADA; CONFIRMADA → CANCELADA o CUMPLIDA. "
                       + "Ninguna vuelve a PENDIENTE.")
    @ApiResponse(responseCode = "200", description = "La reserva con su estado nuevo")
    @ApiResponse(responseCode = "400", description = "Falta el estado nuevo o no es válido",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "La petición tiene campos inválidos",
                          "campos": {"nuevoEstado": "El nuevo estado es obligatorio"}}""")))
    @ApiResponse(responseCode = "404", description = "No existe una reserva con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    @ApiResponse(responseCode = "409", description = "Ese cambio de estado no está permitido",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "No se puede pasar una reserva de CANCELADA a CONFIRMADA."}""")))
    public ReservaDTO cambiarEstado(@Parameter(description = "Id de la reserva", example = "1")
                                    @PathVariable Long id,
                                    @Valid @RequestBody CambiarEstadoDTO dto) {
        return reservaService.cambiarEstado(id, dto.nuevoEstado());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Eliminar una reserva", description = "La borra de MongoDB.")
    @ApiResponse(responseCode = "204", description = "Reserva eliminada")
    @ApiResponse(responseCode = "404", description = "No existe una reserva con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    public void eliminar(@Parameter(description = "Id de la reserva", example = "1")
                         @PathVariable Long id) {
        reservaService.eliminar(id);
    }
}

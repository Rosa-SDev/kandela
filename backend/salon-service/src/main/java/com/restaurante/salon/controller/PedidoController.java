package com.restaurante.salon.controller;

import com.restaurante.salon.dto.AgregarPlatilloDTO;
import com.restaurante.salon.dto.CambiarEstadoPedidoDTO;
import com.restaurante.salon.dto.CambiarNotaPedidoDTO;
import com.restaurante.salon.dto.CrearPedidoDTO;
import com.restaurante.salon.dto.PedidoDTO;
import com.restaurante.salon.model.EstadoPedido;
import com.restaurante.salon.model.Pedido;
import com.restaurante.salon.service.PedidoService;

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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Controlador REST para la gestión de pedidos y sus líneas de platillos.
 */
@RestController
@RequestMapping("/api/pedidos")
@Tag(name = "Pedidos", description = "Comandas del restaurante: apertura en mesa, notas, líneas de platillos y recorrido de estados")
public class PedidoController {

    private static final String EJEMPLO_400 = """
            {"error": "La petición tiene campos inválidos",
             "campos": {"mesaId": "El ID de la mesa es obligatorio"}}""";
    private static final String EJEMPLO_404 = """
            {"error": "El pedido 99 no existe."}""";
    private static final String EJEMPLO_409_MESA = """
            {"error": "La mesa 1 ya está ocupada por otro pedido."}""";
    private static final String EJEMPLO_409_PLATILLO = """
            {"error": "El platillo Limonada de coco está agotado."}""";
    private static final String EJEMPLO_409_ESTADO = """
            {"error": "No se puede pasar un pedido de Servido a En cocina."}""";
    private static final String EJEMPLO_503_USUARIOS = """
            {"error": "El servicio de usuarios no está disponible en este momento."}""";
    private static final String EJEMPLO_503_CARTA = """
            {"error": "La carta no está disponible en este momento."}""";

    private final PedidoService servicio;

    public PedidoController(PedidoService servicio) {
        this.servicio = servicio;
    }

    /** 201 con el pedido creado y mesa ocupada. */
    @PostMapping
    @Operation(summary = "Abrir un pedido",
               description = "Valida el mesero en usuarios-service, ocupa la mesa y crea el pedido en estado ABIERTO dentro de una transacción.")
    @ApiResponse(responseCode = "201", description = "Pedido abierto y mesa marcada como ocupada",
                 content = @Content(mediaType = "application/json", schema = @Schema(implementation = PedidoDTO.class)))
    @ApiResponse(responseCode = "400", description = "Faltan campos obligatorios o el JSON está mal formado",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_400)))
    @ApiResponse(responseCode = "404", description = "No existe la mesa o el mesero indicado",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    @ApiResponse(responseCode = "409", description = "La mesa ya está ocupada o el usuario no es un mesero activo",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_409_MESA)))
    @ApiResponse(responseCode = "503", description = "El servicio de usuarios no respondió a tiempo",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_503_USUARIOS)))
    public ResponseEntity<PedidoDTO> crear(@Valid @RequestBody CrearPedidoDTO datos) {
        Pedido creado = servicio.crear(datos);
        return ResponseEntity.status(HttpStatus.CREATED).body(aDto(creado));
    }

    /** 200 con el listado de pedidos, con filtro opcional por estado. */
    @GetMapping
    @Operation(summary = "Listar los pedidos",
               description = "Sin filtro devuelve todos los pedidos; permite filtrar por estado.")
    @ApiResponse(responseCode = "200", description = "Lista de pedidos con sus platillos y el número de mesa")
    public List<PedidoDTO> listar(
            @Parameter(description = "Solo los pedidos en este estado", example = "EN_COCINA")
            @RequestParam(required = false) EstadoPedido estado) {
        List<Pedido> pedidos = servicio.listar(estado);
        Map<Long, Integer> numerosDeMesa = servicio.numerosDeMesa(pedidos);
        return pedidos.stream()
                .map(p -> PedidoDTO.de(p, numerosDeMesa.get(p.getMesaId())))
                .toList();
    }

    /** 200 con el pedido consultado, o 404 si no existe. */
    @GetMapping("/{id}")
    @Operation(summary = "Consultar un pedido")
    @ApiResponse(responseCode = "200", description = "El pedido solicitado")
    @ApiResponse(responseCode = "404", description = "No existe un pedido con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    public PedidoDTO buscar(@Parameter(description = "Id del pedido", example = "1")
                            @PathVariable Long id) {
        return aDto(servicio.buscarPorId(id));
    }

    /** 200 con el pedido y su nota ya cambiada. */
    @PatchMapping("/{id}")
    @Operation(summary = "Cambiar la nota del pedido",
               description = "Actualiza las observaciones del pedido mientras sigue en estado ABIERTO.")
    @ApiResponse(responseCode = "200", description = "El pedido con la nota actualizada")
    @ApiResponse(responseCode = "400", description = "La nota supera los 255 caracteres o el JSON está mal formado",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "La petición tiene campos inválidos",
                          "campos": {"observaciones": "La nota no puede tener más de 255 caracteres."}}""")))
    @ApiResponse(responseCode = "404", description = "No existe un pedido con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    @ApiResponse(responseCode = "409", description = "El pedido ya salió de estado ABIERTO",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "Solo se puede cambiar la nota de un pedido abierto."}""")))
    public PedidoDTO cambiarNota(@Parameter(description = "Id del pedido", example = "1")
                                 @PathVariable Long id,
                                 @Valid @RequestBody CambiarNotaPedidoDTO datos) {
        return aDto(servicio.cambiarNota(id, datos.observaciones()));
    }

    /** 201 con el pedido actualizado tras agregar una línea de platillo. */
    @PostMapping("/{id}/platillos")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Agregar un platillo al pedido",
               description = "Consulta el platillo en carta-service y guarda una copia congelada de su nombre y precio dentro del pedido mientras esté ABIERTO.")
    @ApiResponse(responseCode = "201", description = "El pedido actualizado con la nueva línea de platillo")
    @ApiResponse(responseCode = "400", description = "Falta el id del platillo o el JSON está mal formado",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "La petición tiene campos inválidos",
                          "campos": {"platilloId": "El ID del platillo es obligatorio"}}""")))
    @ApiResponse(responseCode = "404", description = "No existe el pedido o el platillo en la carta",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    @ApiResponse(responseCode = "409", description = "El pedido no está abierto o el platillo está agotado",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_409_PLATILLO)))
    @ApiResponse(responseCode = "503", description = "El servicio de carta no respondió a tiempo",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_503_CARTA)))
    public PedidoDTO agregarPlatillo(@Parameter(description = "Id del pedido", example = "1")
                                     @PathVariable Long id,
                                     @Valid @RequestBody AgregarPlatilloDTO datos) {
        return aDto(servicio.agregarPlatillo(id, datos));
    }

    /** 204 tras remover una línea de platillo del pedido. */
    @DeleteMapping("/{id}/platillos/{lineaId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Quitar una línea de platillo del pedido",
               description = "Elimina una unidad específica del pedido mientras esté en estado ABIERTO.")
    @ApiResponse(responseCode = "204", description = "Línea de platillo eliminada del pedido")
    @ApiResponse(responseCode = "404", description = "No existe el pedido o esa línea de platillo",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    @ApiResponse(responseCode = "409", description = "El pedido ya no está en estado ABIERTO",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "Solo se pueden quitar platillos de un pedido abierto."}""")))
    public void quitarPlatillo(@Parameter(description = "Id del pedido", example = "1")
                               @PathVariable Long id,
                               @Parameter(description = "Id de la línea de platillo dentro del pedido", example = "1")
                               @PathVariable Long lineaId) {
        servicio.quitarPlatillo(id, lineaId);
    }

    /** 200 con el pedido actualizado con su nuevo estado. */
    @PatchMapping("/{id}/estado")
    @Operation(summary = "Cambiar el estado del pedido",
               description = "Avanza por la secuencia ABIERTO → EN_COCINA → EN_PREPARACION → SERVIDO, o cancela el pedido liberando su mesa.")
    @ApiResponse(responseCode = "200", description = "El pedido con su nuevo estado")
    @ApiResponse(responseCode = "400", description = "Falta el estado destino o el JSON está mal formado",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "La petición tiene campos inválidos",
                          "campos": {"estado": "El nuevo estado del pedido es obligatorio"}}""")))
    @ApiResponse(responseCode = "404", description = "No existe un pedido con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    @ApiResponse(responseCode = "409", description = "La transición solicitada no está permitida",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_409_ESTADO)))
    public PedidoDTO cambiarEstado(@Parameter(description = "Id del pedido", example = "1")
                                   @PathVariable Long id,
                                   @Valid @RequestBody CambiarEstadoPedidoDTO datos) {
        return aDto(servicio.cambiarEstado(id, datos.estado()));
    }

    private PedidoDTO aDto(Pedido pedido) {
        return PedidoDTO.de(pedido, servicio.numeroDeMesa(pedido.getMesaId()));
    }
}

package com.restaurante.salon.controller;

import com.restaurante.salon.dto.EmitirFacturaDTO;
import com.restaurante.salon.dto.FacturaDTO;
import com.restaurante.salon.model.Factura;
import com.restaurante.salon.service.FacturaService;

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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Controlador REST para la emisión, consulta y anulación de facturas.
 */
@RestController
@RequestMapping("/api/facturas")
@Tag(name = "Facturas", description = "Facturación de pedidos: cálculo del impuesto al consumo (8 %), cobro, consulta y anulación")
public class FacturaController {

    private static final String EJEMPLO_400 = """
            {"error": "La petición tiene campos inválidos",
             "campos": {"monto": "El monto pagado debe ser mayor que cero"}}""";
    private static final String EJEMPLO_404 = """
            {"error": "La factura 99 no existe."}""";
    private static final String EJEMPLO_409_COBRO = """
            {"error": "El monto no cubre el total de la factura ($32400.00)."}""";
    private static final String EJEMPLO_409_ANULADA = """
            {"error": "La factura F-0001 ya está anulada."}""";
    private static final String EJEMPLO_503 = """
            {"error": "El servicio de usuarios no está disponible en este momento."}""";

    private final FacturaService servicio;

    public FacturaController(FacturaService servicio) {
        this.servicio = servicio;
    }

    /** 201 con la factura emitida. */
    @PostMapping
    @Operation(summary = "Emitir una factura y cobrar el pedido",
               description = "Valida el cajero en usuarios-service, calcula el 8 % de impuesto al consumo, registra el pago, cierra el pedido como PAGADO y libera la mesa dentro de una transacción.")
    @ApiResponse(responseCode = "201", description = "Factura emitida y pedido cobrado",
                 content = @Content(mediaType = "application/json", schema = @Schema(implementation = FacturaDTO.class)))
    @ApiResponse(responseCode = "400", description = "Faltan campos obligatorios, el monto no es positivo o el JSON está mal formado",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_400)))
    @ApiResponse(responseCode = "404", description = "No existe el cajero, el pedido o la mesa asociada",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    @ApiResponse(responseCode = "409", description = "El usuario no es cajero activo, el pedido no es facturable, ya tiene factura vigente o el monto es insuficiente",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_409_COBRO)))
    @ApiResponse(responseCode = "503", description = "El servicio de usuarios no respondió a tiempo",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_503)))
    public ResponseEntity<FacturaDTO> emitir(@Valid @RequestBody EmitirFacturaDTO datos) {
        Factura emitida = servicio.emitirFactura(datos);
        return ResponseEntity.status(HttpStatus.CREATED).body(FacturaDTO.de(emitida));
    }

    /** 200 con la lista de todas las facturas. */
    @GetMapping
    @Operation(summary = "Listar las facturas")
    @ApiResponse(responseCode = "200", description = "Lista de todas las facturas emitidas")
    public List<FacturaDTO> listar() {
        return servicio.listar().stream()
                .map(FacturaDTO::de)
                .toList();
    }

    /** 200 con la factura consultada, o 404 si no existe. */
    @GetMapping("/{id}")
    @Operation(summary = "Consultar una factura")
    @ApiResponse(responseCode = "200", description = "La factura solicitada")
    @ApiResponse(responseCode = "404", description = "No existe una factura con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    public FacturaDTO buscar(@Parameter(description = "Id de la factura", example = "1")
                             @PathVariable Long id) {
        return FacturaDTO.de(servicio.buscarPorId(id));
    }

    /**
     * 200 con la factura anulada.
     * Retorna 200 (y no 204) porque no borra el documento de la base de datos,
     * sino que devuelve el comprobante en su nuevo estado anulado.
     */
    @DeleteMapping("/{id}")
    @Operation(summary = "Anular una factura",
               description = "Marca la factura como anulada conservando sus importes históricos para control contable.")
    @ApiResponse(responseCode = "200", description = "La factura marcada como anulada")
    @ApiResponse(responseCode = "404", description = "No existe una factura con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    @ApiResponse(responseCode = "409", description = "La factura ya se encontraba anulada",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_409_ANULADA)))
    public FacturaDTO anular(@Parameter(description = "Id de la factura", example = "1")
                             @PathVariable Long id) {
        return FacturaDTO.de(servicio.anularFactura(id));
    }
}

package com.restaurante.clientes.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.restaurante.clientes.dto.CrearResenaDTO;
import com.restaurante.clientes.dto.MarcarRevisadaDTO;
import com.restaurante.clientes.dto.ResenaDTO;
import com.restaurante.clientes.model.AccionDelAgente;
import com.restaurante.clientes.service.ResenaService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

/**
 * La puerta HTTP de las reseñas de los clientes.
 *
 * Al crear una reseña, el servicio le pide su decisión a SentiTriage-ES. Si el
 * agente no responde, la reseña se guarda igual (201) como ABSTAIN y sin
 * clasificar: el formulario del cliente nunca falla por culpa del agente.
 */
@RestController
@RequestMapping("/api/resenas")
@Tag(name = "Reseñas", description = "Comentarios de los clientes, clasificados por el agente SentiTriage-ES: "
        + "crear, consultar, marcar como revisada y volver a clasificar")
public class ResenaController {

    private static final String EJEMPLO_404 = """
            {"error": "No existe una reseña con id 99."}""";

    private static final String EJEMPLO_RESENA = """
            {"id": 1, "texto": "La sopa llegó fría y tuvimos que pedir dos veces la cuenta.",
             "fecha": "2026-11-15T20:41:07", "mesaId": 4, "pedidoId": 12,
             "accion": "QUEUE", "etiqueta": "negative", "confianza": 0.84, "umbral": 0.5933,
             "modelo": "beto-sentitriage", "sinClasificar": false, "revisada": false}""";

    private final ResenaService resenaService;

    public ResenaController(ResenaService resenaService) {
        this.resenaService = resenaService;
    }

    @PostMapping
    @Operation(summary = "Registrar una reseña",
               description = "La usa el formulario público del QR. La reseña se clasifica con SentiTriage-ES: "
                       + "ABSTAIN (requiere una persona), QUEUE (queja) o PASS (se almacena). "
                       + "Si el agente no responde, se guarda igual como ABSTAIN con sinClasificar en true.")
    @ApiResponse(responseCode = "201", description = "Reseña guardada con la decisión del agente",
                 content = @Content(mediaType = "application/json", schema = @Schema(implementation = ResenaDTO.class),
                         examples = @ExampleObject(EJEMPLO_RESENA)))
    @ApiResponse(responseCode = "400", description = "Falta el comentario, es demasiado largo o el JSON está mal formado",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "La petición tiene campos inválidos",
                          "campos": {"texto": "Escribe tu comentario"}}""")))
    public ResponseEntity<ResenaDTO> crear(@Valid @RequestBody CrearResenaDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(resenaService.crear(dto));
    }

    @GetMapping
    @Operation(summary = "Listar las reseñas",
               description = "De la más reciente a la más antigua. Sin filtros devuelve todas.")
    @ApiResponse(responseCode = "200", description = "La lista, vacía si ninguna cumple los filtros")
    public List<ResenaDTO> listar(@Parameter(description = "Solo las que el agente decidió así", example = "QUEUE")
                                  @RequestParam(required = false) AccionDelAgente accion,
                                  @Parameter(description = "Solo las revisadas (true) o las pendientes (false)",
                                             example = "false")
                                  @RequestParam(required = false) Boolean revisada) {
        return resenaService.listar(accion, revisada);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consultar una reseña")
    @ApiResponse(responseCode = "200", description = "La reseña con la decisión del agente")
    @ApiResponse(responseCode = "404", description = "No existe una reseña con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    public ResenaDTO buscar(@Parameter(description = "Id de la reseña", example = "1")
                            @PathVariable Long id) {
        return resenaService.buscarPorId(id);
    }

    @PatchMapping("/{id}/revisada")
    @Operation(summary = "Marcar una reseña como revisada",
               description = "Con revisada en true sale de la lista de pendientes; en false vuelve a ella.")
    @ApiResponse(responseCode = "200", description = "La reseña con su marca nueva")
    @ApiResponse(responseCode = "400", description = "Falta el campo revisada",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "La petición tiene campos inválidos",
                          "campos": {"revisada": "Indica si la reseña quedó revisada"}}""")))
    @ApiResponse(responseCode = "404", description = "No existe una reseña con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    public ResenaDTO marcarRevisada(@Parameter(description = "Id de la reseña", example = "1")
                                    @PathVariable Long id,
                                    @Valid @RequestBody MarcarRevisadaDTO dto) {
        return resenaService.marcarRevisada(id, dto.revisada());
    }

    @PostMapping("/{id}/clasificacion")
    @Operation(summary = "Volver a clasificar una reseña",
               description = "Solo para las que quedaron sin clasificar porque el agente no respondió.")
    @ApiResponse(responseCode = "200", description = "La reseña con la decisión del agente")
    @ApiResponse(responseCode = "404", description = "No existe una reseña con ese id",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject(EJEMPLO_404)))
    @ApiResponse(responseCode = "409", description = "La reseña ya está clasificada",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "La reseña 3 ya está clasificada."}""")))
    @ApiResponse(responseCode = "503", description = "El agente sigue sin responder",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "El agente de reseñas no está disponible en este momento."}""")))
    public ResenaDTO volverAClasificar(@Parameter(description = "Id de la reseña", example = "3")
                                       @PathVariable Long id) {
        return resenaService.volverAClasificar(id);
    }
}

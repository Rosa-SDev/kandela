package com.restaurante.clientes.exception;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ManejadorDeErrores {

    @ExceptionHandler(NoEncontradoException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, Object> noEncontrado(NoEncontradoException e) {
        return Map.of("error", e.getMessage());
    }

    @ExceptionHandler(ConflictoException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, Object> conflicto(ConflictoException e) {
        return Map.of("error", e.getMessage());
    }

    /**
     * Otro servicio no respondió. El mensaje explica cuál, para que la
     * interfaz pueda ofrecer reintentar en vez de mostrar un error seco.
     */
    @ExceptionHandler(ServicioNoDisponibleException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public Map<String, Object> servicioNoDisponible(ServicioNoDisponibleException e) {
        return Map.of("error", e.getMessage());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, Object> jsonInvalido(HttpMessageNotReadableException e) {
        return Map.of("error", "El cuerpo de la petición no es un JSON válido.");
    }

    /**
     * La lanza @Valid cuando el cuerpo de la petición no cumple las
     * validaciones del DTO. Se devuelven todos los campos que fallaron,
     * dentro del mismo sobre que el resto de los errores: la interfaz lee
     * siempre «error» y, cuando viene, «campos» para marcar cada uno.
     *
     * El orden de los campos se conserva para que dos peticiones iguales
     * devuelvan la misma respuesta.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, Object> validacionFallida(MethodArgumentNotValidException e) {
        Map<String, String> campos = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors().forEach(err -> campos.put(err.getField(), err.getDefaultMessage()));
        return Map.of("error", "La petición tiene campos inválidos",
                      "campos", campos);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, Object> solicitudInvalida(IllegalArgumentException e) {
        return Map.of("error", e.getMessage());
    }
}

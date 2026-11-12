package com.restaurante.usuarios.exception;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class ManejadorDeErrores {

    @ExceptionHandler(NoEncontradoException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, String> noEncontrado(NoEncontradoException e) {
        return Map.of("error", e.getMessage());
    }

    @ExceptionHandler(ConflictoException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> conflicto(ConflictoException e) {
        return Map.of("error", e.getMessage());
    }

    /**
     * MongoDB rechazo la escritura por el indice unico del correo.
     *
     * El servicio ya comprueba el correo antes de guardar, asi que esto solo
     * ocurre si dos peticiones con el mismo correo llegan a la vez: las dos
     * pasan la comprobacion y el indice detiene a la segunda. Se responde igual
     * que el conflicto normal, no con un 500.
     */
    @ExceptionHandler(DuplicateKeyException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> claveDuplicada(DuplicateKeyException e) {
        return Map.of("error", "Ya existe un usuario con ese correo.");
    }

    @ExceptionHandler(CredencialesInvalidasException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public Map<String, String> credencialesInvalidas(CredencialesInvalidasException e) {
        return Map.of("error", e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> datosInvalidos(MethodArgumentNotValidException e) {
        String mensaje = e.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return Map.of("error", mensaje);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> jsonInvalido(HttpMessageNotReadableException e) {
        return Map.of("error", "El cuerpo de la petición no es un JSON válido.");
    }
}

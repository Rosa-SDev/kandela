package com.restaurante.clientes.exception;

/**
 * Otro servicio no respondió: está apagado, no se alcanza o tardó demasiado.
 *
 * Se traduce a 503 para distinguir «el otro servicio no está» de «los datos
 * que enviaste están mal», que es lo que dicen el 404 y el 409.
 */
public class ServicioNoDisponibleException extends RuntimeException {

    public ServicioNoDisponibleException(String mensaje) {
        super(mensaje);
    }

    public ServicioNoDisponibleException(String mensaje, Throwable causa) {
        super(mensaje, causa);
    }
}

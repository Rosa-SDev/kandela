package com.restaurante.clientes.cliente;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.restaurante.clientes.exception.NoEncontradoException;
import com.restaurante.clientes.exception.ServicioNoDisponibleException;

/**
 * Consultas de solo lectura al salón.
 *
 * Aquí termina todo lo que puede salir mal en la red: hacia dentro de este
 * servicio solo salen dos excepciones propias, así que ni los servicios ni
 * los controladores tienen que saber que detrás hay una llamada HTTP.
 */
@Component
public class SalonClient {

    private static final String SALON_NO_DISPONIBLE = "El salón no está disponible en este momento.";

    private final RestClient http;

    public SalonClient(@Qualifier("salonRestClient") RestClient salonRestClient) {
        this.http = salonRestClient;
    }

    /**
     * Devuelve la mesa con ese identificador.
     *
     * @throws NoEncontradoException si el salón responde que no existe
     * @throws ServicioNoDisponibleException ante cualquier otro fallo: el salón
     *         está apagado, tarda más de lo permitido, responde con un error
     *         propio o devuelve algo que no se puede leer
     */
    public MesaRemota obtener(Long id) {
        MesaRemota mesa;

        try {
            mesa = http.get()
                    .uri("/api/mesas/{id}", id)
                    .retrieve()
                    .body(MesaRemota.class);
        } catch (HttpClientErrorException.NotFound excepcion) {
            throw new NoEncontradoException("La mesa " + id + " no existe.");
        } catch (RestClientException excepcion) {
            throw new ServicioNoDisponibleException(SALON_NO_DISPONIBLE, excepcion);
        }

        if (mesa == null) {
            throw new ServicioNoDisponibleException(SALON_NO_DISPONIBLE);
        }
        return mesa;
    }
}

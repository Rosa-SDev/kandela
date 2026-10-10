package com.restaurante.salon.cliente;

import com.restaurante.salon.exception.NoEncontradoException;
import com.restaurante.salon.exception.ServicioNoDisponibleException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Consultas de solo lectura a la carta.
 *
 * Aquí termina todo lo que puede salir mal en la red: hacia dentro del salón
 * solo salen dos excepciones propias, así que ni los servicios ni los
 * controladores tienen que saber que detrás hay una llamada HTTP.
 */
@Component
public class CartaClient {

    private static final String CARTA_NO_DISPONIBLE = "La carta no está disponible en este momento.";

    private final RestClient http;

    public CartaClient(@Qualifier("cartaRestClient") RestClient cartaRestClient) {
        this.http = cartaRestClient;
    }

    /**
     * Devuelve el platillo con ese identificador.
     *
     * @throws NoEncontradoException si la carta responde que no existe
     * @throws ServicioNoDisponibleException ante cualquier otro fallo: la carta
     *         está apagada, tarda más de lo permitido, responde con un error
     *         propio o devuelve algo que no se puede leer
     */
    public PlatilloRemoto obtener(Long id) {
        PlatilloRemoto platillo;

        try {
            platillo = http.get()
                    .uri("/api/platillos/{id}", id)
                    .retrieve()
                    .body(PlatilloRemoto.class);
        } catch (HttpClientErrorException.NotFound excepcion) {
            throw new NoEncontradoException("El platillo " + id + " no existe.");
        } catch (RestClientException excepcion) {
            throw new ServicioNoDisponibleException(CARTA_NO_DISPONIBLE, excepcion);
        }

        if (platillo == null) {
            throw new ServicioNoDisponibleException(CARTA_NO_DISPONIBLE);
        }
        return platillo;
    }
}

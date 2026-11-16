package com.restaurante.clientes.cliente;

import java.util.Map;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.restaurante.clientes.exception.ServicioNoDisponibleException;

/**
 * Cliente de SentiTriage-ES, el agente que clasifica el sentimiento de las
 * reseñas y se abstiene cuando no está seguro.
 *
 * SentiTriage-ES es un servicio aparte (Python, FastAPI) que no sabe nada del
 * restaurante: recibe un texto, y opcionalmente un id y datos del sistema que
 * lo llama, y devuelve su decisión. Kandela lo usa como a cualquier otro
 * servicio, por HTTP.
 *
 * Igual que SalonClient, aquí termina todo lo que puede salir mal en la red:
 * hacia dentro solo sale ServicioNoDisponibleException. Qué hacer en ese caso
 * lo decide ResenaService.
 */
@Component
public class SentiTriageClient {

    private static final String AGENTE_NO_DISPONIBLE = "El agente de reseñas no está disponible en este momento.";

    private final RestClient http;

    public SentiTriageClient(@Qualifier("sentiTriageRestClient") RestClient sentiTriageRestClient) {
        this.http = sentiTriageRestClient;
    }

    /**
     * Pide al agente su decisión sobre un texto.
     *
     * @param id       id de la reseña en Kandela; el agente lo devuelve igual
     * @param texto    el comentario del cliente
     * @param datos    datos de Kandela que acompañan la reseña (mesa, pedido);
     *                 el agente los devuelve sin cambios
     * @throws ServicioNoDisponibleException si el agente está apagado, tarda más
     *         de lo permitido, rechaza la petición o responde algo ilegible
     */
    public DecisionRemota clasificar(Long id, String texto, Map<String, Object> datos) {
        DecisionRemota decision;

        try {
            decision = http.post()
                    .uri("/classify")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("text", texto, "id", String.valueOf(id), "metadata", datos))
                    .retrieve()
                    .body(DecisionRemota.class);
        } catch (RestClientException excepcion) {
            throw new ServicioNoDisponibleException(AGENTE_NO_DISPONIBLE, excepcion);
        }

        if (decision == null || decision.action() == null) {
            throw new ServicioNoDisponibleException(AGENTE_NO_DISPONIBLE);
        }
        return decision;
    }
}

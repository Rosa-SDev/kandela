package com.restaurante.clientes.cliente;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.IOException;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.client.ResponseActions;
import org.springframework.web.client.RestClient;

import com.restaurante.clientes.exception.ServicioNoDisponibleException;

/**
 * Pruebas del cliente de SentiTriage-ES contra un agente simulado.
 *
 * Igual que con el salón, el servidor simulado se engancha al constructor del
 * cliente: las peticiones no salen a la red y se dicta qué responde el agente.
 */
class SentiTriageClientTest {

    private static final String URL_DEL_AGENTE = "http://localhost:8000";
    private static final String AGENTE_NO_DISPONIBLE = "El agente de reseñas no está disponible en este momento.";

    private MockRestServiceServer agente;
    private SentiTriageClient cliente;

    @BeforeEach
    void prepararElAgenteSimulado() {
        RestClient.Builder constructor = RestClient.builder().baseUrl(URL_DEL_AGENTE);
        this.agente = MockRestServiceServer.bindTo(constructor).build();
        this.cliente = new SentiTriageClient(constructor.build());
    }

    @Test
    void enviaElTextoConSuIdYSusDatosYLeeLaDecision() {
        esperarClasificacion()
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.text").value("La sopa llegó fría."))
                .andExpect(jsonPath("$.id").value("7"))
                .andExpect(jsonPath("$.metadata.mesaId").value(4))
                .andRespond(withSuccess("""
                        {"label": "negative", "confidence": 0.84, "action": "QUEUE", "abstained": false,
                         "threshold": 0.5933, "model": "beto-sentitriage", "text": "La sopa llegó fría.",
                         "id": "7", "metadata": {"mesaId": 4},
                         "probabilities": {"negative": 0.84, "neutral": 0.11, "positive": 0.05}}
                        """, MediaType.APPLICATION_JSON));

        DecisionRemota decision = cliente.clasificar(7L, "La sopa llegó fría.", Map.of("mesaId", 4L));

        assertThat(decision.action()).isEqualTo("QUEUE");
        assertThat(decision.label()).isEqualTo("negative");
        assertThat(decision.confidence()).isEqualTo(0.84);
        assertThat(decision.threshold()).isEqualTo(0.5933);
        assertThat(decision.model()).isEqualTo("beto-sentitriage");
        assertThat(decision.error()).isNull();
        agente.verify();
    }

    @Test
    void siElModeloFallaElAgenteSeAbstieneYSeLeeSuError() {
        esperarClasificacion().andRespond(withSuccess("""
                {"label": null, "confidence": null, "action": "ABSTAIN", "abstained": true,
                 "threshold": 0.5933, "model": "beto-sentitriage", "error": "model_failure"}
                """, MediaType.APPLICATION_JSON));

        DecisionRemota decision = cliente.clasificar(1L, "Todo bien", Map.of());

        assertThat(decision.action()).isEqualTo("ABSTAIN");
        assertThat(decision.label()).isNull();
        assertThat(decision.error()).isEqualTo("model_failure");
        agente.verify();
    }

    @Test
    void siElAgenteEstaApagadoSeAvisaQueNoEstaDisponible() {
        esperarClasificacion().andRespond(withException(new IOException("No se pudo conectar con el agente")));

        assertThatThrownBy(() -> cliente.clasificar(1L, "Todo bien", Map.of()))
                .isInstanceOf(ServicioNoDisponibleException.class)
                .hasMessage(AGENTE_NO_DISPONIBLE);
        agente.verify();
    }

    @Test
    void siElAgenteFallaPorDentroSeAvisaQueNoEstaDisponible() {
        esperarClasificacion().andRespond(withServerError());

        assertThatThrownBy(() -> cliente.clasificar(1L, "Todo bien", Map.of()))
                .isInstanceOf(ServicioNoDisponibleException.class)
                .hasMessage(AGENTE_NO_DISPONIBLE);
        agente.verify();
    }

    @Test
    void siElAgenteRechazaLaPeticionSeAvisaQueNoEstaDisponible() {
        esperarClasificacion().andRespond(withBadRequest());

        assertThatThrownBy(() -> cliente.clasificar(1L, "Todo bien", Map.of()))
                .isInstanceOf(ServicioNoDisponibleException.class)
                .hasMessage(AGENTE_NO_DISPONIBLE);
        agente.verify();
    }

    /** Deja dicho que se espera un POST a /classify. */
    private ResponseActions esperarClasificacion() {
        return agente.expect(requestTo(URL_DEL_AGENTE + "/classify"))
                .andExpect(method(HttpMethod.POST));
    }
}

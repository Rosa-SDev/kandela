package com.restaurante.clientes.cliente;

import java.io.IOException;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.client.ResponseActions;
import org.springframework.web.client.RestClient;

import com.restaurante.clientes.exception.NoEncontradoException;
import com.restaurante.clientes.exception.ServicioNoDisponibleException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withResourceNotFound;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Pruebas del cliente del salón contra un servidor simulado.
 *
 * No se levanta ningún servicio: el servidor simulado se engancha al mismo
 * constructor con el que se arma el cliente, así que las peticiones no salen a
 * la red y se puede dictar qué responde el salón en cada caso.
 *
 * Lo que se comprueba es la traducción: de lo que contesta el salón a las
 * excepciones que entienden las reservas.
 */
class SalonClientTest {

    private static final String URL_DE_SALON = "http://localhost:8084";
    private static final String SALON_NO_DISPONIBLE = "El salón no está disponible en este momento.";

    private MockRestServiceServer salon;
    private SalonClient cliente;

    @BeforeEach
    void prepararElSalonSimulado() {
        RestClient.Builder constructor = RestClient.builder().baseUrl(URL_DE_SALON);
        this.salon = MockRestServiceServer.bindTo(constructor).build();
        this.cliente = new SalonClient(constructor.build());
    }

    @Test
    void elSalonDevuelveLaMesaYSeLeenSusDatos() {
        esperarConsultaDeLaMesa(2).andRespond(withSuccess("""
                {
                    "id": 2,
                    "numero": 2,
                    "capacidad": 4,
                    "estado": "LIBRE"
                }
                """, MediaType.APPLICATION_JSON));

        MesaRemota mesa = cliente.obtener(2L);

        assertThat(mesa.id()).isEqualTo(2L);
        assertThat(mesa.numero()).isEqualTo(2);
        assertThat(mesa.capacidad()).isEqualTo(4);
        salon.verify();
    }

    @Test
    void siElSalonNoTieneEsaMesaSeAvisaQueNoExiste() {
        esperarConsultaDeLaMesa(99).andRespond(withResourceNotFound());

        assertThatThrownBy(() -> cliente.obtener(99L))
                .isInstanceOf(NoEncontradoException.class)
                .hasMessage("La mesa 99 no existe.");
        salon.verify();
    }

    @Test
    void siElSalonRechazaLaPeticionSeTrataComoSalonNoDisponible() {
        esperarConsultaDeLaMesa(2).andRespond(withBadRequest());

        assertThatThrownBy(() -> cliente.obtener(2L))
                .isInstanceOf(ServicioNoDisponibleException.class)
                .hasMessage(SALON_NO_DISPONIBLE);
        salon.verify();
    }

    @Test
    void siElSalonFallaPorDentroSeTrataComoSalonNoDisponible() {
        esperarConsultaDeLaMesa(2).andRespond(withServerError());

        assertThatThrownBy(() -> cliente.obtener(2L))
                .isInstanceOf(ServicioNoDisponibleException.class)
                .hasMessage(SALON_NO_DISPONIBLE);
        salon.verify();
    }

    @Test
    void siElSalonEstaApagadoSeAvisaQueNoEstaDisponible() {
        esperarConsultaDeLaMesa(2)
                .andRespond(withException(new IOException("No se pudo conectar con el salón")));

        assertThatThrownBy(() -> cliente.obtener(2L))
                .isInstanceOf(ServicioNoDisponibleException.class)
                .hasMessage(SALON_NO_DISPONIBLE);
        salon.verify();
    }

    /** Deja dicho que se espera una consulta GET por esa mesa. */
    private ResponseActions esperarConsultaDeLaMesa(int id) {
        return salon.expect(requestTo(URL_DE_SALON + "/api/mesas/" + id))
                .andExpect(method(HttpMethod.GET));
    }
}

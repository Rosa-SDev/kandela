package com.restaurante.salon.cliente;

import com.restaurante.salon.exception.NoEncontradoException;
import com.restaurante.salon.exception.ServicioNoDisponibleException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.client.ResponseActions;
import org.springframework.web.client.RestClient;

import java.io.IOException;

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
 * Pruebas del cliente de la carta contra un servidor simulado.
 *
 * No se levanta ningún servicio: el servidor simulado se engancha al mismo
 * constructor con el que se arma el cliente, así que las peticiones no salen a
 * la red y se puede dictar qué responde la carta en cada caso.
 *
 * Lo que se comprueba es la traducción: de lo que contesta la carta a las
 * excepciones que entiende el salón.
 */
class CartaClientTest {

    private static final String URL_DE_CARTA = "http://localhost:8082";
    private static final String CARTA_NO_DISPONIBLE = "La carta no está disponible en este momento.";

    private MockRestServiceServer carta;
    private CartaClient cliente;

    @BeforeEach
    void prepararLaCartaSimulada() {
        RestClient.Builder constructor = RestClient.builder().baseUrl(URL_DE_CARTA);
        this.carta = MockRestServiceServer.bindTo(constructor).build();
        this.cliente = new CartaClient(constructor.build());
    }

    @Test
    void laCartaDevuelveElPlatilloYSeLeenSusDatos() {
        esperarConsultaDelPlatillo(1).andRespond(withSuccess("""
                {
                    "id": 1,
                    "nombre": "Bandeja paisa",
                    "descripcion": "Frijoles, chicharrón, chorizo, arepa y huevo",
                    "categoria": "Fuertes",
                    "precio": 38000.00,
                    "disponible": true
                }
                """, MediaType.APPLICATION_JSON));

        PlatilloRemoto platillo = cliente.obtener(1L);

        assertThat(platillo.id()).isEqualTo(1L);
        assertThat(platillo.nombre()).isEqualTo("Bandeja paisa");
        assertThat(platillo.precio()).isEqualByComparingTo("38000.00");
        assertThat(platillo.disponible()).isTrue();
        carta.verify();
    }

    @Test
    void siLaCartaNoTieneEsePlatilloSeAvisaQueNoExiste() {
        esperarConsultaDelPlatillo(99).andRespond(withResourceNotFound());

        assertThatThrownBy(() -> cliente.obtener(99L))
                .isInstanceOf(NoEncontradoException.class)
                .hasMessage("El platillo 99 no existe.");
        carta.verify();
    }

    @Test
    void siLaCartaRechazaLaPeticionSeTrataComoCartaNoDisponible() {
        esperarConsultaDelPlatillo(1).andRespond(withBadRequest());

        assertThatThrownBy(() -> cliente.obtener(1L))
                .isInstanceOf(ServicioNoDisponibleException.class)
                .hasMessage(CARTA_NO_DISPONIBLE);
        carta.verify();
    }

    @Test
    void siLaCartaFallaPorDentroSeTrataComoCartaNoDisponible() {
        esperarConsultaDelPlatillo(1).andRespond(withServerError());

        assertThatThrownBy(() -> cliente.obtener(1L))
                .isInstanceOf(ServicioNoDisponibleException.class)
                .hasMessage(CARTA_NO_DISPONIBLE);
        carta.verify();
    }

    @Test
    void siLaCartaEstaApagadaSeAvisaQueNoEstaDisponible() {
        esperarConsultaDelPlatillo(1)
                .andRespond(withException(new IOException("No se pudo conectar con la carta")));

        assertThatThrownBy(() -> cliente.obtener(1L))
                .isInstanceOf(ServicioNoDisponibleException.class)
                .hasMessage(CARTA_NO_DISPONIBLE);
        carta.verify();
    }

    /** Deja dicho que se espera una consulta GET por ese platillo. */
    private ResponseActions esperarConsultaDelPlatillo(int id) {
        return carta.expect(requestTo(URL_DE_CARTA + "/api/platillos/" + id))
                .andExpect(method(HttpMethod.GET));
    }
}

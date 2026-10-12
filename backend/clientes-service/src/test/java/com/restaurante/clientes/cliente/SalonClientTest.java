package com.restaurante.clientes.cliente;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withResourceNotFound;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.client.ResponseActions;
import org.springframework.web.client.RestClient;

import com.restaurante.clientes.dto.CrearReservaDTO;
import com.restaurante.clientes.exception.ConflictoException;
import com.restaurante.clientes.exception.NoEncontradoException;
import com.restaurante.clientes.exception.ServicioNoDisponibleException;
import com.restaurante.clientes.model.Cliente;
import com.restaurante.clientes.repository.ClienteRepository;
import com.restaurante.clientes.repository.ReservaRepository;
import com.restaurante.clientes.service.ReservaService;

/**
 * Pruebas del cliente del salón contra un servidor simulado.
 *
 * No se levanta ningún servicio: el servidor simulado se engancha al mismo
 * constructor con el que se arma el cliente, así que las peticiones no salen a
 * la red y se puede dictar qué responde el salón en cada caso.
 */
class SalonClientTest {

    private static final String URL_DEL_SALON = "http://localhost:8084";
    private static final String SALON_NO_DISPONIBLE = "El salón no está disponible en este momento.";

    private MockRestServiceServer salon;
    private SalonClient cliente;

    @BeforeEach
    void prepararElSalonSimulado() {
        RestClient.Builder constructor = RestClient.builder().baseUrl(URL_DEL_SALON);
        this.salon = MockRestServiceServer.bindTo(constructor).build();
        this.cliente = new SalonClient(constructor.build());
    }

    @Test
    void elSalonDevuelveLaMesaYSeLeenSusDatos() {
        esperarConsultaDeLaMesa(2).andRespond(withSuccess(mesaComoJson(2, 2, 4), MediaType.APPLICATION_JSON));

        MesaRemota mesa = cliente.obtenerMesa(2L);

        assertThat(mesa.id()).isEqualTo(2L);
        assertThat(mesa.numero()).isEqualTo(2);
        assertThat(mesa.capacidad()).isEqualTo(4);
        salon.verify();
    }

    @Test
    void siElSalonNoTieneEsaMesaSeAvisaQueNoExiste() {
        esperarConsultaDeLaMesa(9).andRespond(withResourceNotFound());

        assertThatThrownBy(() -> cliente.obtenerMesa(9L))
                .isInstanceOf(NoEncontradoException.class)
                .hasMessage("La mesa 9 no existe.");
        salon.verify();
    }

    @Test
    void siLaMesaNoAlcanzaLaReservaSeRechazaSinGuardarse() {
        esperarConsultaDeLaMesa(2).andRespond(withSuccess(mesaComoJson(2, 2, 4), MediaType.APPLICATION_JSON));

        ClienteRepository clientes = mock(ClienteRepository.class);
        ReservaRepository reservas = mock(ReservaRepository.class);
        given(clientes.findById(1L))
                .willReturn(Optional.of(new Cliente("Ana Torres", "1001234567", "3001234567")));
        ReservaService servicio = new ReservaService(reservas, clientes, cliente);

        CrearReservaDTO paraSeis = new CrearReservaDTO(LocalDateTime.now().plusDays(1), 6, 1L, 2L, null);

        assertThatThrownBy(() -> servicio.crear(paraSeis))
                .isInstanceOf(ConflictoException.class)
                .hasMessage("La mesa 2 no alcanza para 6 personas. Su capacidad es de 4.");
        verify(reservas, never()).save(any());
        salon.verify();
    }

    @Test
    void siElSalonEstaApagadoSeAvisaQueNoEstaDisponible() {
        esperarConsultaDeLaMesa(2)
                .andRespond(withException(new IOException("No se pudo conectar con el salón")));

        assertThatThrownBy(() -> cliente.obtenerMesa(2L))
                .isInstanceOf(ServicioNoDisponibleException.class)
                .hasMessage(SALON_NO_DISPONIBLE);
        salon.verify();
    }

    /** Deja dicho que se espera una consulta GET por esa mesa. */
    private ResponseActions esperarConsultaDeLaMesa(int id) {
        return salon.expect(requestTo(URL_DEL_SALON + "/api/mesas/" + id))
                .andExpect(method(HttpMethod.GET));
    }

    private static String mesaComoJson(int id, int numero, int capacidad) {
        return """
                {"id": %d, "numero": %d, "capacidad": %d, "estado": "LIBRE"}
                """.formatted(id, numero, capacidad);
    }
}

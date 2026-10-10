package com.restaurante.salon;

import com.jayway.jsonpath.JsonPath;
import com.restaurante.salon.cliente.CartaClient;
import com.restaurante.salon.cliente.PlatilloRemoto;
import com.restaurante.salon.exception.NoEncontradoException;
import com.restaurante.salon.exception.ServicioNoDisponibleException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;

import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pruebas de agregar un platillo al pedido.
 *
 * La carta se simula para poder provocar a voluntad sus cuatro respuestas: el
 * platillo disponible, el agotado, el que no existe y la carta sin responder.
 * Que la llamada HTTP de verdad traduzca bien cada caso se comprueba aparte.
 *
 * La clase trabaja sobre su propia base de datos en memoria para no compartir
 * mesas ni pedidos con las demás pruebas.
 */
@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:salonplatillosdb;DB_CLOSE_DELAY=-1")
class AgregarPlatilloTest {

    private static final Long ID_BANDEJA = 1L;
    private static final Long ID_LIMONADA = 5L;
    private static final Long ID_DESCONOCIDO = 99L;

    @Autowired
    private WebApplicationContext contextoWeb;

    @MockitoBean
    private CartaClient cartaClient;

    private MockMvc mockMvc;

    @BeforeEach
    void prepararMockMvc() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(this.contextoWeb).build();
    }

    @Test
    void agregarUnPlatilloDisponibleGuardaElNombreYElPrecioDeLaCarta() throws Exception {
        given(cartaClient.obtener(ID_BANDEJA)).willReturn(
                new PlatilloRemoto(ID_BANDEJA, "Bandeja paisa", new BigDecimal("38000.00"), true));
        Long pedidoId = abrirPedidoEnMesaNueva(40);

        mockMvc.perform(agregar(pedidoId, ID_BANDEJA))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.platillos", hasSize(1)))
                .andExpect(jsonPath("$.platillos[0].platilloId", equalTo(ID_BANDEJA.intValue())))
                .andExpect(jsonPath("$.platillos[0].nombre", equalTo("Bandeja paisa")))
                .andExpect(jsonPath("$.platillos[0].precioUnitario", equalTo(38000.0)))
                .andExpect(jsonPath("$.total", equalTo(38000.0)));
    }

    @Test
    void agregarUnPlatilloAgotadoDevuelveConflicto() throws Exception {
        given(cartaClient.obtener(ID_LIMONADA)).willReturn(
                new PlatilloRemoto(ID_LIMONADA, "Limonada de coco", new BigDecimal("11000.00"), false));
        Long pedidoId = abrirPedidoEnMesaNueva(41);

        mockMvc.perform(agregar(pedidoId, ID_LIMONADA))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error", equalTo("El platillo Limonada de coco está agotado.")));
    }

    @Test
    void agregarUnPlatilloQueLaCartaNoConoceDevuelveNoEncontrado() throws Exception {
        given(cartaClient.obtener(ID_DESCONOCIDO))
                .willThrow(new NoEncontradoException("El platillo 99 no existe."));
        Long pedidoId = abrirPedidoEnMesaNueva(42);

        mockMvc.perform(agregar(pedidoId, ID_DESCONOCIDO))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error", equalTo("El platillo 99 no existe.")));
    }

    @Test
    void siLaCartaNoRespondeElPedidoAvisaQueNoEstaDisponible() throws Exception {
        given(cartaClient.obtener(ID_BANDEJA))
                .willThrow(new ServicioNoDisponibleException("La carta no está disponible en este momento."));
        Long pedidoId = abrirPedidoEnMesaNueva(43);

        mockMvc.perform(agregar(pedidoId, ID_BANDEJA))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error",
                                    equalTo("La carta no está disponible en este momento.")));
    }

    private static RequestBuilder agregar(Long pedidoId, Long platilloId) {
        return post("/api/pedidos/{id}/platillos", pedidoId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                            "platilloId": %d
                        }
                        """.formatted(platilloId));
    }

    /** Crea una mesa libre con ese número, abre un pedido en ella y devuelve su id. */
    private Long abrirPedidoEnMesaNueva(int numeroDeMesa) throws Exception {
        MvcResult mesaCreada = mockMvc.perform(post("/api/mesas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "numero": %d,
                                    "capacidad": 4
                                }
                                """.formatted(numeroDeMesa)))
                .andExpect(status().isCreated())
                .andReturn();

        MvcResult pedidoCreado = mockMvc.perform(post("/api/pedidos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "mesaId": %d,
                                    "meseroId": 2
                                }
                                """.formatted(leerId(mesaCreada))))
                .andExpect(status().isCreated())
                .andReturn();

        return leerId(pedidoCreado);
    }

    private static Long leerId(MvcResult resultado) throws Exception {
        Number id = JsonPath.read(resultado.getResponse().getContentAsString(), "$.id");
        return id.longValue();
    }
}

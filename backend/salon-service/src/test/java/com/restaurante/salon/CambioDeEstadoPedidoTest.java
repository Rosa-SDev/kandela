package com.restaurante.salon;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.hamcrest.Matchers.equalTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pruebas del cambio de estado del pedido.
 *
 * La clase trabaja sobre su propia base de datos en memoria para no compartir
 * mesas ni pedidos con las demás pruebas, y cada prueba abre la mesa y el
 * pedido que necesita y lee los identificadores de la respuesta en vez de
 * darlos por sabidos.
 */
@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:salonestadosdb;DB_CLOSE_DELAY=-1")
class CambioDeEstadoPedidoTest {

    @Autowired
    private WebApplicationContext contextoWeb;

    private MockMvc mockMvc;

    @BeforeEach
    void prepararMockMvc() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(this.contextoWeb).build();
    }

    @Test
    void enviarUnPedidoAbiertoACocinaDevuelveElPedidoEnCocina() throws Exception {
        Long pedidoId = abrirPedidoEnMesaNueva(20);

        mockMvc.perform(patch("/api/pedidos/{id}/estado", pedidoId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "estado": "EN_COCINA"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", equalTo(pedidoId.intValue())))
                .andExpect(jsonPath("$.estado", equalTo("EN_COCINA")));
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
                                    "meseroId": 2,
                                    "observaciones": "Sin cilantro"
                                }
                                """.formatted(leerId(mesaCreada))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estado", equalTo("ABIERTO")))
                .andReturn();

        return leerId(pedidoCreado);
    }

    private static Long leerId(MvcResult resultado) throws Exception {
        Number id = JsonPath.read(resultado.getResponse().getContentAsString(), "$.id");
        return id.longValue();
    }
}

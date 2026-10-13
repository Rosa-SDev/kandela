package com.restaurante.salon;

import com.jayway.jsonpath.JsonPath;
import com.restaurante.salon.cliente.UsuarioRemoto;
import com.restaurante.salon.cliente.UsuariosClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

    @MockitoBean
    private UsuariosClient usuariosClient;

    private MockMvc mockMvc;

    @BeforeEach
    void prepararMockMvc() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(this.contextoWeb).build();

        // El pedido se crea validando el mesero contra usuarios-service. Aquí se
        // simula esa consulta: lo que se prueba es el salón, no la llamada remota.
        given(usuariosClient.obtener(anyLong())).willAnswer(invocacion ->
                new UsuarioRemoto(invocacion.getArgument(0), "Mesero Demo", "mesero@raizysazon.co", "MESERO", true));
    }

    @Test
    void enviarUnPedidoAbiertoACocinaDevuelveElPedidoEnCocina() throws Exception {
        Long pedidoId = abrirPedidoEnMesaNueva(20);

        cambiarEstado(pedidoId, "EN_COCINA")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", equalTo(pedidoId.intValue())))
                .andExpect(jsonPath("$.estado", equalTo("EN_COCINA")));
    }

    @Test
    void elPedidoRecorreCocinaPreparacionYServido() throws Exception {
        Long pedidoId = abrirPedidoEnMesaNueva(21);

        cambiarEstado(pedidoId, "EN_COCINA").andExpect(status().isOk());
        cambiarEstado(pedidoId, "EN_PREPARACION").andExpect(status().isOk());
        cambiarEstado(pedidoId, "SERVIDO")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado", equalTo("SERVIDO")));
    }

    @Test
    void devolverUnPedidoServidoACocinaDevuelveConflicto() throws Exception {
        Long pedidoId = abrirPedidoEnMesaNueva(22);

        cambiarEstado(pedidoId, "EN_COCINA").andExpect(status().isOk());
        cambiarEstado(pedidoId, "EN_PREPARACION").andExpect(status().isOk());
        cambiarEstado(pedidoId, "SERVIDO").andExpect(status().isOk());

        cambiarEstado(pedidoId, "EN_COCINA")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error",
                                    equalTo("No se puede pasar un pedido de Servido a En cocina.")));
    }

    @Test
    void saltarseLaCocinaDevuelveConflicto() throws Exception {
        Long pedidoId = abrirPedidoEnMesaNueva(23);

        cambiarEstado(pedidoId, "SERVIDO")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error",
                                    equalTo("No se puede pasar un pedido de Abierto a Servido.")));
    }

    @Test
    void darPorPagadoUnPedidoSinFacturaDevuelveConflicto() throws Exception {
        Long pedidoId = abrirPedidoEnMesaNueva(24);

        cambiarEstado(pedidoId, "PAGADO")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error",
                                    equalTo("Un pedido solo pasa a pagado al emitir su factura.")));
    }

    @Test
    void cancelarUnPedidoEnPreparacionLiberaLaMesa() throws Exception {
        Long mesaId = crearMesa(25);
        Long pedidoId = abrirPedidoEn(mesaId);

        cambiarEstado(pedidoId, "EN_COCINA").andExpect(status().isOk());
        cambiarEstado(pedidoId, "EN_PREPARACION").andExpect(status().isOk());
        cambiarEstado(pedidoId, "CANCELADO")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado", equalTo("CANCELADO")));

        mockMvc.perform(get("/api/mesas/{id}", mesaId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado", equalTo("LIBRE")));
    }

    /** Pide el cambio de estado del pedido y devuelve el resultado sin comprobar nada. */
    private ResultActions cambiarEstado(Long pedidoId, String estado) throws Exception {
        return mockMvc.perform(patch("/api/pedidos/{id}/estado", pedidoId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                            "estado": "%s"
                        }
                        """.formatted(estado)));
    }

    /** Crea una mesa libre con ese número, abre un pedido en ella y devuelve su id. */
    private Long abrirPedidoEnMesaNueva(int numeroDeMesa) throws Exception {
        return abrirPedidoEn(crearMesa(numeroDeMesa));
    }

    /** Crea una mesa libre con ese número y devuelve su id. */
    private Long crearMesa(int numeroDeMesa) throws Exception {
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

        return leerId(mesaCreada);
    }

    /** Abre un pedido en esa mesa y devuelve su id. */
    private Long abrirPedidoEn(Long mesaId) throws Exception {
        MvcResult pedidoCreado = mockMvc.perform(post("/api/pedidos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "mesaId": %d,
                                    "meseroId": 2,
                                    "observaciones": "Sin cilantro"
                                }
                                """.formatted(mesaId)))
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

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
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pruebas de la nota del pedido.
 *
 * La clase trabaja sobre su propia base de datos en memoria para no compartir
 * mesas ni pedidos con las demás pruebas.
 */
@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:salonnotasdb;DB_CLOSE_DELAY=-1")
class NotaDelPedidoTest {

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
    void cambiarLaNotaDeUnPedidoAbiertoDevuelveLaNotaNueva() throws Exception {
        Long pedidoId = abrirPedidoEnMesaNueva(30);

        mockMvc.perform(patch("/api/pedidos/{id}", pedidoId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "observaciones": "Ajiaco sin alcaparras"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.observaciones", equalTo("Ajiaco sin alcaparras")));
    }

    @Test
    void enviarLaNotaVaciaLaDejaLimpia() throws Exception {
        Long pedidoId = abrirPedidoEnMesaNueva(31);

        mockMvc.perform(patch("/api/pedidos/{id}", pedidoId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "observaciones": ""
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.observaciones", equalTo("")));
    }

    @Test
    void cambiarLaNotaDeUnPedidoQueYaEstaEnCocinaDevuelveConflicto() throws Exception {
        Long pedidoId = abrirPedidoEnMesaNueva(32);

        mockMvc.perform(patch("/api/pedidos/{id}/estado", pedidoId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "estado": "EN_COCINA"
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/pedidos/{id}", pedidoId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "observaciones": "Ya no alcanza"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error",
                                    equalTo("Solo se puede cambiar la nota de un pedido abierto.")));
    }

    @Test
    void cambiarLaNotaDeUnPedidoQueNoExisteDevuelveNoEncontrado() throws Exception {
        mockMvc.perform(patch("/api/pedidos/{id}", 9999)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "observaciones": "Para nadie"
                                }
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error", equalTo("El pedido 9999 no existe.")));
    }

    @Test
    void unaNotaMasLargaQueLaColumnaSeRechazaIndicandoElCampo() throws Exception {
        Long pedidoId = abrirPedidoEnMesaNueva(33);
        String notaDemasiadoLarga = "a".repeat(256);

        mockMvc.perform(patch("/api/pedidos/{id}", pedidoId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "observaciones": "%s"
                                }
                                """.formatted(notaDemasiadoLarga)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", equalTo("La petición tiene campos inválidos")))
                .andExpect(jsonPath("$.campos.observaciones",
                                    equalTo("La nota no puede tener más de 255 caracteres.")));
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

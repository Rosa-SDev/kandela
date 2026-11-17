package com.restaurante.clientes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.jayway.jsonpath.JsonPath;
import com.restaurante.clientes.cliente.DecisionRemota;
import com.restaurante.clientes.cliente.SentiTriageClient;
import com.restaurante.clientes.contador.GeneradorDeIds;
import com.restaurante.clientes.exception.ServicioNoDisponibleException;
import com.restaurante.clientes.repository.ResenaRepository;

/**
 * Pruebas de integración de las reseñas contra un MongoDB real
 * (Testcontainers).
 *
 * El agente SentiTriage-ES se simula para dictar su decisión y para provocar
 * que no responda; la llamada HTTP de verdad se prueba en SentiTriageClientTest.
 * Además de la API, se miran los documentos guardados: la decisión va embebida
 * en la reseña y el id sale del contador.
 */
@SpringBootTest
@Import(MongoDePrueba.class)
class ResenaIntegracionTest {

    @Autowired
    private WebApplicationContext contextoWeb;

    @Autowired
    private ResenaRepository resenaRepository;

    @Autowired
    private GeneradorDeIds generadorDeIds;

    @Autowired
    private MongoTemplate mongo;

    @MockitoBean
    private SentiTriageClient sentiTriageClient;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(contextoWeb).build();
        resenaRepository.deleteAll();
        generadorDeIds.reiniciar();
    }

    private void elAgenteDecide(String accion, String etiqueta, double confianza) {
        given(sentiTriageClient.clasificar(anyLong(), anyString(), anyMap()))
                .willReturn(new DecisionRemota(accion, etiqueta, confianza, 0.5933, "beto-sentitriage", null));
    }

    private ResultActions enviarResena(String json) throws Exception {
        return mockMvc.perform(post("/api/resenas")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    private long crearResena(String texto) throws Exception {
        String respuesta = enviarResena("""
                        {"texto": "%s", "mesaId": 4}
                        """.formatted(texto))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(respuesta, "$.id")).longValue();
    }

    private Document documento(long id) {
        return mongo.getCollection("resenas").find(new Document("_id", id)).first();
    }

    @Test
    void unaQuejaQuedaGuardadaConLaDecisionEmbebida() throws Exception {
        elAgenteDecide("QUEUE", "negative", 0.84);

        enviarResena("""
                        {"texto": "La sopa llegó fría.", "mesaId": 4, "pedidoId": 12}
                        """)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.accion").value("QUEUE"))
                .andExpect(jsonPath("$.etiqueta").value("negative"))
                .andExpect(jsonPath("$.sinClasificar").value(false))
                .andExpect(jsonPath("$.revisada").value(false));

        Document guardada = documento(1L);
        assertThat(guardada.get("_id")).isInstanceOf(Long.class);
        assertThat(guardada.get("mesaId")).isEqualTo(4L);
        assertThat(guardada.get("pedidoId")).isEqualTo(12L);
        Document decision = guardada.get("decision", Document.class);
        assertThat(decision.get("accion")).isEqualTo("QUEUE");
        assertThat(decision.get("etiqueta")).isEqualTo("negative");
        assertThat(mongo.getCollection("contadores").find(new Document("_id", "resenas")).first()
                .get("valor")).isEqualTo(1L);
    }

    @Test
    void siElAgenteNoRespondeLaResenaSeGuardaParaQueLaLeaUnaPersona() throws Exception {
        given(sentiTriageClient.clasificar(anyLong(), anyString(), anyMap()))
                .willThrow(new ServicioNoDisponibleException("El agente de reseñas no está disponible en este momento."));

        enviarResena("""
                        {"texto": "No llegó nada."}
                        """)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accion").value("ABSTAIN"))
                .andExpect(jsonPath("$.sinClasificar").value(true));

        assertThat(resenaRepository.count()).isEqualTo(1);
    }

    @Test
    void sinTextoSeRechazaSinLlamarAlAgente() throws Exception {
        enviarResena("""
                        {"texto": "   "}
                        """)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.campos.texto").value("Escribe tu comentario"));

        verifyNoInteractions(sentiTriageClient);
        assertThat(resenaRepository.count()).isZero();
    }

    @Test
    void seFiltranPorDecisionYSeMarcanComoRevisadas() throws Exception {
        elAgenteDecide("QUEUE", "negative", 0.84);
        long queja = crearResena("Nadie nos atendió.");
        elAgenteDecide("PASS", "positive", 0.88);
        crearResena("Todo muy rico, gracias.");

        mockMvc.perform(get("/api/resenas").param("accion", "QUEUE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(queja));

        mockMvc.perform(patch("/api/resenas/{id}/revisada", queja)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"revisada": true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revisada").value(true));

        assertThat(documento(queja).getBoolean("revisada")).isTrue();
        mockMvc.perform(get("/api/resenas").param("revisada", "false"))
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void consultarUnaResenaQueNoExisteRespondeNoEncontrado() throws Exception {
        mockMvc.perform(get("/api/resenas/{id}", 99))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("No existe una reseña con id 99."));
    }
}

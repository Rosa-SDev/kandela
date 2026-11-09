package com.restaurante.carta;

import com.jayway.jsonpath.JsonPath;
import com.restaurante.carta.contador.GeneradorDeIds;
import com.restaurante.carta.model.Platillo;
import com.restaurante.carta.repository.PlatilloRepository;
import org.bson.Document;
import org.bson.types.Decimal128;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pruebas de integracion de la carta contra un MongoDB real (Testcontainers).
 *
 * Recorren la peticion completa: controlador, servicio, repositorio y base de
 * datos. Ademas miran los documentos tal como quedan guardados, para comprobar
 * lo que no se ve desde la API: el tipo del precio, el contador y el indice.
 *
 * Antes de cada prueba se vacian "platillos" y "contadores", asi que cada una
 * empieza con la carta vacia y el primer id que se reparte es 1.
 */
@SpringBootTest
@Import(MongoDePrueba.class)
class PlatilloIntegracionTest {

    @Autowired
    private WebApplicationContext contextoWeb;

    @Autowired
    private PlatilloRepository repositorio;

    @Autowired
    private GeneradorDeIds generadorDeIds;

    @Autowired
    private MongoTemplate mongo;

    @Autowired
    private DatosDeDemostracion datosDeDemostracion;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(contextoWeb).build();
        repositorio.deleteAll();
        generadorDeIds.reiniciar();
    }

    private static String json(String nombre, String categoria, String precio, boolean disponible) {
        return """
                {"nombre": "%s", "descripcion": "De prueba", "categoria": "%s",
                 "precio": %s, "disponible": %s}
                """.formatted(nombre, categoria, precio, disponible);
    }

    private long crear(String nombre, String categoria, String precio, boolean disponible) throws Exception {
        String respuesta = mockMvc.perform(post("/api/platillos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(nombre, categoria, precio, disponible)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(respuesta, "$.id")).longValue();
    }

    private Document documento(long id) {
        return mongo.getCollection("platillos").find(new Document("_id", id)).first();
    }

    // ---------- CRUD por HTTP ----------

    @Test
    void crudCompletoDeUnPlatillo() throws Exception {
        long id = crear("Changua", "Entradas", "14000", true);
        assertThat(id).isEqualTo(1L);

        mockMvc.perform(get("/api/platillos/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("Changua"))
                .andExpect(jsonPath("$.precio").value(14000.00));

        mockMvc.perform(put("/api/platillos/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("Changua boyacense", "Entradas", "16000", false)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.nombre").value("Changua boyacense"))
                .andExpect(jsonPath("$.disponible").value(false));

        mockMvc.perform(patch("/api/platillos/{id}/descuento", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"porcentaje\": 25}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.precio").value(12000.00));

        mockMvc.perform(delete("/api/platillos/{id}", id))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/platillos/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("El platillo 1 no existe."));
    }

    @Test
    void listarAplicaLosFiltrosDeCategoriaYDisponibilidad() throws Exception {
        crear("Bandeja paisa", "Fuertes", "38000", true);
        crear("Sobrebarriga al horno", "Fuertes", "36000", false);
        crear("Postre de natas", "Postres", "12000", true);

        mockMvc.perform(get("/api/platillos")).andExpect(jsonPath("$", hasSize(3)));
        mockMvc.perform(get("/api/platillos").param("categoria", "Fuertes"))
                .andExpect(jsonPath("$", hasSize(2)));
        mockMvc.perform(get("/api/platillos").param("disponible", "true"))
                .andExpect(jsonPath("$", hasSize(2)));
        mockMvc.perform(get("/api/platillos").param("categoria", "Fuertes").param("disponible", "true"))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].nombre").value("Bandeja paisa"));
    }

    // ---------- Como queda guardado en MongoDB ----------

    @Test
    void elIdSeGuardaComoNumeroYElPrecioComoDecimal128() throws Exception {
        long id = crear("Changua", "Entradas", "14000", true);

        Document guardado = documento(id);
        assertThat(guardado.get("_id")).isInstanceOf(Long.class);
        assertThat(guardado.get("precio")).isInstanceOf(Decimal128.class);
        assertThat(((Decimal128) guardado.get("precio")).bigDecimalValue())
                .isEqualTo(new BigDecimal("14000.00"));
    }

    @Test
    void elContadorAvanzaConCadaPlatilloCreado() throws Exception {
        assertThat(crear("Arepa de choclo", "Entradas", "9000", true)).isEqualTo(1L);
        assertThat(crear("Ajiaco santafereño", "Sopas", "28000", true)).isEqualTo(2L);

        Document contador = mongo.getCollection("contadores").find(new Document("_id", "platillos")).first();
        assertThat(contador.get("valor", Number.class).longValue()).isEqualTo(2L);
    }

    // ---------- Unicidad del nombre ----------

    @Test
    void crearConUnNombreRepetidoEnOtraCapitalizacionRespondeConflicto() throws Exception {
        crear("Bandeja paisa", "Fuertes", "38000", true);

        mockMvc.perform(post("/api/platillos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("BANDEJA PAISA", "Fuertes", "38000", true)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Ya existe un platillo con el nombre BANDEJA PAISA."));

        assertThat(repositorio.count()).isEqualTo(1);
    }

    @Test
    void elIndiceUnicoRechazaElNombreRepetidoAunqueSeSalteElServicio() throws Exception {
        crear("Bandeja paisa", "Fuertes", "38000", true);

        Platillo repetido = new Platillo("bandeja PAISA", null, "Fuertes", new BigDecimal("1000"), true);
        repetido.asignarId(99L);

        assertThatThrownBy(() -> repositorio.insert(repetido))
                .isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    void elIndiceUnicoRespetaLasTildes() throws Exception {
        crear("Ajiaco", "Sopas", "28000", true);

        Platillo conTilde = new Platillo("Ajiacó", null, "Sopas", new BigDecimal("28000"), true);
        conTilde.asignarId(99L);
        repositorio.insert(conTilde);

        assertThat(repositorio.count()).isEqualTo(2);
    }

    /**
     * existsByNombreIgnoreCase se traduce a una expresion regular de MongoDB.
     * Si Spring no escapara los caracteres especiales, "(" ")" y "." del nombre
     * funcionarian como operadores: "Arroz (porción)." coincidiria tambien con
     * "Arroz porciónX", y un nombre distinto se tomaria como repetido.
     */
    @Test
    void existsByNombreIgnoreCaseTrataLosCaracteresEspecialesComoTexto() throws Exception {
        crear("Arroz (porción).", "Acompañamientos", "5000", true);
        crear("Arroz porciónX", "Acompañamientos", "5000", true);

        assertThat(repositorio.existsByNombreIgnoreCase("arroz (PORCIÓN).")).isTrue();
        assertThat(repositorio.existsByNombreIgnoreCase("Arroz (porción)")).isFalse();
        assertThat(repositorio.existsByNombreIgnoreCase("Arroz (porción)X")).isFalse();
        assertThat(repositorio.existsByNombreIgnoreCase("Arroz .*")).isFalse();
    }

    // ---------- Datos de demostracion sin el perfil demo ----------

    @Test
    void sinElPerfilDemoLosDatosSoloSeCarganSiLaColeccionEstaVacia() throws Exception {
        datosDeDemostracion.run();
        assertThat(repositorio.count()).isEqualTo(6);
        assertThat(repositorio.findById(1L)).get()
                .extracting(Platillo::getNombre).isEqualTo("Arepa de choclo");

        crear("Changua", "Entradas", "14000", true);
        datosDeDemostracion.run();

        assertThat(repositorio.count()).isEqualTo(7);
    }
}

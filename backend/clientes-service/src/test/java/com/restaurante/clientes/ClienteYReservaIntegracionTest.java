package com.restaurante.clientes;

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

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import org.bson.Document;
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

import com.jayway.jsonpath.JsonPath;
import com.restaurante.clientes.config.DatosDePrueba;
import com.restaurante.clientes.contador.GeneradorDeIds;
import com.restaurante.clientes.model.Cliente;
import com.restaurante.clientes.repository.ClienteRepository;
import com.restaurante.clientes.repository.ReservaRepository;

/**
 * Pruebas de integración de clientes y reservas contra un MongoDB real
 * (Testcontainers).
 *
 * Recorren la petición completa y además miran los documentos tal como quedan
 * guardados, para comprobar lo que no se ve desde la API: que la reserva solo
 * guarda el id del cliente, los contadores y el índice del documento.
 *
 * Las reservas se crean sin mesa, así que no se consulta al salón: lo que pasa
 * con la mesa se prueba en CapacidadDeLaReservaTest.
 *
 * Antes de cada prueba se vacían "reservas", "clientes" y "contadores".
 */
@SpringBootTest
@Import(MongoDePrueba.class)
class ClienteYReservaIntegracionTest {

    @Autowired
    private WebApplicationContext contextoWeb;

    @Autowired
    private ClienteRepository clienteRepository;

    @Autowired
    private ReservaRepository reservaRepository;

    @Autowired
    private GeneradorDeIds generadorDeIds;

    @Autowired
    private MongoTemplate mongo;

    @Autowired
    private DatosDePrueba datosDePrueba;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(contextoWeb).build();
        reservaRepository.deleteAll();
        clienteRepository.deleteAll();
        generadorDeIds.reiniciar();
    }

    private long crearCliente(String nombre, String documento, String telefono) throws Exception {
        String respuesta = mockMvc.perform(post("/api/clientes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nombre": "%s", "documento": "%s", "telefono": "%s"}
                                """.formatted(nombre, documento, telefono)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(respuesta, "$.id")).longValue();
    }

    private long crearReserva(long clienteId, int personas) throws Exception {
        String manana = LocalDateTime.now().plusDays(1).withHour(19).withMinute(0).withSecond(0).withNano(0)
                .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        String respuesta = mockMvc.perform(post("/api/reservas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fechaHora": "%s", "numPersonas": %d, "clienteId": %d}
                                """.formatted(manana, personas, clienteId)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(respuesta, "$.id")).longValue();
    }

    private Document documento(String coleccion, long id) {
        return mongo.getCollection(coleccion).find(new Document("_id", id)).first();
    }

    // ---------- CRUD de clientes por HTTP ----------

    @Test
    void crudCompletoDeUnCliente() throws Exception {
        long id = crearCliente("Ana Torres", "1001234567", "3001234567");
        assertThat(id).isEqualTo(1L);

        mockMvc.perform(get("/api/clientes/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("Ana Torres"));

        mockMvc.perform(put("/api/clientes/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nombre": "Ana María Torres", "documento": "1001234567", "telefono": "3150000000"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.telefono").value("3150000000"));

        mockMvc.perform(get("/api/clientes").param("nombre", "maría"))
                .andExpect(jsonPath("$", hasSize(1)));

        mockMvc.perform(delete("/api/clientes/{id}", id))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/clientes/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("No existe un cliente con id 1."));
        assertThat(documento("clientes", id)).isNull();
    }

    // ---------- Reservas: referencia al cliente ----------

    @Test
    void laReservaGuardaSoloElIdDelClienteYMuestraSuNombreActual() throws Exception {
        long ana = crearCliente("Ana Torres", "1001234567", "3001234567");
        long reserva = crearReserva(ana, 4);

        Document guardada = documento("reservas", reserva);
        assertThat(guardada.get("_id")).isInstanceOf(Long.class);
        assertThat(guardada.get("clienteId")).isEqualTo(ana);
        assertThat(guardada.containsKey("cliente")).isFalse();
        assertThat(guardada.get("estado")).isEqualTo("PENDIENTE");

        // El cliente cambia de nombre: como la reserva no guarda una copia, lo ve de inmediato.
        mockMvc.perform(put("/api/clientes/{id}", ana)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nombre": "Ana María Torres", "documento": "1001234567", "telefono": "3150000000"}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/reservas"))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].clienteId").value(ana))
                .andExpect(jsonPath("$[0].clienteNombre").value("Ana María Torres"));
    }

    @Test
    void crudCompletoDeUnaReserva() throws Exception {
        long luis = crearCliente("Luis Ramírez", "1007654321", "3007654321");
        long id = crearReserva(luis, 2);

        mockMvc.perform(get("/api/reservas/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clienteNombre").value("Luis Ramírez"));

        mockMvc.perform(patch("/api/reservas/{id}/estado", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nuevoEstado\": \"CONFIRMADA\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("CONFIRMADA"));
        assertThat(documento("reservas", id).get("estado")).isEqualTo("CONFIRMADA");

        mockMvc.perform(get("/api/reservas").param("estado", "CONFIRMADA"))
                .andExpect(jsonPath("$", hasSize(1)));
        mockMvc.perform(get("/api/reservas").param("estado", "PENDIENTE"))
                .andExpect(jsonPath("$", hasSize(0)));

        mockMvc.perform(delete("/api/reservas/{id}", id))
                .andExpect(status().isNoContent());
        assertThat(documento("reservas", id)).isNull();
    }

    @Test
    void noSePuedeEliminarUnClienteQueTieneReservas() throws Exception {
        long marcela = crearCliente("Marcela Gómez", "1009988776", "3009988776");
        crearReserva(marcela, 6);

        mockMvc.perform(delete("/api/clientes/{id}", marcela))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error")
                        .value("No se puede eliminar el cliente Marcela Gómez porque tiene reservas asociadas."));

        assertThat(clienteRepository.existsById(marcela)).isTrue();
    }

    @Test
    void cadaColeccionLlevaSuPropioContador() throws Exception {
        long ana = crearCliente("Ana Torres", "1001234567", "3001234567");
        crearCliente("Luis Ramírez", "1007654321", "3007654321");
        assertThat(crearReserva(ana, 2)).isEqualTo(1L);

        assertThat(mongo.getCollection("contadores").find(new Document("_id", "clientes")).first()
                .get("valor")).isEqualTo(2L);
        assertThat(mongo.getCollection("contadores").find(new Document("_id", "reservas")).first()
                .get("valor")).isEqualTo(1L);
    }

    // ---------- Unicidad del documento ----------

    @Test
    void crearConUnDocumentoRepetidoRespondeConflicto() throws Exception {
        crearCliente("Ana Torres", "1001234567", "3001234567");

        mockMvc.perform(post("/api/clientes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nombre": "Otra Ana", "documento": "1001234567"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Ya existe un cliente con el documento 1001234567."));

        assertThat(clienteRepository.count()).isEqualTo(1);
    }

    @Test
    void elIndiceUnicoRechazaElDocumentoRepetidoAunqueSeSalteElServicio() throws Exception {
        crearCliente("Ana Torres", "1001234567", "3001234567");

        Cliente repetido = new Cliente("Otra Ana", "1001234567", null);
        repetido.asignarId(99L);

        assertThatThrownBy(() -> clienteRepository.insert(repetido))
                .isInstanceOf(DuplicateKeyException.class);
    }

    // ---------- Datos de demostración sin el perfil demo ----------

    @Test
    void sinElPerfilDemoLosDatosSoloSeCarganSiNoHayClientes() throws Exception {
        datosDePrueba.run();
        assertThat(clienteRepository.count()).isEqualTo(3);
        assertThat(reservaRepository.count()).isEqualTo(3);
        assertThat(clienteRepository.findById(1L)).get()
                .extracting(Cliente::getNombre).isEqualTo("Ana Torres");

        crearCliente("Pedro Gómez", "1012345678", "3012345678");
        datosDePrueba.run();

        assertThat(clienteRepository.count()).isEqualTo(4);
        assertThat(reservaRepository.count()).isEqualTo(3);
    }
}

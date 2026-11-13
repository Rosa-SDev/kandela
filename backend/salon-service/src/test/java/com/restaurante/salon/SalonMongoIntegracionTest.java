package com.restaurante.salon;

import com.jayway.jsonpath.JsonPath;
import com.restaurante.salon.cliente.CartaClient;
import com.restaurante.salon.cliente.PlatilloRemoto;
import com.restaurante.salon.cliente.UsuarioRemoto;
import com.restaurante.salon.cliente.UsuariosClient;
import com.restaurante.salon.contador.GeneradorDeIds;
import com.restaurante.salon.model.EstadoMesa;
import com.restaurante.salon.model.EstadoPedido;
import com.restaurante.salon.model.Factura;
import com.restaurante.salon.model.Mesa;
import com.restaurante.salon.model.Pedido;
import com.restaurante.salon.repository.FacturaRepository;
import com.restaurante.salon.repository.MesaRepository;
import com.restaurante.salon.repository.PedidoRepository;
import org.bson.Document;
import org.bson.types.Decimal128;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pruebas de integración de salon-service contra MongoDB real en Testcontainers.
 *
 * Además de comprobar las respuestas HTTP, inspecciona directamente los
 * documentos guardados en las colecciones para verificar que:
 * - después de cobrar o cancelar, la mesa queda LIBRE en MongoDB;
 * - las líneas del pedido se guardan embebidas dentro de "pedidos";
 * - los importes se almacenan como Decimal128 y los ids como Long;
 * - los índices únicos rechazan números repetidos de mesa y factura.
 */
@SpringBootTest
@Import(MongoDePrueba.class)
class SalonMongoIntegracionTest {

    private static final Long ID_AREPA = 1L;
    private static final Long ID_BANDEJA = 3L;

    @Autowired
    private WebApplicationContext contextoWeb;

    @Autowired
    private MesaRepository mesaRepository;

    @Autowired
    private PedidoRepository pedidoRepository;

    @Autowired
    private FacturaRepository facturaRepository;

    @Autowired
    private GeneradorDeIds generadorDeIds;

    @Autowired
    private MongoTemplate mongo;

    @Autowired
    private DatosDeDemostracion datosDeDemostracion;

    @MockitoBean
    private CartaClient cartaClient;

    @MockitoBean
    private UsuariosClient usuariosClient;

    private MockMvc mockMvc;

    @BeforeEach
    void preparar() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(this.contextoWeb).build();
        limpiarBase();

        given(usuariosClient.obtener(anyLong())).willAnswer(invocacion -> {
            Long id = invocacion.getArgument(0);
            if (id.equals(5L)) {
                return new UsuarioRemoto(id, "Laura Cajera", "cajera@raizysazon.co", "CAJERO", true);
            }
            return new UsuarioRemoto(id, "Carlos Mesero", "mesero@raizysazon.co", "MESERO", true);
        });

        given(cartaClient.obtener(ID_AREPA)).willReturn(
                new PlatilloRemoto(ID_AREPA, "Arepa de choclo", new BigDecimal("9000.00"), true));
        given(cartaClient.obtener(ID_BANDEJA)).willReturn(
                new PlatilloRemoto(ID_BANDEJA, "Bandeja paisa", new BigDecimal("38000.00"), true));
    }

    @AfterEach
    void restaurarEstadoDemo() {
        limpiarBase();
        datosDeDemostracion.run();
    }

    private void limpiarBase() {
        facturaRepository.deleteAll();
        pedidoRepository.deleteAll();
        mesaRepository.deleteAll();
        generadorDeIds.reiniciar();
    }

    @Test
    void despuesDeCobrarLaMesaQuedaLibreElPedidoPagadoYLasLineasEmbebidasEnMongoDB() throws Exception {
        Long mesaId = crearMesa(50, 4);
        assertThat(mesaRepository.findById(mesaId)).get()
                .extracting(Mesa::getEstado).isEqualTo(EstadoMesa.LIBRE);

        Long pedidoId = abrirPedido(mesaId);
        assertThat(mesaRepository.findById(mesaId)).get()
                .extracting(Mesa::getEstado).isEqualTo(EstadoMesa.OCUPADA);

        agregarPlatillo(pedidoId, ID_BANDEJA);
        agregarPlatillo(pedidoId, ID_AREPA);

        // Consumo = 47000.00, Impuesto 8% = 3760.00, Total = 50760.00
        Long facturaId = emitirFactura(pedidoId, "55000.00");

        // Verificación directa en los repositorios tras la transacción de cobro
        Mesa mesaEnBase = mesaRepository.findById(mesaId).orElseThrow();
        Pedido pedidoEnBase = pedidoRepository.findById(pedidoId).orElseThrow();
        Factura facturaEnBase = facturaRepository.findById(facturaId).orElseThrow();

        assertThat(mesaEnBase.getEstado()).isEqualTo(EstadoMesa.LIBRE);
        assertThat(pedidoEnBase.getEstado()).isEqualTo(EstadoPedido.PAGADO);
        assertThat(facturaEnBase.getNumero()).isEqualTo("F-0001");
        assertThat(facturaEnBase.getTotal()).isEqualByComparingTo("50760.00");

        // Inspección BSON del documento "pedidos": líneas embebidas, _id Long y Decimal128
        Document docPedido = mongo.getCollection("pedidos").find(new Document("_id", pedidoId)).first();
        assertThat(docPedido).isNotNull();
        assertThat(docPedido.get("_id")).isInstanceOf(Long.class);
        assertThat(docPedido.get("mesaId")).isEqualTo(mesaId);
        assertThat(docPedido.get("estado")).isEqualTo("PAGADO");
        assertThat(docPedido.get("montoPagado")).isInstanceOf(Decimal128.class);

        List<Document> lineasEmbebidas = docPedido.getList("platillos", Document.class);
        assertThat(lineasEmbebidas).hasSize(2);
        assertThat(lineasEmbebidas.get(0).get("_id")).isInstanceOf(Long.class);
        assertThat(lineasEmbebidas.get(0).getString("nombre")).isEqualTo("Bandeja paisa");
        assertThat(lineasEmbebidas.get(0).get("precioUnitario")).isInstanceOf(Decimal128.class);
        assertThat(mongo.collectionExists("pedido_platillos")).isFalse();

        // Inspección BSON del documento "facturas"
        Document docFactura = mongo.getCollection("facturas").find(new Document("_id", facturaId)).first();
        assertThat(docFactura).isNotNull();
        assertThat(docFactura.get("_id")).isInstanceOf(Long.class);
        assertThat(docFactura.get("subtotal")).isInstanceOf(Decimal128.class);
        assertThat(docFactura.get("impuestos")).isInstanceOf(Decimal128.class);
        assertThat(docFactura.get("total")).isInstanceOf(Decimal128.class);
        assertThat(((Decimal128) docFactura.get("total")).bigDecimalValue())
                .isEqualByComparingTo("50760.00");
    }

    @Test
    void cancelarUnPedidoDejaLaMesaLibreEnMongoDB() throws Exception {
        Long mesaId = crearMesa(51, 2);
        Long pedidoId = abrirPedido(mesaId);
        assertThat(mesaRepository.findById(mesaId)).get()
                .extracting(Mesa::getEstado).isEqualTo(EstadoMesa.OCUPADA);

        mockMvc.perform(patch("/api/pedidos/{id}/estado", pedidoId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"estado\": \"EN_COCINA\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/pedidos/{id}/estado", pedidoId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"estado\": \"CANCELADO\"}"))
                .andExpect(status().isOk());

        assertThat(pedidoRepository.findById(pedidoId)).get()
                .extracting(Pedido::getEstado).isEqualTo(EstadoPedido.CANCELADO);
        assertThat(mesaRepository.findById(mesaId)).get()
                .extracting(Mesa::getEstado).isEqualTo(EstadoMesa.LIBRE);
    }

    @Test
    void losIndicesUnicosRechazanMesaYFacturaConNumeroRepetido() throws Exception {
        crearMesa(52, 4);
        Mesa mesaDuplicada = new Mesa(52, 6);
        mesaDuplicada.asignarId(99L);

        assertThatThrownBy(() -> mesaRepository.insert(mesaDuplicada))
                .isInstanceOf(DuplicateKeyException.class);

        Factura primera = new Factura("F-0001", 1L, 5L);
        primera.asignarId(1L);
        facturaRepository.insert(primera);

        Factura facturaDuplicada = new Factura("F-0001", 2L, 5L);
        facturaDuplicada.asignarId(2L);

        assertThatThrownBy(() -> facturaRepository.insert(facturaDuplicada))
                .isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    void sinElPerfilDemoLosDatosSoloSeCarganSiLasColeccionesEstanVacias() throws Exception {
        datosDeDemostracion.run();
        assertThat(mesaRepository.count()).isEqualTo(7);
        assertThat(pedidoRepository.count()).isEqualTo(3);

        crearMesa(80, 4);
        datosDeDemostracion.run();

        assertThat(mesaRepository.count()).isEqualTo(8);
        assertThat(pedidoRepository.count()).isEqualTo(3);
    }

    @Test
    void openApiExponeLasRutasDeMesasPedidosYFacturas() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("/api/mesas")))
                .andExpect(content().string(containsString("/api/pedidos")))
                .andExpect(content().string(containsString("/api/facturas")));
    }

    private Long crearMesa(int numero, int capacidad) throws Exception {
        MvcResult resultado = mockMvc.perform(post("/api/mesas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"numero\": %d, \"capacidad\": %d}".formatted(numero, capacidad)))
                .andExpect(status().isCreated())
                .andReturn();
        return leerId(resultado);
    }

    private Long abrirPedido(Long mesaId) throws Exception {
        MvcResult resultado = mockMvc.perform(post("/api/pedidos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mesaId\": %d, \"meseroId\": 2}".formatted(mesaId)))
                .andExpect(status().isCreated())
                .andReturn();
        return leerId(resultado);
    }

    private void agregarPlatillo(Long pedidoId, Long platilloId) throws Exception {
        mockMvc.perform(post("/api/pedidos/{id}/platillos", pedidoId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"platilloId\": %d}".formatted(platilloId)))
                .andExpect(status().isCreated());
    }

    private Long emitirFactura(Long pedidoId, String monto) throws Exception {
        MvcResult resultado = mockMvc.perform(post("/api/facturas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pedidoId\": %d, \"cajeroId\": 5, \"metodoPago\": \"EFECTIVO\", \"monto\": %s}"
                                .formatted(pedidoId, monto)))
                .andExpect(status().isCreated())
                .andReturn();
        return leerId(resultado);
    }

    private static Long leerId(MvcResult resultado) throws Exception {
        Number id = JsonPath.read(resultado.getResponse().getContentAsString(), "$.id");
        return id.longValue();
    }
}

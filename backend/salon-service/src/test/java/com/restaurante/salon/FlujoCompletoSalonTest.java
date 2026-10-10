package com.restaurante.salon;

import com.jayway.jsonpath.JsonPath;
import com.restaurante.salon.cliente.CartaClient;
import com.restaurante.salon.cliente.PlatilloRemoto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;

import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Prueba de integración del recorrido completo del salón, de punta a punta:
 * 1. POST /api/mesas → crea una mesa LIBRE (201).
 * 2. POST /api/pedidos → abre pedido sobre esa mesa (201) y la mesa queda OCUPADA.
 * 3. POST /api/pedidos/{id}/platillos dos veces → dos líneas agregadas (201).
 * 4. POST /api/pedidos sobre la misma mesa → 409 Conflict.
 * 5. POST /api/facturas con monto insuficiente → 409 Conflict.
 * 6. POST /api/facturas con monto correcto → 201 Created, pedido PAGADO y mesa vuelve a LIBRE.
 * 7. GET /api/mesas/{id} → confirma estado LIBRE.
 * 8. DELETE /api/facturas/{id} → 200 OK y factura anulada.
 *
 * La mesa, el pedido y la factura se identifican con el id que devolvió el POST
 * que los creó, nunca con un número escrito a mano: la base de datos en memoria
 * se comparte entre clases de prueba y los id dependen de cuántas filas se
 * hayan creado antes. El número de la mesa sí es fijo, porque es un dato de
 * negocio y no un identificador que reparta la base de datos.
 *
 * La carta se simula: aquí se comprueba el recorrido del salón, no la llamada
 * HTTP a otro servicio, que tiene su propia prueba.
 */
@SpringBootTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class FlujoCompletoSalonTest {

    private static final Long ID_HAMBURGUESA = 101L;
    private static final Long ID_LIMONADA = 102L;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @MockitoBean
    private CartaClient cartaClient;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(this.webApplicationContext).build();

        given(cartaClient.obtener(ID_HAMBURGUESA)).willReturn(
                new PlatilloRemoto(ID_HAMBURGUESA, "Hamburguesa artesanal",
                                   new BigDecimal("25000.00"), true));
        given(cartaClient.obtener(ID_LIMONADA)).willReturn(
                new PlatilloRemoto(ID_LIMONADA, "Limonada de coco",
                                   new BigDecimal("5000.00"), true));
    }

    @Test
    @Order(1)
    void flujoCompletoMesaPedidoFactura() throws Exception {
        // 1. Crear una mesa 10 con capacidad 4
        MvcResult mesaCreada = mockMvc.perform(post("/api/mesas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "numero": 10,
                                    "capacidad": 4
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.numero", equalTo(10)))
                .andExpect(jsonPath("$.estado", equalTo("LIBRE")))
                .andReturn();
        Long mesaId = leerId(mesaCreada);

        // 2. Abrir un pedido en la mesa 10
        MvcResult pedidoAbierto = mockMvc.perform(post("/api/pedidos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "mesaId": %d,
                                    "meseroId": 2,
                                    "clienteId": 1,
                                    "observaciones": "Cerca a la ventana"
                                }
                                """.formatted(mesaId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estado", equalTo("ABIERTO")))
                .andExpect(jsonPath("$.mesaNumero", equalTo(10)))
                .andReturn();
        Long pedidoId = leerId(pedidoAbierto);

        // Verificar que la mesa 10 ahora está OCUPADA
        mockMvc.perform(get("/api/mesas/{id}", mesaId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado", equalTo("OCUPADA")));

        // 3. Agregar platillos dos veces (dos líneas desnormalizadas)
        // Platillo 1: Hamburguesa 25000.00
        mockMvc.perform(post("/api/pedidos/{id}/platillos", pedidoId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "platilloId": 101
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.platillos", hasSize(1)))
                .andExpect(jsonPath("$.total", equalTo(25000.0)));

        // Platillo 2: Limonada 5000.00 -> total sin impuestos = 30000.00
        mockMvc.perform(post("/api/pedidos/{id}/platillos", pedidoId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "platilloId": 102
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.platillos", hasSize(2)))
                .andExpect(jsonPath("$.total", equalTo(30000.0)));

        // 4. Intentar abrir otro pedido sobre la misma mesa → 409 Conflict
        mockMvc.perform(post("/api/pedidos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "mesaId": %d,
                                    "meseroId": 3,
                                    "observaciones": "Intento duplicado"
                                }
                                """.formatted(mesaId)))
                .andExpect(status().isConflict());

        // 5. Intentar emitir factura con monto insuficiente:
        // Consumo = 30000.00, Impuesto 8% = 2400.00, Total = 32400.00.
        // Si entregamos 30000.00 -> debe rechazar con 409 Conflict
        mockMvc.perform(post("/api/facturas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "pedidoId": %d,
                                    "cajeroId": 5,
                                    "metodoPago": "EFECTIVO",
                                    "monto": 30000.00
                                }
                                """.formatted(pedidoId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error",
                                    equalTo("El monto no cubre el total de la factura ($32400.00).")));

        // 6. Emitir factura con monto suficiente (35000.00) → 201 Created
        MvcResult facturaEmitida = mockMvc.perform(post("/api/facturas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "pedidoId": %d,
                                    "cajeroId": 5,
                                    "metodoPago": "EFECTIVO",
                                    "monto": 35000.00
                                }
                                """.formatted(pedidoId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.numero", equalTo("F-0001")))
                .andExpect(jsonPath("$.subtotal", equalTo(30000.0)))
                .andExpect(jsonPath("$.impuestos", equalTo(2400.0)))
                .andExpect(jsonPath("$.total", equalTo(32400.0)))
                .andExpect(jsonPath("$.anulada", equalTo(false)))
                .andReturn();
        Long facturaId = leerId(facturaEmitida);

        // Verificar que el pedido quedó en estado PAGADO
        mockMvc.perform(get("/api/pedidos/{id}", pedidoId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado", equalTo("PAGADO")));

        // 7. La mesa volvió a estado LIBRE automáticamente
        mockMvc.perform(get("/api/mesas/{id}", mesaId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado", equalTo("LIBRE")));

        // 8. Anular la factura devuelve 200 OK con anulada = true
        mockMvc.perform(delete("/api/facturas/{id}", facturaId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.anulada", equalTo(true)));

        // Intentar anularla nuevamente → 409 Conflict (ya está anulada)
        mockMvc.perform(delete("/api/facturas/{id}", facturaId))
                .andExpect(status().isConflict());
    }

    /** Devuelve el id que trae el cuerpo de la respuesta. */
    private static Long leerId(MvcResult resultado) throws Exception {
        Number id = JsonPath.read(resultado.getResponse().getContentAsString(), "$.id");
        return id.longValue();
    }
}

package com.restaurante.clientes;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.atomic.AtomicInteger;

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

import com.jayway.jsonpath.JsonPath;
import com.restaurante.clientes.cliente.MesaRemota;
import com.restaurante.clientes.cliente.SalonClient;
import com.restaurante.clientes.exception.NoEncontradoException;
import com.restaurante.clientes.exception.ServicioNoDisponibleException;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pruebas de la mesa al registrar una reserva.
 *
 * El salón se simula para poder provocar a voluntad sus tres respuestas: la
 * mesa que existe, la que no existe y el salón sin responder. Que la llamada
 * HTTP de verdad traduzca bien cada caso se comprueba aparte.
 *
 * La clase trabaja sobre su propia base de datos en memoria y crea el cliente
 * que necesita, para no depender de los datos de demostración ni compartir
 * reservas con las demás pruebas. El documento lleva un contador porque la
 * base vive durante toda la clase y el documento es único.
 */
@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:clientesreservasdb;DB_CLOSE_DELAY=-1")
class CapacidadDeLaReservaTest {

    private static final Long ID_MESA_DE_CUATRO = 2L;
    private static final Long ID_DESCONOCIDO = 99L;
    private static final AtomicInteger SIGUIENTE_DOCUMENTO = new AtomicInteger(900000001);

    @Autowired
    private WebApplicationContext contextoWeb;

    @MockitoBean
    private SalonClient salonClient;

    private MockMvc mockMvc;
    private Long idDelCliente;

    @BeforeEach
    void prepararMockMvcYElCliente() throws Exception {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(this.contextoWeb).build();
        this.idDelCliente = crearCliente();
    }

    @Test
    void siLaMesaAlcanzaLaReservaQuedaRegistrada() throws Exception {
        given(salonClient.obtener(ID_MESA_DE_CUATRO))
                .willReturn(new MesaRemota(ID_MESA_DE_CUATRO, 2, 4));

        pedirReserva(4, ID_MESA_DE_CUATRO)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estado").value("PENDIENTE"))
                .andExpect(jsonPath("$.mesaId").value(ID_MESA_DE_CUATRO));
    }

    @Test
    void siLaMesaNoAlcanzaSeRechazaConElMensajeDeSuCapacidad() throws Exception {
        given(salonClient.obtener(ID_MESA_DE_CUATRO))
                .willReturn(new MesaRemota(ID_MESA_DE_CUATRO, 2, 4));

        pedirReserva(6, ID_MESA_DE_CUATRO)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error")
                        .value("La mesa 2 no alcanza para 6 personas. Su capacidad es de 4."));
    }

    @Test
    void unaReservaSinMesaNoConsultaAlSalon() throws Exception {
        pedirReserva(6, null)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mesaId").value(nullValue()));

        verifyNoInteractions(salonClient);
    }

    @Test
    void siLaMesaNoExisteSeAvisaQueNoExiste() throws Exception {
        willThrow(new NoEncontradoException("La mesa 99 no existe."))
                .given(salonClient).obtener(ID_DESCONOCIDO);

        pedirReserva(2, ID_DESCONOCIDO)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("La mesa 99 no existe."));
    }

    @Test
    void siElSalonNoRespondeSeAvisaQueNoEstaDisponible() throws Exception {
        willThrow(new ServicioNoDisponibleException("El salón no está disponible en este momento."))
                .given(salonClient).obtener(ID_MESA_DE_CUATRO);

        pedirReserva(2, ID_MESA_DE_CUATRO)
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("El salón no está disponible en este momento."));
    }

    @Test
    void siFaltanCamposObligatoriosVienenDentroDelFormatoComun() throws Exception {
        mockMvc.perform(post("/api/reservas")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("La petición tiene campos inválidos"))
                .andExpect(jsonPath("$.campos.clienteId").value("El cliente es obligatorio"))
                .andExpect(jsonPath("$.campos.fechaHora").value("La fecha y hora son obligatorias"));
    }

    /** Pide una reserva para mañana a las 19:00, con o sin mesa asignada. */
    private ResultActions pedirReserva(int numPersonas, Long mesaId) throws Exception {
        String manana = LocalDateTime.now().plusDays(1)
                .withHour(19).withMinute(0).withSecond(0).withNano(0)
                .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);

        return mockMvc.perform(post("/api/reservas")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                            "fechaHora": "%s",
                            "numPersonas": %d,
                            "clienteId": %d,
                            "mesaId": %s
                        }
                        """.formatted(manana, numPersonas, idDelCliente,
                                mesaId == null ? "null" : mesaId.toString())));
    }

    /** Crea el cliente a cuyo nombre va la reserva de esta prueba. */
    private Long crearCliente() throws Exception {
        MvcResult resultado = mockMvc.perform(post("/api/clientes")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                            "nombre": "Cliente de la prueba de capacidad",
                            "documento": "%d"
                        }
                        """.formatted(SIGUIENTE_DOCUMENTO.getAndIncrement())))
                .andExpect(status().isCreated())
                .andReturn();

        Number id = JsonPath.read(resultado.getResponse().getContentAsString(), "$.id");
        return id.longValue();
    }
}

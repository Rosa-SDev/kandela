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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pruebas de eliminar una mesa.
 *
 * La mesa se pone ocupada con su propio PUT en vez de abriendo un pedido: lo
 * que se prueba es la regla de eliminar, no cómo se llegó a ese estado, y así
 * la prueba no depende del servicio de usuarios.
 *
 * La clase trabaja sobre su propia base de datos en memoria para no compartir
 * mesas con las demás pruebas, y cada prueba crea la que necesita y lee su
 * identificador de la respuesta en vez de darlo por sabido.
 */
@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:salonmesasdb;DB_CLOSE_DELAY=-1")
class EliminarMesaTest {

    @Autowired
    private WebApplicationContext contextoWeb;

    private MockMvc mockMvc;

    @BeforeEach
    void prepararMockMvc() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(this.contextoWeb).build();
    }

    @Test
    void unaMesaLibreSeElimina() throws Exception {
        Long id = crearMesa(81, 4);

        mockMvc.perform(delete("/api/mesas/{id}", id))
                .andExpect(status().isNoContent());
    }

    @Test
    void unaMesaOcupadaNoSeEliminaYElMensajeLaNombra() throws Exception {
        Long id = crearMesa(82, 4);
        ocupar(id, 82, 4);

        mockMvc.perform(delete("/api/mesas/{id}", id))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error")
                        .value("No se puede eliminar la mesa 82 porque está ocupada."));
    }

    @Test
    void unaMesaQueNoExisteNoSePuedeEliminar() throws Exception {
        mockMvc.perform(delete("/api/mesas/{id}", 9999))
                .andExpect(status().isNotFound());
    }

    /** Crea una mesa y devuelve el identificador que le asignó el salón. */
    private Long crearMesa(int numero, int capacidad) throws Exception {
        MvcResult resultado = mockMvc.perform(post("/api/mesas")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"numero\": %d, \"capacidad\": %d}".formatted(numero, capacidad)))
                .andExpect(status().isCreated())
                .andReturn();

        Number id = JsonPath.read(resultado.getResponse().getContentAsString(), "$.id");
        return id.longValue();
    }

    /** Deja la mesa ocupada sin pasar por un pedido. */
    private void ocupar(Long id, int numero, int capacidad) throws Exception {
        mockMvc.perform(put("/api/mesas/{id}", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"numero\": %d, \"capacidad\": %d, \"estado\": \"OCUPADA\"}"
                        .formatted(numero, capacidad)))
                .andExpect(status().isOk());
    }
}

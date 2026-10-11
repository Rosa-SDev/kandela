package com.restaurante.salon.cliente;

import com.restaurante.salon.exception.ServicioNoDisponibleException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class UsuariosClientTest {

    private MockRestServiceServer mockServer;
    private UsuariosClient usuariosClient;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        mockServer = MockRestServiceServer.bindTo(builder).build();
        usuariosClient = new UsuariosClient(builder.build());
    }

    @Test
    void obtener_devuelveUsuarioCuandoResponde200() {
        String jsonRespuesta = """
                {
                  "id": 9,
                  "nombre": "Carlos Rojas",
                  "correo": "carlos@kandela.com",
                  "rol": "CAJERO",
                  "activo": true
                }
                """;

        mockServer.expect(requestTo("/api/usuarios/9"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(jsonRespuesta, MediaType.APPLICATION_JSON));

        UsuarioRemoto usuario = usuariosClient.obtener(9L);

        assertNotNull(usuario);
        assertEquals(9L, usuario.id());
        assertEquals("Carlos Rojas", usuario.nombre());
        assertEquals("CAJERO", usuario.rol());
        assertTrue(usuario.activo());
    }

    @Test
    void obtener_devuelveNullCuandoResponde404() {
        mockServer.expect(requestTo("/api/usuarios/9"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));

        UsuarioRemoto usuario = usuariosClient.obtener(9L);

        assertNull(usuario);
    }

    @Test
    void obtener_lanzaExcepcionCuandoServidorCaido() {
        mockServer.expect(requestTo("/api/usuarios/9"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));

        ServicioNoDisponibleException ex = assertThrows(ServicioNoDisponibleException.class, () -> {
            usuariosClient.obtener(9L);
        });

        assertEquals("El servicio de usuarios no está disponible en este momento.", ex.getMessage());
    }
}

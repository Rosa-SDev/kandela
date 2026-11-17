package com.restaurante.usuarios;

import com.jayway.jsonpath.JsonPath;
import com.restaurante.usuarios.config.CargaUsuariosDemostracion;
import com.restaurante.usuarios.contador.GeneradorDeIds;
import com.restaurante.usuarios.model.Cajero;
import com.restaurante.usuarios.model.Mesero;
import com.restaurante.usuarios.model.Usuario;
import com.restaurante.usuarios.repository.UsuarioRepository;

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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pruebas de integracion de los usuarios contra un MongoDB real (Testcontainers).
 *
 * Recorren la peticion completa: controlador, servicio, repositorio y base de
 * datos. Ademas miran los documentos tal como quedan guardados, para comprobar
 * lo que no se ve desde la API: el _class de cada rol, el contador y el indice.
 *
 * Antes de cada prueba se vacian "usuarios" y "contadores", asi que cada una
 * empieza sin usuarios y el primer id que se reparte es 1.
 */
@SpringBootTest
@Import(MongoDePrueba.class)
class UsuarioIntegracionTest {

    @Autowired
    private WebApplicationContext contextoWeb;

    @Autowired
    private UsuarioRepository repositorio;

    @Autowired
    private GeneradorDeIds generadorDeIds;

    @Autowired
    private MongoTemplate mongo;

    @Autowired
    private CargaUsuariosDemostracion cargaDemostracion;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(contextoWeb).build();
        repositorio.deleteAll();
        generadorDeIds.reiniciar();
    }

    private static String json(String nombre, String correo, String rol) {
        return """
                {"nombre": "%s", "correo": "%s", "rol": "%s", "password": "kandela123"}
                """.formatted(nombre, correo, rol);
    }

    private long crear(String nombre, String correo, String rol) throws Exception {
        String respuesta = mockMvc.perform(post("/api/usuarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(nombre, correo, rol)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(respuesta, "$.id")).longValue();
    }

    private Document documento(long id) {
        return mongo.getCollection("usuarios").find(new Document("_id", id)).first();
    }

    // ---------- CRUD por HTTP ----------

    @Test
    void crudCompletoDeUnUsuario() throws Exception {
        long id = crear("Carlos Rojas", "carlos.rojas@raizysazon.co", "MESERO");
        assertThat(id).isEqualTo(1L);

        mockMvc.perform(get("/api/usuarios/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("Carlos Rojas"))
                .andExpect(jsonPath("$.rol").value("MESERO"))
                .andExpect(jsonPath("$.activo").value(true))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());

        mockMvc.perform(put("/api/usuarios/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nombre": "Carlos Andrés Rojas", "correo": "carlos.r@raizysazon.co", "password": ""}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.nombre").value("Carlos Andrés Rojas"))
                .andExpect(jsonPath("$.rol").value("MESERO"));

        // Sin contraseña en el PUT se conserva la anterior: el login sigue funcionando.
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"correo": "CARLOS.R@raizysazon.co", "password": "kandela123"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id));

        mockMvc.perform(delete("/api/usuarios/{id}", id))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/usuarios/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("El usuario 1 no existe."));
        assertThat(documento(id)).isNull();
    }

    @Test
    void listarFiltraPorRol() throws Exception {
        crear("Carlos Rojas", "carlos.rojas@raizysazon.co", "MESERO");
        crear("Andrea Pérez", "andrea.perez@raizysazon.co", "MESERO");
        crear("Diana Ríos", "diana.rios@raizysazon.co", "CAJERO");

        mockMvc.perform(get("/api/usuarios")).andExpect(jsonPath("$", hasSize(3)));
        mockMvc.perform(get("/api/usuarios").param("rol", "MESERO"))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].rol").value("MESERO"));
        mockMvc.perform(get("/api/usuarios").param("rol", "COCINERO"))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void loginConLaContrasenaIncorrectaResponde401() throws Exception {
        crear("Carlos Rojas", "carlos.rojas@raizysazon.co", "MESERO");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"correo": "carlos.rojas@raizysazon.co", "password": "otra-clave"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Correo o contraseña incorrectos."));
    }

    // ---------- Como queda guardado en MongoDB ----------

    @Test
    void cadaRolSeGuardaConSuAliasEnClassYSeLeeComoSuSubclase() throws Exception {
        long mesero = crear("Carlos Rojas", "carlos.rojas@raizysazon.co", "MESERO");
        long cajera = crear("Diana Ríos", "diana.rios@raizysazon.co", "CAJERO");

        Document guardado = documento(mesero);
        assertThat(guardado.get("_id")).isInstanceOf(Long.class);
        assertThat(guardado.get("_class")).isEqualTo("MESERO");
        assertThat(documento(cajera).get("_class")).isEqualTo("CAJERO");

        assertThat(repositorio.findById(mesero)).get().isInstanceOf(Mesero.class);
        assertThat(repositorio.findById(cajera)).get().isInstanceOf(Cajero.class);
    }

    @Test
    void elContadorAvanzaConCadaUsuarioCreado() throws Exception {
        assertThat(crear("Laura Méndez", "laura.mendez@raizysazon.co", "ADMINISTRADOR")).isEqualTo(1L);
        assertThat(crear("Carlos Rojas", "carlos.rojas@raizysazon.co", "MESERO")).isEqualTo(2L);

        Document contador = mongo.getCollection("contadores").find(new Document("_id", "usuarios")).first();
        assertThat(contador.get("valor")).isEqualTo(2L);
    }

    // ---------- Unicidad del correo ----------

    @Test
    void crearConUnCorreoRepetidoEnOtraCapitalizacionRespondeConflicto() throws Exception {
        crear("Carlos Rojas", "carlos.rojas@raizysazon.co", "MESERO");

        mockMvc.perform(post("/api/usuarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("Otro Carlos", "CARLOS.ROJAS@raizysazon.co", "CAJERO")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Ya existe un usuario con ese correo."));

        assertThat(repositorio.count()).isEqualTo(1);
    }

    @Test
    void elIndiceUnicoRechazaElCorreoRepetidoAunqueSeSalteElServicio() throws Exception {
        crear("Carlos Rojas", "carlos.rojas@raizysazon.co", "MESERO");

        Usuario repetido = new Cajero("Otro", "Carlos.Rojas@RaizySazon.co", "x");
        repetido.asignarId(99L);

        assertThatThrownBy(() -> repositorio.insert(repetido))
                .isInstanceOf(DuplicateKeyException.class);
    }

    // ---------- Datos de demostracion sin el perfil demo ----------

    @Test
    void sinElPerfilDemoLosUsuariosSoloSeCarganSiLaColeccionEstaVacia() throws Exception {
        cargaDemostracion.run();
        assertThat(repositorio.count()).isEqualTo(5);
        assertThat(repositorio.findById(2L)).get()
                .extracting(Usuario::getNombre).isEqualTo("Carlos Rojas");
        assertThat(repositorio.findById(3L)).get().isInstanceOf(Mesero.class);

        crear("Pedro Gómez", "pedro.gomez@raizysazon.co", "COCINERO");
        cargaDemostracion.run();

        assertThat(repositorio.count()).isEqualTo(6);
    }
}

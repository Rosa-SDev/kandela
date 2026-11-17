package com.restaurante.usuarios;

import com.restaurante.usuarios.config.CargaUsuariosDemostracion;
import com.restaurante.usuarios.dto.CrearUsuarioDTO;
import com.restaurante.usuarios.model.Rol;
import com.restaurante.usuarios.model.Usuario;
import com.restaurante.usuarios.repository.UsuarioRepository;
import com.restaurante.usuarios.service.UsuarioService;

import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * El perfil demo deja los usuarios como recien instalados en cada arranque: los
 * cinco con los ids 1 a 5, que son los que usan clientes y salon.
 */
@SpringBootTest
@ActiveProfiles("demo")
@Import(MongoDePrueba.class)
class CargaUsuariosDemostracionDemoTest {

    @Autowired
    private CargaUsuariosDemostracion cargaDemostracion;

    @Autowired
    private UsuarioService servicio;

    @Autowired
    private UsuarioRepository repositorio;

    @Autowired
    private MongoTemplate mongo;

    @Test
    void conElPerfilDemoCadaArranqueRecargaLosCincoConLosIdsDel1Al5() throws Exception {
        servicio.crear(new CrearUsuarioDTO("Pedro Gómez", "pedro.gomez@raizysazon.co", Rol.COCINERO, "kandela123"));
        assertThat(repositorio.count()).isEqualTo(6);

        cargaDemostracion.run();

        assertThat(repositorio.findAll()).extracting(Usuario::getId)
                .containsExactlyInAnyOrder(1L, 2L, 3L, 4L, 5L);
        assertThat(repositorio.findById(1L)).get()
                .extracting(Usuario::getNombre).isEqualTo("Laura Méndez");
        assertThat(repositorio.findById(5L)).get()
                .extracting(Usuario::getNombre).isEqualTo("Diana Ríos");

        Document contador = mongo.getCollection("contadores").find(new Document("_id", "usuarios")).first();
        assertThat(contador.get("valor")).isEqualTo(5L);
    }

    @Test
    void vaciarLaColeccionConservaElIndiceUnicoDelCorreo() throws Exception {
        cargaDemostracion.run();

        boolean hayIndiceUnico = mongo.getCollection("usuarios").listIndexes()
                .into(new java.util.ArrayList<>()).stream()
                .anyMatch(indice -> Boolean.TRUE.equals(indice.get("unique")));
        assertThat(hayIndiceUnico).isTrue();
    }
}

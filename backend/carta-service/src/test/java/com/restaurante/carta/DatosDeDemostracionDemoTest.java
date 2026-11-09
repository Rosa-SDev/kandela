package com.restaurante.carta;

import com.restaurante.carta.model.Platillo;
import com.restaurante.carta.repository.PlatilloRepository;
import com.restaurante.carta.service.PlatilloService;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * El perfil demo deja la carta como recien instalada en cada arranque: los
 * seis platillos con los ids 1 a 6, que son los que usa salon-service.
 */
@SpringBootTest
@ActiveProfiles("demo")
@Import(MongoDePrueba.class)
class DatosDeDemostracionDemoTest {

    @Autowired
    private DatosDeDemostracion datosDeDemostracion;

    @Autowired
    private PlatilloService servicio;

    @Autowired
    private PlatilloRepository repositorio;

    @Autowired
    private MongoTemplate mongo;

    @Test
    void conElPerfilDemoCadaArranqueRecargaLosSeisConLosIdsDel1Al6() throws Exception {
        servicio.crear(new Platillo("Changua", null, "Entradas", new BigDecimal("14000"), true));
        assertThat(repositorio.count()).isEqualTo(7);

        datosDeDemostracion.run();

        assertThat(repositorio.count()).isEqualTo(6);
        assertThat(repositorio.findAll()).extracting(Platillo::getId)
                .containsExactlyInAnyOrder(1L, 2L, 3L, 4L, 5L, 6L);
        assertThat(repositorio.findById(6L)).get()
                .extracting(Platillo::getNombre).isEqualTo("Limonada de coco");

        Document contador = mongo.getCollection("contadores").find(new Document("_id", "platillos")).first();
        assertThat(contador.get("valor", Number.class).longValue()).isEqualTo(6L);
    }

    @Test
    void vaciarLasColeccionesConservaElIndiceUnicoDelNombre() throws Exception {
        datosDeDemostracion.run();

        boolean hayIndiceUnico = mongo.getCollection("platillos").listIndexes()
                .into(new java.util.ArrayList<>()).stream()
                .anyMatch(indice -> Boolean.TRUE.equals(indice.get("unique")));
        assertThat(hayIndiceUnico).isTrue();
    }
}
